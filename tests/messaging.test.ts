import { describe, expect, it, vi } from 'vitest';
import { checkConnection, withDeadline } from '../src/messaging/messagingService';
import { isConnectionResponse, isExtensionMessage } from '../src/messaging/messages';
import { registerConnectionListener } from '../src/messaging/contentListener';
import { response, testClient } from './fixtures';

describe('typed popup messages', () => {
  it('accepts only the defined one-field request messages', () => {
    expect(isExtensionMessage({ type: 'PING' })).toBe(true); expect(isExtensionMessage({ type: 'GET_CONNECTION_STATUS' })).toBe(true);
    expect(isExtensionMessage({ type: 'SEARCH', date: '2026-11-04' })).toBe(false); expect(isExtensionMessage({ type: 'PING', body: 'private' })).toBe(false);
  });
  it('validates a successful handshake before exposing connection', async () => {
    const { client } = testClient(); expect(await checkConnection(client, 7)).toEqual(response);
    expect(client.sendMessage).toHaveBeenCalledWith(7, { type: 'GET_CONNECTION_STATUS' });
  });
  it('maps a missing content script to a fixed actionable error code', async () => {
    const { client } = testClient(); client.sendMessage.mockRejectedValue(new Error('Could not establish connection. Receiving end does not exist. PRIVATE URL'));
    await expect(checkConnection(client, 7)).rejects.toMatchObject({ code: 'script-unavailable', message: 'script-unavailable' });
  });
  it('sanitizes other browser rejections', async () => {
    const { client } = testClient(); client.sendMessage.mockRejectedValue(new Error('PRIVATE NAME URL STACK'));
    await expect(checkConnection(client, 7)).rejects.toMatchObject({ code: 'messaging-failed', message: 'messaging-failed' });
  });
  it.each([undefined, null, {}, { success: true }, { ...response, conversationDetected: true }, { ...response, contentScriptReady: false }, { ...response, private: 'extra' }])('rejects unexpected readiness data %j', async (value) => {
    const { client } = testClient(); client.sendMessage.mockResolvedValue(value);
    expect(isConnectionResponse(value)).toBe(false); await expect(checkConnection(client, 7)).rejects.toMatchObject({ code: 'unexpected-response' });
  });
  it('times out a request that never settles', async () => {
    vi.useFakeTimers(); const { client } = testClient(); client.sendMessage.mockReturnValue(new Promise(() => {}));
    const pending = checkConnection(client, 7); const rejected = expect(pending).rejects.toMatchObject({ code: 'timeout' });
    await vi.advanceTimersByTimeAsync(2000); await rejected; expect(vi.getTimerCount()).toBe(0);
  });
  it('cancels a pending request without retaining timeout timers', async () => {
    vi.useFakeTimers(); const controller = new AbortController();
    const pending = withDeadline(() => new Promise(() => {}), controller.signal); const rejected = expect(pending).rejects.toMatchObject({ code: 'cancelled' });
    controller.abort(); await rejected; expect(vi.getTimerCount()).toBe(0);
  });
  it('does not invoke an operation when already aborted', async () => {
    const controller = new AbortController(); controller.abort(); const operation = vi.fn(async () => true);
    await expect(withDeadline(operation, controller.signal)).rejects.toMatchObject({ code: 'cancelled' }); expect(operation).not.toHaveBeenCalled();
  });
});

describe('content script message boundary', () => {
  function runtimeFixture() {
    const addListener = vi.fn(), removeListener = vi.fn();
    const runtime = { id: 'synthetic-extension', onMessage: { addListener, removeListener } } as unknown as typeof chrome.runtime;
    const stop = registerConnectionListener(runtime, () => 'https://www.instagram.com/direct/t/synthetic/');
    const listener = addListener.mock.calls[0]![0] as (message: unknown, sender: chrome.runtime.MessageSender, respond: (value: unknown) => void) => unknown;
    return { stop, listener, removeListener };
  }
  it.each(['PING', 'GET_CONNECTION_STATUS'])('responds to trusted %s without reading a conversation', (type) => {
    const { listener, stop, removeListener } = runtimeFixture(); const respond = vi.fn();
    listener({ type }, { id: 'synthetic-extension' }, respond); expect(respond).toHaveBeenCalledWith(response);
    expect(JSON.stringify(respond.mock.calls)).not.toMatch(/synthetic|instagram.com|token|participant/);
    stop(); expect(removeListener).toHaveBeenCalledWith(listener);
  });
  it('ignores foreign senders, tab senders, and unknown requests', () => {
    const { listener, stop } = runtimeFixture(); const respond = vi.fn();
    listener({ type: 'PING' }, { id: 'foreign' }, respond);
    listener({ type: 'SEARCH' }, { id: 'synthetic-extension' }, respond);
    listener({ type: 'PING' }, { id: 'synthetic-extension', tab: { id: 7 } as chrome.tabs.Tab }, respond);
    expect(respond).not.toHaveBeenCalled(); stop();
  });
});
