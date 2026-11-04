import { dateInZone, parseTimestamp, validDateISO } from '../../../phase0/src/timestampDetector';
import type { ParsedTimestamp } from '../../core/messageTypes';
import type { TimestampRule, TimestampSettings } from './selectors';
import { scopedElements } from './selectors';

export type ParseFailure = 'missing' | 'invalid-date' | 'ambiguous-date' | 'unsupported-format' | 'missing-year' | 'unverified-association' | 'timezone-unverified' | 'invalid-timezone' | 'conflicting-dates' | 'scan-limit';
export type ParsedResult = { ok: true; value: ParsedTimestamp } | { ok: false; reason: ParseFailure };

export function parseDateValue(value: string, source: ParsedTimestamp['source'], settings: TimestampSettings, contextElement: HTMLElement = document.createElement('time')): ParsedResult {
  if (!settings.displayTimeZoneVerified) return { ok: false, reason: 'timezone-unverified' };
  try { dateInZone(settings.now ?? Date.now(), settings.timeZone); } catch { return { ok: false, reason: 'invalid-timezone' }; }
  const input = value.trim().replace(/\s+/g, ' ');
  if (input.length > 128) return { ok: false, reason: 'unsupported-format' };
  const candidate = { element: contextElement, value: input, source: source === 'relative-label' ? 'relative-time' as const : source, associationVerified: true };
  const parsed = parseTimestamp(candidate, { timeZone: settings.timeZone, ...(settings.now === undefined ? {} : { now: settings.now }), ...(settings.locale?.startsWith('en') ? { relativeLocale: 'en' as const } : {}) });
  if (parsed.ok) return { ok: true, value: { dateISO: parsed.value.dateISO, source, precision: parsed.value.timestamp === undefined ? 'calendar-date' : 'instant', confidence: parsed.value.confidence, ...(parsed.value.timestamp === undefined ? {} : { timestampMs: parsed.value.timestamp }) } };
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return { ok: false, reason: 'invalid-date' };
  if (['missing', 'invalid-date', 'invalid-timezone', 'ambiguous-date'].includes(parsed.reason) && !/^\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}$/.test(input)) return { ok: false, reason: parsed.reason as ParseFailure };
  const calendar = (dateISO: string): ParsedResult => validDateISO(dateISO) ? { ok: true, value: { dateISO, source, precision: 'calendar-date', confidence: 'medium' } } : { ok: false, reason: 'invalid-date' };
  if (/^\d{1,4}[/.-]\d{1,2}[/.-]\d{1,4}$/.test(input)) {
    if (!settings.numericDateOrder) return { ok: false, reason: 'ambiguous-date' };
    const parts = input.split(/[/.-]/);
    const order = settings.numericDateOrder;
    const year = parts[order.indexOf('Y')]!;
    if (year.length !== 4) return { ok: false, reason: 'missing-year' };
    return calendar(`${year}-${parts[order.indexOf('M')]!.padStart(2, '0')}-${parts[order.indexOf('D')]!.padStart(2, '0')}`);
  }
  if (settings.locale) {
    try {
      const language = new Intl.Locale(settings.locale).language;
      const relative: Record<string, readonly string[]> = { en: ['today', 'yesterday'], fr: ["aujourd’hui", 'hier'], es: ['hoy', 'ayer'], de: ['heute', 'gestern'] };
      const relativeIndex = relative[language]?.indexOf(input.toLocaleLowerCase(settings.locale));
      if (relativeIndex !== undefined && relativeIndex >= 0) {
        const today = dateInZone(settings.now ?? Date.now(), settings.timeZone);
        const date = new Date(`${today}T00:00:00.000Z`); date.setUTCDate(date.getUTCDate() - relativeIndex);
        return calendar(date.toISOString().slice(0, 10));
      }
      const normalized = input.normalize('NFC').toLocaleLowerCase(settings.locale).replace(/,/g, '');
      for (let month = 0; month < 12; month++) {
        const name = new Intl.DateTimeFormat(settings.locale, { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, month, 1))).normalize('NFC').toLocaleLowerCase(settings.locale);
        const words = normalized.split(' ');
        const index = words.indexOf(name);
        if (index >= 0 && words.length === 3 && (index === 0 || index === 1)) {
          const day = words[index === 0 ? 1 : 0]!;
          const year = words[2]!;
          if (!/^\d{4}$/.test(year)) return { ok: false, reason: 'missing-year' };
          if (/^\d{1,2}$/.test(day)) return calendar(`${year}-${String(month + 1).padStart(2, '0')}-${day.padStart(2, '0')}`);
        }
      }
    } catch { return { ok: false, reason: 'unsupported-format' }; }
  }
  if (!/\b\d{4}\b/.test(input) && /\d/.test(input)) return { ok: false, reason: 'missing-year' };
  return { ok: false, reason: parsed.reason === 'unverified-association' ? 'unverified-association' : 'unsupported-format' };
}

/** Reads ONLY explicitly verified date nodes; never message text or arbitrary labels. */
export function parseDateRules(root: HTMLElement, rules: readonly TimestampRule[], settings: TimestampSettings): ParsedResult {
  const found: ParsedTimestamp[] = [];
  let failure: ParseFailure = 'missing';
  let candidates = 0;
  for (const rule of rules.slice(0, 8)) {
    if (rule.associationVerified !== true) return { ok: false, reason: 'unverified-association' };
    const nodes = scopedElements(root, rule.selector, 8);
    if (nodes.limited || ++candidates > 16) return { ok: false, reason: 'scan-limit' };
    for (const element of nodes.elements) {
      if (++candidates > 16) return { ok: false, reason: 'scan-limit' };
      let value: string | null = null;
      if (rule.read === 'leaf-text') { if (!element.children.length) value = element.textContent; }
      else value = element.getAttribute(rule.read);
      if (!value?.trim()) continue;
      const parsed = parseDateValue(value, rule.source, settings, element);
      if (parsed.ok) found.push(parsed.value); else failure = parsed.reason;
    }
  }
  if (rules.length > 8) return { ok: false, reason: 'scan-limit' };
  if (new Set(found.map((item) => item.dateISO)).size > 1) return { ok: false, reason: 'conflicting-dates' };
  if (failure !== 'missing') return { ok: false, reason: failure };
  if (new Set(found.flatMap((item) => item.timestampMs === undefined ? [] : [item.timestampMs])).size > 1) {
    // The calendar day agrees, but an exact message clock time cannot be chosen safely.
    const first = found[0]!;
    return { ok: true, value: { dateISO: first.dateISO, source: first.source, precision: 'calendar-date', confidence: 'medium' } };
  }
  const value = found.find((item) => item.precision === 'instant') ?? found[0];
  return value ? { ok: true, value } : { ok: false, reason: failure };
}
