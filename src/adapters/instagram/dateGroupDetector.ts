import type { ParsedTimestamp } from '../../core/messageTypes';
import type { DateGroupStrategy, TimestampSettings } from './selectors';
import { MAX_ELEMENTS, scopedElements } from './selectors';
import { parseDateRules } from './timestampParser';

export function detectDateGroups(list: HTMLElement, messages: HTMLElement[], strategy: DateGroupStrategy | undefined, settings: TimestampSettings, onAmbiguous: () => void = () => {}): Map<HTMLElement, ParsedTimestamp> {
  const result = new Map<HTMLElement, ParsedTimestamp>();
  if (!strategy || strategy.associationVerified !== true) return result;
  const parse = (separator: HTMLElement): ParsedTimestamp | undefined => {
    const parsed = parseDateRules(separator, [strategy.dateRule], settings);
    if (!parsed.ok && parsed.reason !== 'missing') onAmbiguous();
    return parsed.ok ? { dateISO: parsed.value.dateISO, source: 'date-separator', precision: 'calendar-date', confidence: 'medium' } : undefined;
  };
  if (strategy.kind === 'contained') {
    const cache = new Map<HTMLElement, ParsedTimestamp | undefined>();
    for (const message of messages) {
      const group = message.closest<HTMLElement>(strategy.groupSelector);
      if (!group || group === list || !list.contains(group)) continue;
      if (!cache.has(group)) {
        const separators = scopedElements(group, strategy.separatorSelector, 2);
        if (separators.limited || separators.elements.length > 1) onAmbiguous();
        cache.set(group, !separators.limited && separators.elements.length === 1 ? parse(separators.elements[0]!) : undefined);
      }
      const date = cache.get(group);
      if (date) result.set(message, date);
    }
    return result;
  }
  if (strategy.orderingVerified !== true || list.children.length > MAX_ELEMENTS) return result;
  const children = Array.from(list.children);
  if (strategy.direction === 'backward') children.reverse();
  const known = new Set(messages);
  let date: ParsedTimestamp | undefined;
  for (const child of children) {
    if (!(child instanceof HTMLElement)) { date = undefined; continue; }
    if (child.matches(strategy.separatorSelector)) date = parse(child);
    else if (known.has(child)) { if (date) result.set(child, date); }
    else date = undefined; // Unknown boundaries cannot carry a date into the next group.
  }
  return result;
}
