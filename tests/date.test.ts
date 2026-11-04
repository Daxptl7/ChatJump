import { describe, expect, it } from 'vitest';
import { localToday, validateSelectedDate } from '../src/utils/date';
describe('calendar selection', () => {
  it('formats local calendar values without UTC day shifts', () => expect(localToday(new Date(2026, 0, 1, 0, 30))).toBe('2026-01-01'));
  it.each(['2026-02-30', '2026-2-04', '04/11/2026', '0000-01-01'])('rejects invalid date %s', (value) => expect(validateSelectedDate(value, '2026-11-04')).toBe('Enter a valid calendar date.'));
  it('accepts leap days and today, but rejects future days', () => {
    expect(validateSelectedDate('2024-02-29', '2026-11-04')).toBeUndefined(); expect(validateSelectedDate('2026-11-04', '2026-11-04')).toBeUndefined(); expect(validateSelectedDate('2026-11-05', '2026-11-04')).toBe('Choose today or an earlier date.');
  });
});
