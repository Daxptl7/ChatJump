import { scrollTowardOlder } from './scrollDetector';
import type { ScrollContext, ScrollOptions, TimestampScan } from './types';

export const DEFAULT_SCROLL_OPTIONS: Readonly<ScrollOptions> = Object.freeze({ maxAttempts: 60, maxDurationMs: 60_000, scrollStepPx: 500, delayMs: 1000 });

export function validScrollOptions(options: ScrollOptions): boolean {
  return Number.isInteger(options.maxAttempts) && options.maxAttempts > 0 && options.maxAttempts <= 500 &&
    Number.isFinite(options.maxDurationMs) && options.maxDurationMs > 0 && options.maxDurationMs <= 300_000 &&
    Number.isFinite(options.scrollStepPx) && options.scrollStepPx > 0 && options.scrollStepPx <= 2000 &&
    Number.isFinite(options.delayMs) && options.delayMs >= 250 && options.delayMs <= 10_000;
}

export type EngineStop = 'found' | 'not-found' | 'incomplete' | 'cancelled';
export interface EngineDecision { status: EngineStop; reason: string }
export interface EngineResult extends EngineDecision { attempts: number }
export interface ScrollHooks {
  scan: () => TimestampScan;
  /** Must check route, root, opaque conversation key, and scroll container identity. */
  isCurrent: () => boolean;
  evaluate: (scan: TimestampScan) => EngineDecision | undefined;
  recordScan: (scan: TimestampScan) => boolean;
  onScroll?: (attempts: number) => void;
  onAttempt: (attempts: number, waitedMs: number, progress: boolean, historyBatch: boolean) => void;
}

type WaitStop = 'ready' | 'cancelled' | 'conversation-changed' | 'timeout';

/** Poll identity/cancellation during a bounded render delay; always release timer/listener. */
function waitForRender(options: ScrollOptions, deadline: number, isCurrent: () => boolean): Promise<WaitStop> {
  return new Promise((resolve) => {
    const readyAt = performance.now() + options.delayMs;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let finished = false;
    const finish = (reason: WaitStop): void => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      options.signal?.removeEventListener('abort', cancel);
      resolve(reason);
    };
    const cancel = (): void => finish('cancelled');
    const tick = (): void => {
      if (options.signal?.aborted) return finish('cancelled');
      try { if (!isCurrent()) return finish('conversation-changed'); } catch { return finish('conversation-changed'); }
      const now = performance.now();
      if (now >= deadline) return finish('timeout');
      if (now >= readyAt) return finish('ready');
      timer = setTimeout(tick, Math.max(1, Math.min(50, deadline - now, readyAt - now)));
    };
    options.signal?.addEventListener('abort', cancel, { once: true });
    tick();
  });
}

export async function runScrollEngine(context: ScrollContext, options: ScrollOptions, hooks: ScrollHooks, startedAt = performance.now()): Promise<EngineResult> {
  let attempts = 0;
  const stop = (status: EngineStop, reason: string): EngineResult => ({ status, reason, attempts });
  if (!validScrollOptions(options)) return stop('incomplete', 'invalid-scroll-options');
  if (options.signal?.aborted) return stop('cancelled', 'user-cancelled');
  if (!hooks.isCurrent()) return stop('cancelled', 'conversation-changed');
  if (context.olderDirection === 'unknown') return stop('incomplete', 'unknown-scroll-direction');
  if (!context.isScrollable) return stop('incomplete', 'history-unavailable');
  const deadline = startedAt + options.maxDurationMs;
  let stalls = 0;
  while (attempts < options.maxAttempts) {
    if (options.signal?.aborted) return stop('cancelled', 'user-cancelled');
    if (!hooks.isCurrent()) return stop('cancelled', 'conversation-changed');
    if (performance.now() >= deadline) return stop('incomplete', 'timeout');
    const beforeTop = context.container.scrollTop;
    const beforeHeight = context.container.scrollHeight;
    const waitStarted = performance.now();
    scrollTowardOlder(context, options.scrollStepPx);
    attempts++;
    hooks.onScroll?.(attempts);
    const waited = await waitForRender(options, deadline, hooks.isCurrent);
    if (waited !== 'ready') {
      hooks.onAttempt(attempts, performance.now() - waitStarted, false, false);
      return waited === 'timeout' ? stop('incomplete', 'timeout') : stop('cancelled', waited === 'cancelled' ? 'user-cancelled' : 'conversation-changed');
    }
    const scan = hooks.scan();
    if (performance.now() >= deadline) { hooks.onAttempt(attempts, performance.now() - waitStarted, false, false); return stop('incomplete', 'timeout'); }
    if (!hooks.isCurrent()) return stop('cancelled', 'conversation-changed');
    const dateProgress = hooks.recordScan(scan);
    const moved = Math.abs(context.container.scrollTop - beforeTop) > 1;
    // Height alone is layout noise; date-bearing changes or viewport movement establish progress.
    const progress = dateProgress || moved;
    hooks.onAttempt(attempts, performance.now() - waitStarted, progress, dateProgress);
    const decision = hooks.evaluate(scan);
    if (decision) return { ...decision, attempts };
    if (scan.matches.length === 0) return stop('incomplete', 'dates-unavailable');
    stalls = progress ? 0 : stalls + 1;
    if (stalls >= 3) return stop('incomplete', context.container.scrollHeight !== beforeHeight ? 'unverified-loading-progress' : 'loading-stalled');
  }
  return stop('incomplete', 'attempt-limit');
}
