import { describe, expect, it, vi } from 'vitest';
import { detectScrollContext, findScrollCandidates, scrollTowardOlder } from '../src/scrollDetector';
import { runScrollEngine, validScrollOptions } from '../src/scrollEngine';
import type { ScrollHooks } from '../src/scrollEngine';
import { emptyScan, fixture, scrollOptions } from './fixtures';

function hooks(overrides: Partial<ScrollHooks> = {}): ScrollHooks {
  return { scan: emptyScan, isCurrent: () => true, evaluate: () => undefined, recordScan: () => false, onAttempt: vi.fn(), ...overrides };
}

describe('scroll detection and direction', () => {
  it('finds native overflow candidates inside the conversation', () => {
    const { root } = fixture(); expect(findScrollCandidates(root)).toEqual([root]);
  });
  it('requires evidence before choosing direction', () => {
    const { root, adapter } = fixture(); adapter.getScrollEvidence = () => ({ container: root, olderDirection: 'up', directionVerified: false });
    expect(detectScrollContext(root, adapter)?.olderDirection).toBe('unknown');
  });
  it('rejects a scroll container outside the active conversation', () => {
    const { root, adapter } = fixture(); adapter.getScrollEvidence = () => ({ container: document.body, olderDirection: 'up', directionVerified: true });
    expect(detectScrollContext(root, adapter)).toBeUndefined();
  });
  it('does not treat a zero-size element as scrollable', () => {
    const { root, adapter } = fixture(); Object.defineProperty(root, 'clientHeight', { value: 0 });
    expect(detectScrollContext(root, adapter)?.isScrollable).toBe(false);
  });
  it('uses negative scrollTop for a verified reversed container', () => {
    const { root, context } = fixture(); root.style.flexDirection = 'column-reverse'; root.scrollTop = 0;
    scrollTowardOlder(context, 200); expect(root.scrollTop).toBe(-200);
  });
  it('allows older history to be physically down only with verified evidence', () => {
    const { root, context } = fixture(); context.olderDirection = 'down'; scrollTowardOlder(context, 100); expect(root.scrollTop).toBe(900);
  });
});

describe('bounded scroll engine', () => {
  it.each([{ maxAttempts: 0 }, { maxAttempts: Infinity }, { maxDurationMs: NaN }, { maxDurationMs: 300001 }, { delayMs: 0 }, { delayMs: 249 }, { scrollStepPx: -1 }, { scrollStepPx: Infinity }])('rejects unsafe limits %j', (override) => expect(validScrollOptions({ ...scrollOptions, ...override })).toBe(false));
  it('never scrolls when direction is unknown', async () => {
    const { root, context } = fixture(); context.olderDirection = 'unknown';
    expect(await runScrollEngine(context, scrollOptions, hooks())).toMatchObject({ status: 'incomplete', reason: 'unknown-scroll-direction', attempts: 0 });
    expect(root.scrollTo).not.toHaveBeenCalled();
  });
  it('stops before scrolling if already cancelled', async () => {
    const controller = new AbortController(); controller.abort(); const { root, context } = fixture();
    expect(await runScrollEngine(context, { ...scrollOptions, signal: controller.signal }, hooks())).toMatchObject({ status: 'cancelled', attempts: 0 });
    expect(root.scrollTo).not.toHaveBeenCalled();
  });
  it('handles cancellation during a render wait and releases timers', async () => {
    vi.useFakeTimers(); const { context } = fixture(); const controller = new AbortController();
    const result = runScrollEngine(context, { ...scrollOptions, signal: controller.signal }, hooks()); controller.abort();
    expect(await result).toMatchObject({ status: 'cancelled', reason: 'user-cancelled', attempts: 1 }); expect(vi.getTimerCount()).toBe(0);
  });
  it('stops at the deadline even when render delay is much longer', async () => {
    vi.useFakeTimers(); const { context } = fixture();
    const promise = runScrollEngine(context, { ...scrollOptions, maxDurationMs: 100, delayMs: 1000 }, hooks());
    await vi.advanceTimersByTimeAsync(100);
    expect(await promise).toMatchObject({ status: 'incomplete', reason: 'timeout', attempts: 1 }); expect(vi.getTimerCount()).toBe(0);
  });
  it('stops during the wait when conversation identity changes', async () => {
    vi.useFakeTimers(); const { context } = fixture(); let current = true;
    const promise = runScrollEngine(context, scrollOptions, hooks({ isCurrent: () => current })); current = false;
    await vi.advanceTimersByTimeAsync(50);
    expect(await promise).toMatchObject({ status: 'cancelled', reason: 'conversation-changed', attempts: 1 }); expect(vi.getTimerCount()).toBe(0);
  });
  it('stops after three stalled attempts despite layout mutations', async () => {
    vi.useFakeTimers(); const { root, context } = fixture(); vi.mocked(root.scrollTo).mockImplementation(() => {});
    const scan = { ...emptyScan(), matches: [{ element: root, detected: { dateISO: '2026-11-04', source: 'time-element' as const, confidence: 'medium' as const } }] };
    const promise = runScrollEngine(context, scrollOptions, hooks({ scan: () => scan }));
    await vi.runAllTimersAsync(); expect(await promise).toMatchObject({ status: 'incomplete', reason: 'loading-stalled', attempts: 3 });
  });
  it('ends at the attempt limit while viewport movement makes progress', async () => {
    vi.useFakeTimers(); const { root, context } = fixture();
    const scan = { ...emptyScan(), matches: [{ element: root, detected: { dateISO: '2026-11-04', source: 'time-element' as const, confidence: 'medium' as const } }] };
    const promise = runScrollEngine(context, { ...scrollOptions, maxAttempts: 2 }, hooks({ scan: () => scan }));
    await vi.runAllTimersAsync(); expect(await promise).toMatchObject({ status: 'incomplete', reason: 'attempt-limit', attempts: 2 });
  });
  it('does not navigate further when dates become unreadable', async () => {
    vi.useFakeTimers(); const { context } = fixture(); const promise = runScrollEngine(context, scrollOptions, hooks());
    await vi.runAllTimersAsync(); expect(await promise).toMatchObject({ status: 'incomplete', reason: 'dates-unavailable', attempts: 1 });
  });
  it('never equates an unscrollable boundary with complete history', async () => {
    const { context } = fixture(); context.isScrollable = false;
    expect(await runScrollEngine(context, scrollOptions, hooks())).toMatchObject({ status: 'incomplete', reason: 'history-unavailable' });
  });
});
