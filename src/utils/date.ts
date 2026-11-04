// Reuse only the pure Phase 0 date validator. The unverified navigation engine is not imported.
import { validDateISO } from '../../phase0/src/timestampDetector';

export function localToday(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

export function validateSelectedDate(value: string, today = localToday()): string | undefined {
  if (!value) return 'Select a date.';
  if (!validDateISO(value)) return 'Enter a valid calendar date.';
  if (value > today) return 'Choose today or an earlier date.';
  return undefined;
}
