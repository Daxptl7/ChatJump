import type { ConversationAdapter, ConversationContext } from './types';

export function isInstagram(url: URL): boolean {
  return url.protocol === 'https:' && ['instagram.com', 'www.instagram.com'].includes(url.hostname) && !url.port;
}

/** Route shape is a candidate, NOT a claim of live Instagram compatibility. */
export function isCandidateConversationRoute(url: URL): boolean {
  return /^\/direct\/t\/[^/]+\/?$/.test(url.pathname);
}

export function detectConversation(adapter: ConversationAdapter, doc: Document = document): ConversationContext {
  const detectedAt = performance.now();
  const failure = (reason: string): ConversationContext => ({ isConversationOpen: false, detectedAt, reason });
  try {
    const url = new URL(doc.location.href);
    if (!isInstagram(url)) return failure('unsupported-site');
    if (adapter.verification !== 'manual') return failure('adapter-unverified');
    if (!(adapter.routeMatches ?? isCandidateConversationRoute)(url)) return failure('unsupported-route');
    const root = adapter.resolveConversation(doc);
    if (!root?.isConnected || root.ownerDocument !== doc || root === doc.body || root === doc.documentElement || root.hidden || root.closest('[hidden], [aria-hidden="true"]')) return failure('conversation-unavailable');
    const style = doc.defaultView?.getComputedStyle(root);
    if (style?.display === 'none' || style?.visibility === 'hidden') return failure('conversation-unavailable');
    const key = adapter.conversationKey(root);
    if (!key) return failure('conversation-identity-unavailable');
    return { isConversationOpen: true, conversationId: key, conversationElement: root, detectedAt };
  } catch {
    // Never propagate arbitrary adapter errors, which could contain private data.
    return failure('adapter-failed');
  }
}

export function sameConversation(a: ConversationContext, b: ConversationContext): boolean {
  return a.isConversationOpen && b.isConversationOpen && a.conversationId === b.conversationId && a.conversationElement === b.conversationElement;
}

/** Polls route/key/root without patching Instagram's History API or observing the document. */
export function watchConversation(adapter: ConversationAdapter, onChange: () => void, doc: Document = document): () => void {
  let previous = detectConversation(adapter, doc);
  let previousPath = doc.location.pathname;
  const timer = setInterval(() => {
    const next = detectConversation(adapter, doc);
    const path = doc.location.pathname;
    const changed = previousPath !== path || previous.isConversationOpen !== next.isConversationOpen ||
      (next.isConversationOpen && !sameConversation(previous, next));
    previous = next; previousPath = path;
    if (changed) onChange();
  }, 200);
  return () => clearInterval(timer);
}
