import type { ConversationAdapter, TimestampCandidate } from './types';

export interface ManualAttributeAdapterConfig {
  verification: 'manual';
  conversationSelector: string;
  /** Must be an observed opaque identity attribute that changes on conversation switches. */
  conversationKeyAttribute: string;
  messageSelector: string;
  /** Use :scope if the conversation root itself scrolls. Otherwise a scoped selector. */
  scrollSelector: string;
  olderDirection: 'up' | 'down';
  datetimeAssociationVerified: true;
  messageKeyAttribute?: string;
  routeMatches?: (url: URL) => boolean;
}

/** Safe default: no DOM relationship is assumed or scrolling permitted. */
export const unverifiedAdapter: ConversationAdapter = {
  verification: 'unverified',
  resolveConversation: () => null,
  conversationKey: () => undefined,
  getMessages: () => [],
  getTimestampCandidates: () => [],
  getScrollEvidence: () => undefined,
};

/** Optional calibration helper, ONLY for manually observed datetime attributes and opaque keys.
 * Contains no Instagram-specific selectors. Ambiguous container selection fails closed.
 * For other timestamp structures, implement ConversationAdapter directly. */
export function createManualAttributeAdapter(config: ManualAttributeAdapterConfig): ConversationAdapter {
  if (config.verification !== 'manual' || config.datetimeAssociationVerified !== true || !['up', 'down'].includes(config.olderDirection) ||
    ![config.conversationSelector, config.conversationKeyAttribute, config.messageSelector, config.scrollSelector].every((value) => typeof value === 'string' && value.trim().length > 0)) {
    throw new Error('manual-verification-required');
  }
  const unique = (scope: Document | HTMLElement, selector: string): HTMLElement | null => {
    const matches = scope.querySelectorAll<HTMLElement>(selector);
    return matches.length === 1 && matches[0] instanceof HTMLElement ? matches[0] : null;
  };
  return {
    verification: 'manual',
    ...(config.routeMatches ? { routeMatches: config.routeMatches } : {}),
    resolveConversation: (doc) => unique(doc, config.conversationSelector),
    conversationKey: (root) => root.getAttribute(config.conversationKeyAttribute) ?? undefined,
    getMessages: (root) => [...root.querySelectorAll<HTMLElement>(config.messageSelector)],
    getTimestampCandidates: (message) => semanticTimestampCandidates(message, true),
    getScrollEvidence: (root) => {
      const container = config.scrollSelector === ':scope' ? root : unique(root, config.scrollSelector);
      return container ? { container, olderDirection: config.olderDirection, directionVerified: true } : undefined;
    },
    ...(config.messageKeyAttribute ? { messageKey: (message: HTMLElement) => message.getAttribute(config.messageKeyAttribute!) ?? undefined } : {}),
  };
}

/** Semantic candidates only. Call ONLY after confirming they date this particular message.
 * Does not read textContent, title, or aria-label from arbitrary UI. */
export function semanticTimestampCandidates(message: HTMLElement, associationVerified = false): TimestampCandidate[] {
  const elements = [message, ...message.querySelectorAll<HTMLElement>('[datetime]')];
  return elements.filter((element) => element.hasAttribute('datetime')).map((element) => ({
    element,
    value: element.getAttribute('datetime') ?? '',
    source: element.tagName === 'TIME' ? 'time-element' : 'datetime-attribute',
    associationVerified,
  }));
}
