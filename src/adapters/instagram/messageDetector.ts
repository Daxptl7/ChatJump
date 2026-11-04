import type { MessageReference } from '../../core/messageTypes';
import type { VerifiedSelectorProfile } from './selectors';
import { MAX_MESSAGES, scopedElements, visibleStructure } from './selectors';
import { detectDateGroups } from './dateGroupDetector';
import { parseDateRules } from './timestampParser';

export interface MessageDetection { messages: MessageReference[]; limited: boolean; timestampParsingMs: number; ambiguousDates: boolean }

export function detectMessages(list: HTMLElement, profile: VerifiedSelectorProfile, keyFor: (element: HTMLElement) => string, viewport?: HTMLElement | null): MessageDetection {
  const candidates = scopedElements(list, profile.messageSelector);
  if (candidates.limited) return { messages: [], limited: true, timestampParsingMs: 0, ambiguousDates: false };
  const elements: HTMLElement[] = [];
  const selected = new Set<HTMLElement>();
  for (const element of candidates.elements) {
    if (element === list || !visibleStructure(element)) continue;
    let nested = false;
    for (let parent = element.parentElement; parent && parent !== list; parent = parent.parentElement) if (selected.has(parent)) { nested = true; break; }
    if (!nested) { elements.push(element); selected.add(element); }
    if (elements.length > MAX_MESSAGES) return { messages: [], limited: true, timestampParsingMs: 0, ambiguousDates: false };
  }
  if (candidates.limited || elements.length > MAX_MESSAGES) return { messages: [], limited: true, timestampParsingMs: 0, ambiguousDates: false };
  const started = performance.now();
  let ambiguousDates = false;
  const groups = detectDateGroups(list, elements, profile.dateGroups, profile.timestamps, () => { ambiguousDates = true; });
  const bounds = viewport?.getBoundingClientRect();
  const view = list.ownerDocument.defaultView;
  const messages = elements.map((element): MessageReference => {
    const direct = parseDateRules(element, profile.timestampRules, profile.timestamps);
    const group = groups.get(element);
    const conflict = direct.ok && group && direct.value.dateISO !== group.dateISO;
    const date = conflict ? undefined : direct.ok ? direct.value : direct.reason === 'missing' ? group : undefined;
    if (conflict || (!direct.ok && ['conflicting-dates', 'ambiguous-date'].includes(direct.reason))) ambiguousDates = true;
    const box = element.getBoundingClientRect();
    const visible = box.width > 0 && box.height > 0 && box.bottom > Math.max(0, bounds?.top ?? 0) && box.top < Math.min(view?.innerHeight ?? 0, bounds?.bottom ?? Infinity) && box.right > 0 && box.left < (view?.innerWidth ?? 0);
    return { localKey: keyFor(element), element, timestampConfidence: date?.confidence ?? 'unknown', source: date ? direct.ok ? 'direct-timestamp' : 'date-group' : 'unknown', visible,
      ...(date ? { dateISO: date.dateISO, ...(date.timestampMs === undefined ? {} : { timestampMs: date.timestampMs }) } : {}) };
  });
  return { messages, limited: false, timestampParsingMs: performance.now() - started, ambiguousDates };
}
