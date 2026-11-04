import type { ConversationAdapter, DateRange, DetectedTimestamp, TimestampCandidate, TimestampOptions, TimestampParseResult, TimestampScan } from './types';

export function validDateISO(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1000-01-01') return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function dateInZone(timestamp: number, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(timestamp);
  const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function parseTimestamp(candidate: TimestampCandidate, options: TimestampOptions): TimestampParseResult {
  if (!candidate.associationVerified) return { ok: false, reason: 'unverified-association' };
  try { dateInZone(options.now ?? Date.now(), options.timeZone); } catch { return { ok: false, reason: 'invalid-timezone' }; }
  const input = candidate.value.trim().replace(/\s+/g, ' ');
  if (!input) return { ok: false, reason: 'missing' };
  const success = (dateISO: string, confidence: DetectedTimestamp['confidence'], timestamp?: number): TimestampParseResult => ({
    ok: true, value: { dateISO, source: candidate.source, confidence, ...(timestamp === undefined ? {} : { timestamp }) },
  });
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return validDateISO(input) ? success(input, 'medium') : { ok: false, reason: 'invalid-date' };

  // No browser-dependent Date.parse of free-form labels or local date-times.
  const instant = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|([+-])(\d{2}):(\d{2}))$/.exec(input);
  if (instant) {
    const [, day, hour, minute, second, , zone, , offsetHour, offsetMinute] = instant;
    const offset = Number(offsetHour ?? 0) * 60 + Number(offsetMinute ?? 0);
    if (!validDateISO(day!) || Number(hour) > 23 || Number(minute) > 59 || Number(second ?? 0) > 59 || Number(offsetMinute ?? 0) > 59 || offset > 840) return { ok: false, reason: 'invalid-date' };
    const timestamp = Date.parse(input);
    if (!zone || !Number.isFinite(timestamp)) return { ok: false, reason: 'invalid-date' };
    const normalized = dateInZone(timestamp, options.timeZone);
    return validDateISO(normalized) ? success(normalized, 'high', timestamp) : { ok: false, reason: 'invalid-date' };
  }

  if (/^(today|yesterday)$/i.test(input)) {
    if (options.relativeLocale !== 'en') return { ok: false, reason: 'unsupported-format' };
    const today = dateInZone(options.now ?? Date.now(), options.timeZone);
    const day = new Date(`${today}T00:00:00.000Z`);
    if (input.toLowerCase() === 'yesterday') day.setUTCDate(day.getUTCDate() - 1);
    return success(day.toISOString().slice(0, 10), 'medium');
  }

  // Full year required. Locale is explicitly English; month-only labels are ambiguous.
  const english = /^(January|February|March|April|May|June|July|August|September|October|November|December) (\d{1,2}), (\d{4})$/i.exec(input);
  if (english && options.relativeLocale === 'en') {
    const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    const iso = `${english[3]}-${String(months.indexOf(english[1]!.toLowerCase()) + 1).padStart(2, '0')}-${english[2]!.padStart(2, '0')}`;
    return validDateISO(iso) ? success(iso, 'medium') : { ok: false, reason: 'invalid-date' };
  }
  if (/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(input)) return { ok: false, reason: 'invalid-date' };
  if (/^\d{1,2}[/.-]\d{1,2}|^\d{4}-\d{2}-\d{2}[T ]|^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\b/i.test(input)) return { ok: false, reason: 'ambiguous-date' };
  return { ok: false, reason: 'unsupported-format' };
}

export function rangeOf(dates: string[]): DateRange | undefined {
  if (!dates.length) return undefined;
  let oldest = dates[0]!;
  let newest = oldest;
  for (const date of dates) { if (date < oldest) oldest = date; if (date > newest) newest = date; }
  return { oldest, newest };
}

export function scanTimestamps(root: HTMLElement, adapter: ConversationAdapter, options: TimestampOptions, viewport?: HTMLElement): TimestampScan {
  const all = [...new Set(adapter.getMessages(root))].filter((element) => element.isConnected && element !== root && root.contains(element));
  const scan: TimestampScan = { messages: all.slice(0, 2000), matches: [], failures: {}, truncated: all.length > 2000 };
  if (scan.truncated) scan.failures['scan-limit'] = all.length - 2000;
  const visible: string[] = [];
  const bounds = viewport?.getBoundingClientRect();
  for (const element of scan.messages) {
    const candidates = adapter.getTimestampCandidates(element, root);
    const results = candidates.slice(0, 20).map((candidate) => parseTimestamp(candidate, options));
    const parsed = results.flatMap((result) => result.ok ? [result.value] : []);
    const dates = new Set(parsed.map((value) => value.dateISO));
    if (candidates.length > 20) { scan.failures['scan-limit'] = (scan.failures['scan-limit'] ?? 0) + 1; continue; }
    if (dates.size > 1) { scan.failures['conflicting-dates'] = (scan.failures['conflicting-dates'] ?? 0) + 1; continue; }
    const detected = parsed.sort((a, b) => Number(b.confidence === 'high') - Number(a.confidence === 'high'))[0];
    if (detected) {
      scan.matches.push({ element, detected });
      const box = element.getBoundingClientRect();
      if (bounds && box.height > 0 && box.bottom > bounds.top && box.top < bounds.bottom) visible.push(detected.dateISO);
    } else {
      const failure = results.find((result) => !result.ok);
      const reason = failure && !failure.ok ? failure.reason : 'missing';
      scan.failures[reason] = (scan.failures[reason] ?? 0) + 1;
    }
  }
  const range = rangeOf(scan.matches.map((match) => match.detected.dateISO));
  if (range) scan.range = range;
  const visibleRange = rangeOf(visible);
  if (visibleRange) scan.visibleRange = visibleRange;
  return scan;
}
