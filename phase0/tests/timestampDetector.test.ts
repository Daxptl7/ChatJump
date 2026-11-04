import { describe, expect, it } from 'vitest';
import { parseTimestamp, scanTimestamps, validDateISO } from '../src/timestampDetector';
import type { TimestampCandidate, TimestampOptions } from '../src/types';
import { fixture } from './fixtures';

const candidate = (value: string, source: TimestampCandidate['source'] = 'time-element'): TimestampCandidate => ({ element: document.createElement('time'), value, source, associationVerified: true });
const options: TimestampOptions = { timeZone: 'UTC', relativeLocale: 'en', now: Date.parse('2026-01-01T01:00:00Z') };

describe('strict timestamp detection', () => {
  it.each(['2026-11-04', '2026-02-28', '2024-02-29', '2025-12-31', '2026-01-01'])('preserves calendar day %s without inventing a time', (value) => {
    const result = parseTimestamp(candidate(value), options);
    expect(result).toEqual({ ok: true, value: { dateISO: value, source: 'time-element', confidence: 'medium' } });
  });
  it.each(['2026-02-29', '2026-02-30', '2026-13-01', '2026-00-01', '2026-04-31', '0000-01-01', '2026-1-01', '2026-01-00'])('rejects invalid ISO date %s', (value) => expect(validDateISO(value)).toBe(false));
  it.each(['2026-02-30T12:00:00Z', '2026-11-04T24:00Z', '2026-11-04T10:60Z', '2026-11-04T10:00:60Z', '2026-11-04T10:00+14:30'])('rejects normalized invalid instants %s', (value) => expect(parseTimestamp(candidate(value), options)).toMatchObject({ ok: false, reason: 'invalid-date' }));
  it('normalizes exact instants into the explicit calendar zone', () => {
    expect(parseTimestamp(candidate('2026-12-31T23:30:00Z'), { timeZone: 'Asia/Kolkata' })).toMatchObject({ ok: true, value: { dateISO: '2027-01-01', timestamp: Date.parse('2026-12-31T23:30:00Z'), confidence: 'high' } });
    expect(parseTimestamp(candidate('2026-01-01T00:30:00+05:30'), options)).toMatchObject({ ok: true, value: { dateISO: '2025-12-31' } });
  });
  it('handles a daylight-saving transition using the zone, not the host timezone', () => expect(parseTimestamp(candidate('2026-03-08T07:30:00Z'), { timeZone: 'America/New_York' })).toMatchObject({ ok: true, value: { dateISO: '2026-03-08' } }));
  it.each([['Today', '2026-01-01'], ['Yesterday', '2025-12-31']])('resolves relative day %s across years', (value, dateISO) => expect(parseTimestamp(candidate(value, 'relative-time'), options)).toMatchObject({ ok: true, value: { dateISO, confidence: 'medium' } }));
  it('uses calendar subtraction over a DST boundary', () => expect(parseTimestamp(candidate('Yesterday', 'relative-time'), { timeZone: 'America/New_York', relativeLocale: 'en', now: Date.parse('2026-03-09T04:30:00Z') })).toMatchObject({ ok: true, value: { dateISO: '2026-03-08' } }));
  it('resolves Yesterday across months in the explicit zone', () => expect(parseTimestamp(candidate('Yesterday'), { ...options, now: Date.parse('2026-03-01T12:00:00Z') })).toMatchObject({ ok: true, value: { dateISO: '2026-02-28' } }));
  it('requires an explicit locale for relative dates', () => expect(parseTimestamp(candidate('Today'), { timeZone: 'UTC' })).toMatchObject({ ok: false, reason: 'unsupported-format' }));
  it('accepts a full English calendar date with year', () => expect(parseTimestamp(candidate('November 4, 2026', 'aria-label'), options)).toMatchObject({ ok: true, value: { dateISO: '2026-11-04' } }));
  it.each(['01/02/2026', '2026-11-04T12:00:00', 'Monday'])('reports ambiguity for %s', (value) => expect(parseTimestamp(candidate(value), options)).toMatchObject({ ok: false, reason: 'ambiguous-date' }));
  it.each(['Alice · Today', 'Seen 2026-11-04', 'November 4', '2 days ago'])('does not guess from unrelated or unsupported text %s', (value) => expect(parseTimestamp(candidate(value), options).ok).toBe(false));
  it('rejects an unverified association and a bad zone', () => {
    expect(parseTimestamp({ ...candidate('2026-11-04'), associationVerified: false }, options)).toEqual({ ok: false, reason: 'unverified-association' });
    expect(parseTimestamp(candidate('2026-11-04'), { timeZone: 'made/up' })).toEqual({ ok: false, reason: 'invalid-timezone' });
  });
  it('reports missing timestamps without guessing from message text', () => {
    const { root, adapter } = fixture([null]); root.querySelector('article')!.textContent = 'Today November 4, 2026';
    expect(scanTimestamps(root, adapter, options)).toMatchObject({ matches: [], failures: { missing: 1 } });
  });
  it('requires a verified separator relationship for each affected message', () => {
    const { root, adapter } = fixture([null]); const separator = document.createElement('div'); separator.textContent = '2026-11-04'; root.prepend(separator);
    adapter.getTimestampCandidates = () => [{ element: separator, value: separator.textContent!, source: 'date-separator', associationVerified: false }];
    expect(scanTimestamps(root, adapter, options).matches).toHaveLength(0);
    adapter.getTimestampCandidates = () => [{ element: separator, value: separator.textContent!, source: 'date-separator', associationVerified: true }];
    expect(scanTimestamps(root, adapter, options).matches[0]?.detected).toMatchObject({ dateISO: '2026-11-04', source: 'date-separator' });
  });
  it('rejects conflicting dates associated with one message', () => {
    const { root, adapter } = fixture(); adapter.getTimestampCandidates = () => [candidate('2026-11-04'), candidate('2026-11-03')];
    expect(scanTimestamps(root, adapter, options)).toMatchObject({ matches: [], failures: { 'conflicting-dates': 1 } });
  });
  it('computes a rendered range independent of DOM ordering', () => {
    const { root, adapter } = fixture(['2026-11-04', '2025-12-31', '2026-02-03']);
    expect(scanTimestamps(root, adapter, options).range).toEqual({ oldest: '2025-12-31', newest: '2026-11-04' });
  });
  it('distinguishes the visible viewport range from all rendered dates', () => {
    const { root, adapter } = fixture(['2026-11-04', '2026-10-04']); const messages = adapter.getMessages(root);
    root.getBoundingClientRect = () => ({ top: 0, bottom: 200, height: 200 } as DOMRect);
    messages[0]!.getBoundingClientRect = () => ({ top: 50, bottom: 100, height: 50 } as DOMRect);
    messages[1]!.getBoundingClientRect = () => ({ top: -100, bottom: -50, height: 50 } as DOMRect);
    expect(scanTimestamps(root, adapter, options, root)).toMatchObject({ range: { oldest: '2026-10-04', newest: '2026-11-04' }, visibleRange: { oldest: '2026-11-04', newest: '2026-11-04' } });
  });
  it('flags message truncation and caps timestamp candidate processing', () => {
    const { root, adapter, add } = fixture([]); for (let i = 0; i < 2001; i++) add('2026-11-04');
    const scan = scanTimestamps(root, adapter, options); expect(scan.messages).toHaveLength(2000); expect(scan.truncated).toBe(true);
    adapter.getMessages = () => [root.querySelector<HTMLElement>('article')!];
    adapter.getTimestampCandidates = () => Array.from({ length: 21 }, () => candidate('2026-11-04'));
    expect(scanTimestamps(root, adapter, options)).toMatchObject({ matches: [], failures: { 'scan-limit': 1 } });
  });
});
