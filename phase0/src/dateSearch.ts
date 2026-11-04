import { Benchmark } from './benchmark';
import { detectConversation, sameConversation } from './conversationDetector';
import { MutationTracker } from './mutationTracker';
import { detectScrollContext } from './scrollDetector';
import { DEFAULT_SCROLL_OPTIONS, runScrollEngine, validScrollOptions } from './scrollEngine';
import type { EngineDecision } from './scrollEngine';
import { scanTimestamps, validDateISO } from './timestampDetector';
import type { BenchmarkResult, ConversationAdapter, DateSearchResult, ScrollOptions, SearchProgress, TimestampOptions, TimestampScan } from './types';

export interface DateSearchOptions {
  adapter: ConversationAdapter;
  timeZone: string;
  relativeLocale?: 'en';
  scroll?: Partial<ScrollOptions>;
  doc?: Document;
  onProgress?: (progress: SearchProgress) => void;
}

export interface SearchRun { result: DateSearchResult; benchmark: BenchmarkResult }
const activeDocuments = new WeakSet<Document>();

export async function searchDate(targetDate: string, options: DateSearchOptions): Promise<SearchRun> {
  const started = performance.now();
  const benchmark = new Benchmark();
  const doc = options.doc ?? document;
  const scroll = { ...DEFAULT_SCROLL_OPTIONS, ...options.scroll };
  let attempts = 0;
  let tracker: MutationTracker | undefined;
  let virtualized = false;
  let acquired = false;
  const finish = (status: DateSearchResult['status'], reason: string): SearchRun => {
    const result: DateSearchResult = { status, targetDate: validDateISO(targetDate) ? targetDate : '', searchDurationMs: performance.now() - started, scrollAttempts: attempts, reason,
      ...(status === 'found' ? { matchedDate: targetDate } : {}) };
    return { result, benchmark: benchmark.finish(result, tracker?.snapshot(), virtualized) };
  };
  try {
    if (!validDateISO(targetDate)) return finish('error', 'invalid-target-date');
    if (!validScrollOptions(scroll)) return finish('error', 'invalid-scroll-options');
    const timestamps: TimestampOptions = { timeZone: options.timeZone, now: Date.now(), ...(options.relativeLocale ? { relativeLocale: options.relativeLocale } : {}) };
    try { new Intl.DateTimeFormat('en-US', { timeZone: timestamps.timeZone }).format(); } catch { return finish('error', 'invalid-timezone'); }
    if (scroll.signal?.aborted) return finish('cancelled', 'user-cancelled');
    if (activeDocuments.has(doc)) return finish('error', 'search-already-running');
    activeDocuments.add(doc); acquired = true;
    const initial = detectConversation(options.adapter, doc);
    const initialPath = doc.location.pathname;
    const root = initial.conversationElement;
    if (!initial.isConversationOpen || !root) return finish('incomplete', initial.reason ?? 'conversation-unavailable');
    const context = detectScrollContext(root, options.adapter);
    virtualized = context?.virtualizationSuspected ?? false;
    tracker = new MutationTracker(root, context?.container ?? root, options.adapter);
    const isCurrent = (): boolean => {
      if (doc.location.pathname !== initialPath) return false;
      if (!sameConversation(initial, detectConversation(options.adapter, doc))) return false;
      if (!context) return true;
      const next = detectScrollContext(root, options.adapter);
      return next?.container === context.container && next.olderDirection === context.olderDirection;
    };
    const read = (): TimestampScan => {
      const scan = scanTimestamps(root, options.adapter, timestamps, context?.container);
      tracker?.observeMessages(scan.messages);
      return scan;
    };
    const notify = (scan: TimestampScan): void => {
      // UI callback failures do not change the search or expose arbitrary errors.
      try { options.onProgress?.({ status: 'searching', elapsedMs: performance.now() - started, scrollAttempts: attempts, ...(scan.range ? { range: scan.range } : {}) }); } catch { /* isolated consumer */ }
    };
    const evaluate = (scan: TimestampScan): EngineDecision | undefined => {
      if (scroll.signal?.aborted) return { status: 'cancelled', reason: 'user-cancelled' };
      if (!isCurrent()) return { status: 'cancelled', reason: 'conversation-changed' };
      if (performance.now() - started >= scroll.maxDurationMs) return { status: 'incomplete', reason: 'timeout' };
      const match = scan.matches.find((item) => item.detected.dateISO === targetDate);
      if (match) {
        match.element.scrollIntoView({ behavior: 'instant', block: 'center', inline: 'nearest' });
        return { status: 'found', reason: 'verified-message-date' };
      }
      const stats = tracker?.snapshot();
      if (options.adapter.allHistoryRendered?.(root) === true && !virtualized && !stats?.virtualizationSuspected && !stats?.processingLimited && !scan.truncated) {
        if (scan.matches.length === scan.messages.length) return { status: 'not-found', reason: 'verified-complete-rendered-history' };
        return { status: 'incomplete', reason: 'unreadable-message-dates' };
      }
      return undefined;
    };
    const first = read();
    benchmark.recordScan(first); notify(first);
    const decision = evaluate(first);
    if (decision) return finish(decision.status, decision.reason);
    if (!first.matches.length) return finish('incomplete', 'dates-unavailable');
    if (!context) return finish('incomplete', 'scroll-container-unavailable');
    const outcome = await runScrollEngine(context, scroll, {
      scan: read, isCurrent, evaluate,
      onScroll: (count) => { attempts = count; },
      recordScan: (scan) => { const progress = benchmark.recordScan(scan); notify(scan); return progress; },
      onAttempt: (count, delay, progress, batch) => { attempts = count; benchmark.recordAttempt(delay, progress, batch); },
    }, started);
    attempts = outcome.attempts;
    return finish(outcome.status, outcome.reason);
  } catch {
    return finish('error', 'dom-operation-failed');
  } finally {
    tracker?.disconnect();
    if (acquired) activeDocuments.delete(doc);
  }
}
