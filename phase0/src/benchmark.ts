import type { BenchmarkResult, DateRange, DateSearchResult, MutationStats, TimestampScan } from './types';

/** Metrics stay in memory. Element reuse is not a verified unique-message count. */
export class Benchmark {
  private started = performance.now();
  private readings = new WeakMap<HTMLElement, string>();
  private detectedElements = new WeakSet<HTMLElement>();
  private messages = new WeakSet<HTMLElement>();
  private messagesCount = 0;
  private detectedCount = 0;
  private lastRate: number | undefined;
  private range: DateRange | undefined;
  private visibleRange: DateRange | undefined;
  private delays: number[] = [];
  private batches = 0;
  private stalled = 0;

  /** Returns true only for new date-bearing elements or changed element dates, not layout noise. */
  recordScan(scan: TimestampScan): boolean {
    let progress = false;
    for (const message of scan.messages) {
      if (!this.messages.has(message)) { this.messages.add(message); this.messagesCount++; }
    }
    for (const match of scan.matches) {
      if (this.readings.get(match.element) !== match.detected.dateISO) progress = true;
      this.readings.set(match.element, match.detected.dateISO);
      if (!this.detectedElements.has(match.element)) { this.detectedElements.add(match.element); this.detectedCount++; }
    }
    if (scan.range) {
      this.range = this.range ? { oldest: this.range.oldest < scan.range.oldest ? this.range.oldest : scan.range.oldest, newest: this.range.newest > scan.range.newest ? this.range.newest : scan.range.newest } : { ...scan.range };
    }
    this.visibleRange = scan.visibleRange;
    this.lastRate = scan.messages.length ? scan.matches.length / scan.messages.length : undefined;
    return progress;
  }

  recordAttempt(delayMs: number, progress: boolean, historyBatch = false): void {
    this.delays.push(delayMs);
    if (historyBatch) this.batches++;
    if (!progress) this.stalled++;
  }

  finish(result: DateSearchResult, stats?: MutationStats, virtualized = false): BenchmarkResult {
    return {
      durationMs: performance.now() - this.started,
      scrollAttempts: result.scrollAttempts,
      mutationEvents: stats?.mutationEvents ?? 0,
      timestampsDetected: this.detectedCount,
      ...(stats?.uniqueMessagesObserved === undefined ? {} : { uniqueMessagesObserved: stats.uniqueMessagesObserved }),
      successful: result.status === 'found', outcome: result.status,
      ...(result.reason ? { reason: result.reason } : {}),
      messageElementsObserved: stats?.messageElementsObserved ?? this.messagesCount,
      ...(this.lastRate === undefined ? {} : { timestampDetectionSuccessRate: this.lastRate }),
      ...(this.range ? { availableDateRange: { ...this.range } } : {}),
      ...(this.visibleRange ? { visibleDateRange: { ...this.visibleRange } } : {}),
      loadingDelaysMs: [...this.delays], stalledAttempts: this.stalled, historyBatchesObserved: this.batches,
      scrollHeightChanges: stats?.scrollHeightChanges ?? 0,
      virtualizationSuspected: virtualized || (stats?.virtualizationSuspected ?? false), processingLimited: stats?.processingLimited ?? false,
    };
  }
}
