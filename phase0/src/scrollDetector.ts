import type { ConversationAdapter, ScrollContext } from './types';

/** Diagnostic candidates only; this function never chooses a loading direction. */
export function findScrollCandidates(root: HTMLElement): HTMLElement[] {
  const results: HTMLElement[] = [];
  const walker = root.ownerDocument.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
  let node: Node | null = root;
  let count = 0;
  while (node && count++ < 2000) {
    if (node instanceof HTMLElement && node.clientHeight > 0 && node.scrollHeight > node.clientHeight + 1) {
      const overflow = root.ownerDocument.defaultView?.getComputedStyle(node).overflowY;
      if (overflow === 'auto' || overflow === 'scroll') results.push(node);
    }
    node = walker.nextNode();
  }
  return results;
}

export function detectScrollContext(root: HTMLElement, adapter: ConversationAdapter): ScrollContext | undefined {
  const evidence = adapter.getScrollEvidence(root);
  if (!evidence || !evidence.container.isConnected || (evidence.container !== root && !root.contains(evidence.container))) return undefined;
  const container = evidence.container;
  const overflow = root.ownerDocument.defaultView?.getComputedStyle(container).overflowY;
  const isScrollable = container.clientHeight > 0 && container.scrollHeight > container.clientHeight + 1 && (overflow === 'auto' || overflow === 'scroll');
  return { container, olderDirection: evidence.directionVerified ? evidence.olderDirection : 'unknown', isScrollable,
    virtualizationSuspected: evidence.virtualizationSuspected ?? false };
}

/** CSS column-reverse can use negative scrollTop; do not clamp to zero. */
export function scrollTowardOlder(context: ScrollContext, step: number): void {
  if (context.olderDirection === 'unknown') throw new Error('unknown-scroll-direction');
  const top = context.container.scrollTop + (context.olderDirection === 'up' ? -step : step);
  context.container.scrollTo({ top, behavior: 'instant' });
}
