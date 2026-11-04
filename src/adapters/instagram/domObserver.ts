import type { VerifiedSelectorProfile } from './selectors';
import { MAX_ELEMENTS } from './selectors';

export interface MutationSummary { records: number; processingMs: number; removedKnownMessage: boolean }

/** Exactly one scoped observer and one coalescing timer, with no retained MutationRecords. */
export class ConversationDOMObserver {
  private observer: MutationObserver | undefined;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private root: HTMLElement | undefined;
  private pending = 0;
  private elapsed = 0;
  private removed = false;

  get active(): boolean { return this.observer !== undefined; }

  start(root: HTMLElement, profile: VerifiedSelectorProfile, isKnownMessage: (element: HTMLElement) => boolean, onChange: (summary: MutationSummary) => void): void {
    if (this.root === root && this.observer) return;
    this.stop();
    const dateSelectors = [...profile.timestampRules.filter((rule) => rule.read === 'leaf-text').map((rule) => rule.selector)];
    if (profile.dateGroups) dateSelectors.push(profile.dateGroups.separatorSelector);
    for (const selector of dateSelectors) root.matches(selector); // Validate before any asynchronous callback.
    this.observer = new MutationObserver((records) => {
      const started = performance.now();
      let relevant = 0;
      let removalBudget = MAX_ELEMENTS;
      for (const record of records.slice(0, MAX_ELEMENTS)) {
        if (record.type === 'characterData' && !dateSelectors.some((selector) => record.target.parentElement?.closest(selector))) continue;
        relevant++;
        if (record.type === 'childList') for (const node of record.removedNodes) {
          if (--removalBudget < 0) { this.removed = true; break; }
          if (!(node instanceof HTMLElement)) continue;
          if (isKnownMessage(node)) { this.removed = true; continue; }
          const walker = node.ownerDocument.createTreeWalker(node, NodeFilter.SHOW_ELEMENT);
          let next = walker.nextNode();
          while (next && removalBudget-- > 0) {
            if (next instanceof HTMLElement && isKnownMessage(next)) { this.removed = true; break; }
            next = walker.nextNode();
          }
        }
      }
      if (!relevant) return;
      this.pending += records.length > MAX_ELEMENTS ? records.length : relevant;
      this.elapsed += performance.now() - started;
      if (this.timer !== undefined) return;
      this.timer = setTimeout(() => {
        this.timer = undefined;
        const summary = { records: this.pending, processingMs: this.elapsed, removedKnownMessage: this.removed };
        this.pending = 0; this.elapsed = 0; this.removed = false;
        onChange(summary);
      }, 100);
    });
    try {
      this.observer.observe(root, { childList: true, subtree: true, characterData: true, attributes: true,
        attributeFilter: [...new Set(['datetime', 'aria-label', 'hidden', 'aria-hidden', profile.conversationKeyAttribute])] });
      this.root = root;
    } catch (error) { this.stop(); throw error; }
  }

  stop(): void {
    this.observer?.disconnect(); this.observer = undefined;
    clearTimeout(this.timer); this.timer = undefined;
    this.root = undefined; this.pending = 0; this.elapsed = 0; this.removed = false;
  }
}
