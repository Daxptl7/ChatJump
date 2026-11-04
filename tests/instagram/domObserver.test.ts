import { describe, expect, it, vi } from 'vitest';
import { fixture } from './fixtures';
import { ConversationDOMObserver } from '../../src/adapters/instagram/domObserver';

describe('scoped/coalesced DOM observation', () => {
  it('coalesces insertions and recalculates current dates rather than accumulating history', async () => {
    vi.useFakeTimers(); const { adapter, add, list } = fixture(); const updated = vi.fn(); adapter.observeMessages(updated);
    add('2026-10-15'); add('2026-10-16'); await vi.advanceTimersByTimeAsync(110);
    expect(updated).toHaveBeenCalledTimes(2); expect(adapter.getSnapshot()).toMatchObject({ renderedMessageCount: 3, earliestRenderedDate: '2026-10-15' });
    list.querySelector('article')!.remove(); await vi.advanceTimersByTimeAsync(110);
    expect(adapter.getSnapshot()).toMatchObject({ renderedMessageCount: 2, latestRenderedDate: '2026-10-16', virtualizationSuspected: true }); adapter.cleanup(); expect(vi.getTimerCount()).toBe(0);
  });
  it('refreshes timestamps and ignores unrelated document changes', async () => {
    vi.useFakeTimers(); const { adapter, list } = fixture(); const updated = vi.fn(); adapter.observeMessages(updated);
    document.body.append(document.createElement('aside')); await vi.advanceTimersByTimeAsync(110); expect(updated).toHaveBeenCalledTimes(1);
    list.querySelector('time')!.dateTime = '2026-10-15'; await vi.advanceTimersByTimeAsync(110);
    expect(adapter.getSnapshot().earliestRenderedDate).toBe('2026-10-15'); expect(updated).toHaveBeenCalledTimes(2); adapter.cleanup();
  });
  it('replaces the observer and local keys on same-root identity switches', async () => {
    vi.useFakeTimers(); const observe = vi.spyOn(MutationObserver.prototype, 'observe'); const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect');
    const { adapter, root } = fixture(); const updated = vi.fn(); adapter.observeMessages(updated); const oldKey = adapter.getRenderedMessages()[0]!.localKey;
    root.setAttribute('data-test-key', 'new-private-identity'); await vi.advanceTimersByTimeAsync(110);
    expect(adapter.getRenderedMessages()[0]!.localKey).not.toBe(oldKey); expect(observe).toHaveBeenCalledTimes(2); expect(disconnect).toHaveBeenCalled(); adapter.cleanup();
  });
  it('discovers a root replacement through a bounded identity poll and drops old dates', async () => {
    vi.useFakeTimers(); const { adapter, root, config } = fixture(); const updated = vi.fn(); adapter.observeMessages(updated);
    const replacement = root.cloneNode(true) as HTMLElement; replacement.setAttribute('data-test-key', 'replacement'); replacement.querySelector('time')!.setAttribute('datetime', '2026-01-01'); root.replaceWith(replacement);
    await vi.advanceTimersByTimeAsync(500);
    expect(adapter.getSnapshot()).toMatchObject({ earliestRenderedDate: '2026-01-01', latestRenderedDate: '2026-01-01' });
    expect(adapter.detectConversation().identity).toBe(replacement.getAttribute(config.conversationKeyAttribute)); adapter.cleanup();
  });
  it('invalidates on SPA navigation even if a connected old root remains', async () => {
    vi.useFakeTimers(); const { adapter } = fixture(); const updated = vi.fn(); adapter.observeMessages(updated);
    history.replaceState({}, '', '/direct/inbox/'); await vi.advanceTimersByTimeAsync(500);
    expect(adapter.getSnapshot()).toMatchObject({ status: 'not-open', reason: 'NO_CONVERSATION' }); expect(adapter.getSnapshot()).not.toHaveProperty('renderedMessageCount'); adapter.cleanup();
  });
  it('uses one observer for multiple subscribers and disposes every timer after the last unsubscribe', () => {
    vi.useFakeTimers(); const observe = vi.spyOn(MutationObserver.prototype, 'observe'); const { adapter, add, root } = fixture();
    const first = adapter.observeMessages(vi.fn()), second = adapter.observeMessages(vi.fn());
    expect(observe).toHaveBeenCalledTimes(1); expect(observe.mock.calls[0]?.[0]).toBe(root); add('2026-01-01');
    first(); expect(adapter.getDiagnostics().metrics.activeObservers).toBe(1);
    second(); expect(vi.getTimerCount()).toBe(0); expect(adapter.getDiagnostics().metrics.activeObservers).toBe(0); adapter.cleanup();
  });
  it('cleans up while an update is pending and never revives a disposed adapter', async () => {
    vi.useFakeTimers(); const { adapter, add } = fixture(); const updated = vi.fn(); adapter.observeMessages(updated); add('2026-01-01'); await Promise.resolve(); adapter.cleanup();
    await vi.advanceTimersByTimeAsync(1000); expect(updated).toHaveBeenCalledTimes(1); expect(vi.getTimerCount()).toBe(0);
    expect(adapter.getSnapshot()).toMatchObject({ status: 'error', reason: 'CONTEXT_INVALIDATED' }); expect(adapter.getRenderedMessages()).toEqual([]);
  });
  it('reports an observer attachment failure without throwing DOM details', () => {
    vi.useFakeTimers(); vi.spyOn(MutationObserver.prototype, 'observe').mockImplementation(() => { throw new Error('PRIVATE DOM DETAILS'); });
    const { adapter } = fixture(); adapter.observeMessages(vi.fn());
    expect(adapter.getSnapshot()).toMatchObject({ status: 'error', reason: 'OBSERVER_FAILED' }); expect(JSON.stringify(adapter.getSnapshot())).not.toContain('PRIVATE'); adapter.cleanup();
  });
  it('never duplicates observer start calls for the same root', () => {
    const observe = vi.spyOn(MutationObserver.prototype, 'observe'); const { root, config } = fixture(); const observer = new ConversationDOMObserver();
    observer.start(root, config, () => false, vi.fn()); observer.start(root, config, () => false, vi.fn()); expect(observe).toHaveBeenCalledTimes(1); observer.stop();
  });
  it('recalculates groups when a separator appears or its date text changes', async () => {
    vi.useFakeTimers(); const { adapter, list, config } = fixture([]);
    config.dateGroups = { kind: 'contained', groupSelector: '[data-test-group]', separatorSelector: '[data-test-separator]', associationVerified: true,
      dateRule: { selector: ':scope', read: 'leaf-text', source: 'date-separator', associationVerified: true } };
    list.innerHTML = '<section data-test-group><article data-test-message></article></section>';
    adapter.observeMessages(vi.fn()); expect(adapter.getSnapshot().datedMessageCount).toBe(0);
    list.firstElementChild!.insertAdjacentHTML('afterbegin', '<span data-test-separator>2026-11-04</span>'); await vi.advanceTimersByTimeAsync(110);
    expect(adapter.getSnapshot().earliestRenderedDate).toBe('2026-11-04'); list.querySelector('[data-test-separator]')!.firstChild!.nodeValue = '2026-10-15'; await vi.advanceTimersByTimeAsync(110);
    expect(adapter.getSnapshot().earliestRenderedDate).toBe('2026-10-15'); adapter.cleanup();
  });
});
