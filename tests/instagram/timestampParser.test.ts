import { describe, expect, it } from 'vitest';
import { parseDateRules, parseDateValue } from '../../src/adapters/instagram/timestampParser';
import { profile } from './fixtures';

const settings = profile().timestamps;
describe('Phase 2 timestamp normalization', () => {
  it.each(['2026-11-04', '2025-12-31', '2024-02-29'])('keeps calendar date %s without manufacturing a timestamp', (date) => expect(parseDateValue(date, 'date-separator', settings)).toEqual({ ok: true, value: { dateISO: date, source: 'date-separator', precision: 'calendar-date', confidence: 'medium' } }));
  it.each(['2026-02-30', '2026-13-01', '2026-11-04T24:00Z'])('rejects invalid date %s', (date) => expect(parseDateValue(date, 'time-element', settings)).toMatchObject({ ok: false, reason: 'invalid-date' }));
  it('preserves an instant and normalizes through a year boundary', () => expect(parseDateValue('2026-12-31T23:30:00Z', 'datetime-attribute', { ...settings, timeZone: 'Asia/Kolkata' })).toMatchObject({ ok: true, value: { dateISO: '2027-01-01', timestampMs: Date.parse('2026-12-31T23:30:00Z'), precision: 'instant' } }));
  it('handles relative dates across month and DST boundaries', () => {
    expect(parseDateValue('Yesterday', 'relative-label', { ...settings, now: Date.parse('2026-03-01T12:00Z') })).toMatchObject({ ok: true, value: { dateISO: '2026-02-28' } });
    expect(parseDateValue('Yesterday', 'relative-label', { ...settings, timeZone: 'America/New_York', now: Date.parse('2026-03-09T04:30Z') })).toMatchObject({ ok: true, value: { dateISO: '2026-03-08' } });
  });
  it.each([['October 15, 2026', 'en-US'], ['15 octobre 2026', 'fr-FR'], ['15 Oktober 2026', 'de-DE']])('uses configured locale for %s', (value, locale) => expect(parseDateValue(value, 'date-separator', { ...settings, locale })).toMatchObject({ ok: true, value: { dateISO: '2026-10-15' } }));
  it('supports an explicitly configured numeric order and refuses to infer one', () => {
    expect(parseDateValue('04/11/2026', 'aria-label', settings)).toMatchObject({ ok: false, reason: 'ambiguous-date' });
    expect(parseDateValue('04/11/2026', 'aria-label', { ...settings, numericDateOrder: 'DMY' })).toMatchObject({ ok: true, value: { dateISO: '2026-11-04' } });
    expect(parseDateValue('11/04/2026', 'aria-label', { ...settings, numericDateOrder: 'MDY' })).toMatchObject({ ok: true, value: { dateISO: '2026-11-04' } });
  });
  it('rejects yearless, local-time, unrelated, and empty strings', () => {
    expect(parseDateValue('October 15', 'date-separator', settings)).toMatchObject({ ok: false, reason: 'missing-year' });
    expect(parseDateValue('2026-11-04T12:00', 'aria-label', settings)).toMatchObject({ ok: false, reason: 'ambiguous-date' });
    expect(parseDateValue('PRIVATE PERSON Today', 'aria-label', settings).ok).toBe(false);
    expect(parseDateValue('', 'time-element', settings)).toMatchObject({ ok: false, reason: 'missing' });
  });
  it('requires independently verified timezone settings', () => {
    expect(parseDateValue('2026-11-04', 'time-element', { ...settings, displayTimeZoneVerified: false })).toMatchObject({ ok: false, reason: 'timezone-unverified' });
    expect(parseDateValue('04/11/2026', 'time-element', { ...settings, timeZone: 'bad/zone', numericDateOrder: 'DMY' })).toMatchObject({ ok: false, reason: 'invalid-timezone' });
  });
  it('extracts only confirmed date attributes and rejects conflicting or excessive candidates', () => {
    const root = document.createElement('article'); root.innerHTML = '<p>UNRELATED DATE 2026-11-04</p><time datetime="2026-11-04"></time>';
    expect(parseDateRules(root, profile().timestampRules, settings)).toMatchObject({ ok: true, value: { dateISO: '2026-11-04' } });
    root.insertAdjacentHTML('beforeend', '<time datetime="2026-11-03"></time>');
    expect(parseDateRules(root, profile().timestampRules, settings)).toMatchObject({ ok: false, reason: 'conflicting-dates' });
    root.innerHTML = '<time datetime="2026-11-04"></time>'.repeat(20);
    expect(parseDateRules(root, profile().timestampRules, settings)).toMatchObject({ ok: false, reason: 'scan-limit' });
  });
  it('retains the agreed date but refuses to choose between different instants on that date', () => {
    const root = document.createElement('article'); root.innerHTML = '<time datetime="2026-11-04T10:00Z"></time><time datetime="2026-11-04T11:00Z"></time>';
    expect(parseDateRules(root, profile().timestampRules, settings)).toEqual({ ok: true, value: { dateISO: '2026-11-04', source: 'time-element', precision: 'calendar-date', confidence: 'medium' } });
  });
});
