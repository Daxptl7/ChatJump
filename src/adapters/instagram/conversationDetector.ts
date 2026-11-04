import { detectPlatform } from '../../services/platformDetection';
import type { ConversationState } from '../../core/messageTypes';
import type { SelectorProfile } from './selectors';
import { uniqueScoped, visibleStructure } from './selectors';

export function detectConversation(doc: Document, profile: SelectorProfile): ConversationState {
  const base = { detectedAt: performance.now(), confidence: 'low' as const };
  try {
    const platform = detectPlatform(doc.location.href);
    if (!platform.isSupported) return { ...base, status: 'not-open', reason: 'NOT_INSTAGRAM' };
    if (!platform.isConversationRoute) return { ...base, status: 'not-open', reason: 'NO_CONVERSATION' };
    if (profile.verification !== 'manual') return { ...base, status: 'unsupported-layout', reason: 'UNVERIFIED_SELECTORS' };
    if (!profile.conversationSelectors.length || !profile.conversationKeyAttribute || !profile.messageSelector) return { ...base, status: 'unsupported-layout', reason: 'UNSUPPORTED_LAYOUT' };
    let scope: Document | HTMLElement = doc;
    if (profile.transitionRootSelector) {
      const regions = doc.querySelectorAll<HTMLElement>(profile.transitionRootSelector);
      if (regions.length !== 1 || !(regions[0] instanceof HTMLElement) || regions[0] === doc.body || regions[0] === doc.documentElement) return { ...base, status: 'unsupported-layout', reason: 'UNSUPPORTED_LAYOUT' };
      scope = regions[0];
    }
    let root: HTMLElement | undefined;
    for (const selector of profile.conversationSelectors) {
      const candidates = scope.querySelectorAll<HTMLElement>(selector);
      if (candidates.length > 1) return { ...base, status: 'unsupported-layout', reason: 'UNSUPPORTED_LAYOUT' };
      if (candidates.length === 1) { root = candidates[0]; break; }
    }
    if (!root || !(root instanceof HTMLElement) || root === doc.body || root === doc.documentElement || !visibleStructure(root)) return { ...base, status: 'unsupported-layout', reason: 'MESSAGE_CONTAINER_NOT_FOUND' };
    const identity = root.getAttribute(profile.conversationKeyAttribute);
    const list = uniqueScoped(root, profile.messageListSelector);
    if (!identity || !list || !visibleStructure(list)) return { ...base, status: 'unsupported-layout', reason: 'UNSUPPORTED_LAYOUT' };
    return { status: 'detected', conversationElement: root, messageList: list, identity, confidence: 'high', detectedAt: base.detectedAt };
  } catch {
    return { ...base, status: 'error', reason: 'ADAPTER_FAILED' };
  }
}
