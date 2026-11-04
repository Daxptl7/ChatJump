import { semanticTimestampCandidates } from '../src/adapter';
import type { ConversationAdapter, ScrollContext, ScrollOptions, TimestampScan } from '../src/types';

/** Every selector here belongs to a synthetic fixture, never Instagram. */
export function fixture(dates: Array<string | null> = ['2026-11-04']): { root: HTMLElement; adapter: ConversationAdapter; add: (date: string | null) => HTMLElement; context: ScrollContext } {
  const root = document.createElement('section');
  root.dataset.key = 'synthetic-thread';
  root.style.overflowY = 'auto';
  document.body.append(root);
  Object.defineProperties(root, { clientHeight: { configurable: true, value: 200 }, scrollHeight: { configurable: true, get: () => 1000 } });
  root.scrollTop = 800;
  let nextId = 0;
  const add = (date: string | null): HTMLElement => {
    const message = document.createElement('article');
    message.dataset.message = String(nextId++);
    if (date !== null) { const time = document.createElement('time'); time.dateTime = date; message.append(time); }
    root.append(message);
    return message;
  };
  dates.forEach(add);
  const adapter: ConversationAdapter = {
    verification: 'manual', resolveConversation: () => root,
    conversationKey: (element) => element.dataset.key,
    getMessages: (element) => [...element.querySelectorAll<HTMLElement>('article')],
    getTimestampCandidates: (message) => semanticTimestampCandidates(message, true),
    getScrollEvidence: () => ({ container: root, olderDirection: 'up', directionVerified: true }),
  };
  return { root, adapter, add, context: { container: root, olderDirection: 'up', isScrollable: true, virtualizationSuspected: false } };
}

export const scrollOptions: ScrollOptions = { maxAttempts: 5, maxDurationMs: 10_000, scrollStepPx: 100, delayMs: 250 };
export const emptyScan = (): TimestampScan => ({ messages: [], matches: [], failures: {}, truncated: false });
