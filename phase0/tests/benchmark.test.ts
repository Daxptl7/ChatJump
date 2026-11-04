import { describe, expect, it } from 'vitest';
import { Benchmark } from '../src/benchmark';
import { scanTimestamps } from '../src/timestampDetector';
import { fixture } from './fixtures';

describe('benchmark evidence', () => {
  it('separates viewport progress from newly observed date-bearing batches', () => {
    const { root, adapter } = fixture(); const benchmark = new Benchmark();
    const scan = scanTimestamps(root, adapter, { timeZone: 'UTC' });
    expect(benchmark.recordScan(scan)).toBe(true); expect(benchmark.recordScan(scan)).toBe(false);
    benchmark.recordAttempt(250, true, false);
    const result = benchmark.finish({ status: 'incomplete', targetDate: '2026-10-04', searchDurationMs: 250, scrollAttempts: 1, reason: 'attempt-limit' });
    expect(result).toMatchObject({ successful: false, timestampsDetected: 1, timestampDetectionSuccessRate: 1, historyBatchesObserved: 0, stalledAttempts: 0 });
    expect(result).not.toHaveProperty('uniqueMessagesObserved');
  });
  it('treats changed dates on a reused node as progress without inflating element counts', () => {
    const { root, adapter } = fixture(); const benchmark = new Benchmark();
    benchmark.recordScan(scanTimestamps(root, adapter, { timeZone: 'UTC' })); root.querySelector('time')!.dateTime = '2026-10-04';
    expect(benchmark.recordScan(scanTimestamps(root, adapter, { timeZone: 'UTC' }))).toBe(true);
    const result = benchmark.finish({ status: 'found', targetDate: '2026-10-04', searchDurationMs: 0, scrollAttempts: 0 });
    expect(result).toMatchObject({ timestampsDetected: 1, messageElementsObserved: 1, availableDateRange: { oldest: '2026-10-04', newest: '2026-11-04' } });
  });
});
