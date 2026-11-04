import type { ConversationAdapter, MutationStats } from './types';

/** Each DOM record and each element is counted separately from stable, verified message keys. */
export class MutationTracker {
  private observer: MutationObserver;
  private seenElements = new WeakSet<HTMLElement>();
  private seenAdded = new WeakSet<Element>();
  private seenRemoved = new WeakSet<Element>();
  private keys = new Set<string>();
  private height: number;
  private active = true;
  private stableKeysValid: boolean;
  private knownMessages = new WeakSet<HTMLElement>();
  private stats: MutationStats = { mutationEvents: 0, addedElements: 0, removedElements: 0, messageElementsObserved: 0, scrollHeightChanges: 0, virtualizationSuspected: false, processingLimited: false };

  constructor(root: HTMLElement, private container: HTMLElement, private adapter: ConversationAdapter) {
    this.height = container.scrollHeight;
    this.stableKeysValid = !!adapter.messageKey;
    this.observer = new MutationObserver((records) => this.process(records));
    this.observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['datetime', 'aria-label'], characterData: true });
  }

  private process(records: MutationRecord[]): void {
    if (!this.active) return;
    this.stats.mutationEvents += records.length;
    let budget = 4000;
    for (const record of records) {
      if (record.type !== 'childList') continue;
      for (const [nodes, seen, kind] of [[record.addedNodes, this.seenAdded, 'addedElements'], [record.removedNodes, this.seenRemoved, 'removedElements']] as const) {
        for (const node of nodes) {
          if (--budget < 0) { this.stats.processingLimited = true; break; }
          if (!(node instanceof Element)) continue;
          if (!seen.has(node)) { seen.add(node); this.stats[kind]++; }
          if (kind === 'removedElements' && (this.knownMessages.has(node as HTMLElement) || this.subtreeHadMessage(node))) this.stats.virtualizationSuspected = true;
        }
      }
      if (budget < 0) break;
    }
    this.sampleHeight();
  }

  private subtreeHadMessage(node: Element): boolean {
    const walker = node.ownerDocument.createTreeWalker(node, NodeFilter.SHOW_ELEMENT);
    let current = walker.nextNode();
    let count = 0;
    while (current && count++ < 2000) {
      if (current instanceof HTMLElement && this.knownMessages.has(current)) return true;
      current = walker.nextNode();
    }
    if (current) this.stats.processingLimited = true;
    return false;
  }

  private sampleHeight(): void {
    const height = this.container.scrollHeight;
    if (height !== this.height) { this.height = height; this.stats.scrollHeightChanges++; }
  }

  observeMessages(messages: HTMLElement[]): void {
    if (!this.active) return;
    this.flush();
    for (const message of messages.slice(0, 2000)) {
      this.knownMessages.add(message);
      if (!this.seenElements.has(message)) { this.seenElements.add(message); this.stats.messageElementsObserved++; }
      if (this.adapter.messageKey && this.stableKeysValid) {
        const key = this.adapter.messageKey(message);
        if (!key || this.keys.size >= 100_000) { this.stableKeysValid = false; this.keys.clear(); }
        else this.keys.add(key);
      }
    }
    if (messages.length > 2000) this.stats.processingLimited = true;
  }

  flush(): void { if (this.active) { this.process(this.observer.takeRecords()); this.sampleHeight(); } }

  snapshot(): MutationStats {
    this.flush();
    return { ...this.stats, ...(this.stableKeysValid ? { uniqueMessagesObserved: this.keys.size } : {}) };
  }

  disconnect(): void {
    this.flush();
    this.active = false;
    this.observer.disconnect();
    this.keys.clear();
  }
}
