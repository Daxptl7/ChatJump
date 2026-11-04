import { describe, expect, it, vi } from 'vitest';
import { InstagramAdapter, emptySnapshot } from '../../src/adapters/instagram/InstagramAdapter';
import { initializeInstagramRuntime } from '../../src/adapters/instagram/runtime';
import { isConversationSnapshot } from '../../src/core/snapshot';
import { isSnapshotResponse } from '../../src/messaging/messages';
import { getConversationSnapshot } from '../../src/messaging/messagingService';
import { registerConnectionListener } from '../../src/messaging/contentListener';
import { testClient } from '../fixtures';
import { fixture } from './fixtures';

function runtimeFixture() {
  const listeners = new Set<(message: unknown, sender: chrome.runtime.MessageSender, send: (value: unknown) => void) => unknown>();
  const runtime = { id: 'phase2-synthetic-extension', onMessage: { addListener: vi.fn((listener) => listeners.add(listener)), removeListener: vi.fn((listener) => listeners.delete(listener)) } } as unknown as typeof chrome.runtime;
  const send = (type: string): unknown => {
    let response: unknown;
    for (const listener of listeners) listener({ type }, { id: runtime.id }, (value) => { response = value; });
    return response;
  };
  return { runtime, listeners, send };
}

describe('Phase 2 extension integration and privacy', () => {
  it('preserves the Phase 1 handshake while adding fresh discriminated summaries', () => {
    const { adapter, root } = fixture(); const { runtime, send } = runtimeFixture();
    const stop = registerConnectionListener(runtime, () => location.href, () => adapter.getSnapshot());
    expect(send('PING')).toEqual({ success: true, platform: 'instagram', contentScriptReady: true, conversationDetected: null });
    for (const type of ['GET_CONVERSATION_STATUS', 'GET_RENDERED_MESSAGE_SUMMARY'] as const) expect(isSnapshotResponse(send(type), type)).toBe(true);
    root.querySelector('time')!.dateTime = '2026-01-01';
    expect(send('GET_CONVERSATION_STATUS')).toMatchObject({ snapshot: { earliestRenderedDate: '2026-01-01' } }); stop(); adapter.cleanup();
  });
  it('returns no stale dates after an in-place conversation switch', () => {
    const { adapter, root } = fixture(); const first = adapter.getSnapshot();
    for (let index = 1; index < 12; index++) { root.querySelector('time')!.dateTime = `2026-10-${String(index).padStart(2, '0')}`; adapter.getSnapshot(); }
    const previous = adapter.getSnapshot(); root.setAttribute('data-test-key', 'new-key');
    const next = adapter.getSnapshot(); expect(next.revision).toBeGreaterThan(previous.revision);
    root.querySelector('time')!.remove(); expect(adapter.getSnapshot()).not.toHaveProperty('earliestRenderedDate'); expect(next.revision).toBeGreaterThan(first.revision); adapter.cleanup();
  });
  it('requires strict serializable metadata and rejects private fields or DOM nodes', () => {
    const { adapter, root } = fixture(); const snapshot = adapter.getSnapshot(); expect(isConversationSnapshot(snapshot)).toBe(true);
    expect(isConversationSnapshot({ ...snapshot, element: root })).toBe(false);
    expect(isConversationSnapshot({ ...snapshot, participant: 'PRIVATE PERSON' })).toBe(false);
    expect(isConversationSnapshot({ ...snapshot, renderedMessageCount: -1 })).toBe(false);
    expect(isConversationSnapshot({ ...snapshot, datedMessageCount: 2000 })).toBe(false);
    expect(isConversationSnapshot({ ...snapshot, timestampCoverage: 'partial' })).toBe(false);
    expect(isConversationSnapshot({ ...snapshot, lastUpdatedAt: Infinity })).toBe(false);
    expect(isSnapshotResponse({ success: true, type: 'GET_CONVERSATION_STATUS', snapshot }, 'GET_RENDERED_MESSAGE_SUMMARY')).toBe(false); adapter.cleanup();
  });
  it('never transports diagnostics, HTML, opaque keys, or message text', () => {
    const { adapter, root } = fixture(); root.setAttribute('aria-label', 'PRIVATE PERSON');
    const snapshot = JSON.parse(JSON.stringify(adapter.getSnapshot())); const diagnostics = adapter.getDiagnostics();
    expect(JSON.stringify([snapshot, diagnostics])).not.toMatch(/SYNTHETIC PRIVATE BODY|PRIVATE PERSON|opaque-fixture|<article|instagram.com/);
    expect(diagnostics.metrics.messageDetectionMs).toBeGreaterThanOrEqual(0); expect(diagnostics.structure?.timeElements).toBe(1); adapter.cleanup();
  });
  it('initializes repeatedly with exactly one runtime listener and one observer', () => {
    vi.useFakeTimers(); const { config } = fixture(); const { runtime, listeners } = runtimeFixture();
    const first = initializeInstagramRuntime(runtime, document, config); const second = initializeInstagramRuntime(runtime, document, config);
    expect(listeners.size).toBe(1); expect(vi.getTimerCount()).toBe(1); first(); expect(listeners.size).toBe(1); second(); expect(listeners.size).toBe(0); expect(vi.getTimerCount()).toBe(0);
  });
  it('sanitizes invalid providers and thrown exceptions', () => {
    const { runtime, send } = runtimeFixture();
    const stop = registerConnectionListener(runtime, () => location.href, () => { throw new Error('PRIVATE RAW DOM'); });
    expect(send('GET_CONVERSATION_STATUS')).toMatchObject({ snapshot: { status: 'error', reason: 'ADAPTER_FAILED' } }); expect(JSON.stringify(send('GET_CONVERSATION_STATUS'))).not.toContain('PRIVATE'); stop();
  });
  it('renders no count claim for default unverified DOM and home-page routes', () => {
    fixture(); const adapter = new InstagramAdapter(); expect(adapter.getSnapshot()).toMatchObject({ status: 'unsupported-layout', reason: 'UNVERIFIED_SELECTORS' }); expect(adapter.getSnapshot()).not.toHaveProperty('renderedMessageCount');
    history.replaceState({}, '', '/'); expect(adapter.getSnapshot()).toMatchObject({ status: 'not-open' }); expect(adapter.getSnapshot()).not.toHaveProperty('earliestRenderedDate'); adapter.cleanup();
  });
  it('validates snapshot-service replies and handles missing content scripts', async () => {
    const { adapter } = fixture(); const { client } = testClient(); const snapshot = adapter.getSnapshot();
    client.sendMessage.mockResolvedValue({ success: true, type: 'GET_RENDERED_MESSAGE_SUMMARY', snapshot }); expect(await getConversationSnapshot(client, 7)).toEqual(snapshot);
    client.sendMessage.mockResolvedValue({ success: true, type: 'GET_RENDERED_MESSAGE_SUMMARY', snapshot: { ...snapshot, private: 'body' } }); await expect(getConversationSnapshot(client, 7)).rejects.toMatchObject({ code: 'unexpected-response' });
    client.sendMessage.mockRejectedValue(new Error('Receiving end does not exist')); await expect(getConversationSnapshot(client, 7)).rejects.toMatchObject({ code: 'script-unavailable' }); adapter.cleanup();
  });
  it('accepts unavailable snapshots but refuses fabricated zero counts', () => {
    const snapshot = emptySnapshot('unsupported-layout', 'unverified', 'UNVERIFIED_SELECTORS'); expect(isConversationSnapshot(snapshot)).toBe(true);
    expect(isConversationSnapshot({ ...snapshot, renderedMessageCount: 0 })).toBe(false);
  });
  it('never initiates history scrolling while reading or observing', async () => {
    vi.useFakeTimers(); const scroll = vi.fn(); Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: scroll }); Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: scroll });
    const { adapter, add } = fixture(); adapter.observeMessages(vi.fn()); add('2026-10-15'); await vi.advanceTimersByTimeAsync(500); adapter.getSnapshot(); expect(scroll).not.toHaveBeenCalled(); adapter.cleanup();
  });
  it('releases observers and timers if Chrome rejects listener registration or removal', () => {
    vi.useFakeTimers(); const { config } = fixture(); const { runtime } = runtimeFixture();
    const add = vi.spyOn(runtime.onMessage, 'addListener').mockImplementation(() => { throw new Error('Extension context invalidated'); });
    expect(() => initializeInstagramRuntime(runtime, document, config)).not.toThrow(); expect(vi.getTimerCount()).toBe(0); add.mockRestore();
    const dispose = initializeInstagramRuntime(runtime, document, config);
    vi.spyOn(runtime.onMessage, 'removeListener').mockImplementation(() => { throw new Error('Extension context invalidated'); });
    expect(dispose).not.toThrow(); expect(vi.getTimerCount()).toBe(0);
  });
});
