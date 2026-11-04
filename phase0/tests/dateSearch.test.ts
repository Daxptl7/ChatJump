import { describe, expect, it, vi } from 'vitest';
import { searchDate } from '../src/dateSearch';
import type { DateSearchOptions } from '../src/dateSearch';
import { unverifiedAdapter } from '../src/adapter';
import { fixture, scrollOptions } from './fixtures';

describe('date search integration', () => {
  it('finds an already rendered verified message without automatic history scrolling', async () => {
    const { root, adapter } = fixture(); const run = await searchDate('2026-11-04', { adapter, timeZone: 'UTC' });
    expect(run.result).toMatchObject({ status: 'found', matchedDate: '2026-11-04', scrollAttempts: 0 });
    expect(root.querySelector('article')!.scrollIntoView).toHaveBeenCalledWith({ behavior: 'instant', block: 'center', inline: 'nearest' });
    expect(root.scrollTo).not.toHaveBeenCalled(); expect(run.benchmark.successful).toBe(true);
  });
  it('finds a historical date after ordinary DOM scroll and a delayed batch', async () => {
    vi.useFakeTimers(); const { root, adapter, add } = fixture();
    vi.mocked(root.scrollTo).mockImplementation(() => { setTimeout(() => add('2026-10-04'), 100); });
    const promise = searchDate('2026-10-04', { adapter, timeZone: 'UTC', scroll: scrollOptions });
    await vi.runAllTimersAsync(); const run = await promise;
    expect(run.result).toMatchObject({ status: 'found', scrollAttempts: 1 });
    expect(run.benchmark).toMatchObject({ timestampsDetected: 2, messageElementsObserved: 2, historyBatchesObserved: 1, timestampDetectionSuccessRate: 1 });
    expect(run.benchmark.mutationEvents).toBeGreaterThan(0); expect(run.benchmark.loadingDelaysMs[0]).toBeGreaterThanOrEqual(250);
  });
  it('reports UNVERIFIED configuration as incomplete', async () => expect((await searchDate('2026-11-04', { adapter: unverifiedAdapter, timeZone: 'UTC' })).result).toMatchObject({ status: 'incomplete', reason: 'adapter-unverified' }));
  it.each(['2026-02-30', '04/11/2026', 'private raw input'])('rejects invalid target %s without exporting it', async (target) => {
    const { adapter } = fixture(); expect((await searchDate(target, { adapter, timeZone: 'UTC' })).result).toMatchObject({ status: 'error', reason: 'invalid-target-date', targetDate: '' });
  });
  it('rejects invalid timezone and invalid limits', async () => {
    const { adapter } = fixture();
    expect((await searchDate('2026-11-04', { adapter, timeZone: 'bad/zone' })).result.reason).toBe('invalid-timezone');
    expect((await searchDate('2026-11-04', { adapter, timeZone: 'UTC', scroll: { delayMs: 0 } })).result.reason).toBe('invalid-scroll-options');
  });
  it('reports missing message dates as incomplete', async () => {
    const { adapter } = fixture([null]); expect((await searchDate('2026-11-04', { adapter, timeZone: 'UTC' })).result).toMatchObject({ status: 'incomplete', reason: 'dates-unavailable' });
  });
  it('refuses history scrolling if direction is unverified', async () => {
    const { root, adapter } = fixture(); adapter.getScrollEvidence = () => ({ container: root, olderDirection: 'up', directionVerified: false });
    expect((await searchDate('2026-10-04', { adapter, timeZone: 'UTC' })).result).toMatchObject({ status: 'incomplete', reason: 'unknown-scroll-direction' });
    expect(root.scrollTo).not.toHaveBeenCalled();
  });
  it('never returns not-found on exhausted or inaccessible loading', async () => {
    vi.useFakeTimers(); const { root, adapter } = fixture(); vi.mocked(root.scrollTo).mockImplementation(() => {});
    const promise = searchDate('2026-10-04', { adapter, timeZone: 'UTC', scroll: scrollOptions }); await vi.runAllTimersAsync();
    expect((await promise).result).toMatchObject({ status: 'incomplete', reason: 'loading-stalled', scrollAttempts: 3 });
  });
  it('returns not-found only with explicit complete rendering and readable dates', async () => {
    const { adapter } = fixture(); adapter.allHistoryRendered = () => true;
    expect((await searchDate('2026-10-04', { adapter, timeZone: 'UTC' })).result).toMatchObject({ status: 'not-found', reason: 'verified-complete-rendered-history' });
  });
  it('supports explicitly verified empty history', async () => {
    const { adapter } = fixture([]); adapter.allHistoryRendered = () => true;
    expect((await searchDate('2026-10-04', { adapter, timeZone: 'UTC' })).result.status).toBe('not-found');
  });
  it('cannot prove absence when some complete-history messages have no dates', async () => {
    const { adapter } = fixture(['2026-11-04', null]); adapter.allHistoryRendered = () => true;
    expect((await searchDate('2026-10-04', { adapter, timeZone: 'UTC' })).result).toMatchObject({ status: 'incomplete', reason: 'unreadable-message-dates' });
  });
  it('rejects complete-history claims when virtualization is suspected', async () => {
    const { adapter, root } = fixture(); adapter.allHistoryRendered = () => true;
    adapter.getScrollEvidence = () => ({ container: root, olderDirection: 'unknown', directionVerified: false, virtualizationSuspected: true });
    expect((await searchDate('2026-10-04', { adapter, timeZone: 'UTC' })).result.status).toBe('incomplete');
  });
  it('never promotes a truncated full-history scan to not-found', async () => {
    const { adapter, root } = fixture(); const message = root.querySelector<HTMLElement>('article')!;
    adapter.getMessages = () => [message]; adapter.getTimestampCandidates = () => Array.from({ length: 21 }, () => ({ element: message, value: '2026-11-04', source: 'time-element' as const, associationVerified: true }));
    adapter.allHistoryRendered = () => true;
    expect((await searchDate('2026-10-04', { adapter, timeZone: 'UTC' })).result).toMatchObject({ status: 'incomplete', reason: 'unreadable-message-dates' });
  });
  it('stops if the scroll container is replaced in place', async () => {
    vi.useFakeTimers(); const { adapter, root } = fixture(); const promise = searchDate('2026-10-04', { adapter, timeZone: 'UTC', scroll: scrollOptions });
    const replacement = document.createElement('div'); root.append(replacement);
    adapter.getScrollEvidence = () => ({ container: replacement, olderDirection: 'up', directionVerified: true });
    await vi.advanceTimersByTimeAsync(50); expect((await promise).result).toMatchObject({ status: 'cancelled', reason: 'conversation-changed' });
  });
  it('prevents a second search from sharing the active document', async () => {
    vi.useFakeTimers(); const { adapter } = fixture(); const controller = new AbortController();
    const options: DateSearchOptions = { adapter, timeZone: 'UTC', scroll: { ...scrollOptions, signal: controller.signal } };
    const first = searchDate('2026-10-04', options);
    expect((await searchDate('2026-10-04', options)).result.reason).toBe('search-already-running');
    controller.abort(); expect((await first).result.status).toBe('cancelled');
    expect((await searchDate('2026-11-04', { adapter, timeZone: 'UTC' })).result.status).toBe('found');
  });
  it('cancels a key switch even if the same root and route are retained', async () => {
    vi.useFakeTimers(); const { adapter, root } = fixture(); const promise = searchDate('2026-10-04', { adapter, timeZone: 'UTC', scroll: scrollOptions });
    root.dataset.key = 'switched'; await vi.advanceTimersByTimeAsync(50);
    expect((await promise).result).toMatchObject({ status: 'cancelled', reason: 'conversation-changed', scrollAttempts: 1 }); expect(vi.getTimerCount()).toBe(0);
  });
  it('cancels SPA route navigation and releases its observer', async () => {
    vi.useFakeTimers(); const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect'); const { adapter } = fixture();
    const promise = searchDate('2026-10-04', { adapter, timeZone: 'UTC', scroll: scrollOptions }); history.replaceState({}, '', '/direct/t/other/');
    // Route changes must stop even before the adapter's in-memory key updates.
    await vi.advanceTimersByTimeAsync(50);
    expect((await promise).result.status).toBe('cancelled'); expect(disconnect).toHaveBeenCalled();
  });
  it('reports a timeout as incomplete rather than missing', async () => {
    vi.useFakeTimers(); const { adapter } = fixture();
    const promise = searchDate('2026-10-04', { adapter, timeZone: 'UTC', scroll: { ...scrollOptions, maxDurationMs: 75 } }); await vi.advanceTimersByTimeAsync(75);
    expect((await promise).result).toMatchObject({ status: 'incomplete', reason: 'timeout', scrollAttempts: 1 });
  });
  it('sanitizes arbitrary adapter exceptions and always disconnects observers', async () => {
    const disconnect = vi.spyOn(MutationObserver.prototype, 'disconnect'); const { adapter } = fixture();
    adapter.getMessages = () => { throw new Error('PRIVATE MESSAGE URL NAME'); };
    const run = await searchDate('2026-11-04', { adapter, timeZone: 'UTC' });
    expect(run.result).toMatchObject({ status: 'error', reason: 'dom-operation-failed' }); expect(JSON.stringify(run)).not.toContain('PRIVATE'); expect(disconnect).toHaveBeenCalled();
  });
  it('keeps progress notifications structured and private', async () => {
    const { adapter, root } = fixture(); root.querySelector('article')!.append('PRIVATE NAME BODY');
    const onProgress = vi.fn(); const run = await searchDate('2026-11-04', { adapter, timeZone: 'UTC', onProgress });
    expect(onProgress).toHaveBeenCalled(); expect(JSON.stringify([run, onProgress.mock.calls])).not.toMatch(/PRIVATE|synthetic-thread|instagram/);
  });
});
