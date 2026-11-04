import type { ScrollContainerInfo } from '../../core/messageTypes';
import type { VerifiedSelectorProfile } from './selectors';
import { uniqueScoped } from './selectors';

export function detectScrollContainer(root: HTMLElement, list: HTMLElement, profile: VerifiedSelectorProfile, virtualizationSuspected = false): ScrollContainerInfo {
  const result: ScrollContainerInfo = { element: null, isScrollable: false, olderDirection: 'unknown', virtualizationSuspected };
  let candidate: HTMLElement | null = profile.scrollSelector ? uniqueScoped(root, profile.scrollSelector) : null;
  if (!profile.scrollSelector) {
    const candidates: HTMLElement[] = [];
    for (let node: HTMLElement | null = list; node && root.contains(node); node = node === root ? null : node.parentElement) {
      const overflow = root.ownerDocument.defaultView?.getComputedStyle(node).overflowY;
      if (node.clientHeight > 0 && node.scrollHeight > node.clientHeight + 1 && (overflow === 'auto' || overflow === 'scroll')) candidates.push(node);
    }
    if (candidates.length === 1) candidate = candidates[0]!;
  }
  if (!candidate || !candidate.isConnected || (candidate !== list && !candidate.contains(list))) return result;
  if (!Number.isFinite(candidate.scrollTop)) return result;
  const overflow = root.ownerDocument.defaultView?.getComputedStyle(candidate).overflowY;
  return { element: candidate, isScrollable: candidate.clientHeight > 0 && candidate.scrollHeight > candidate.clientHeight + 1 && (overflow === 'auto' || overflow === 'scroll'),
    olderDirection: profile.directionVerified === true ? profile.olderDirection ?? 'unknown' : 'unknown', virtualizationSuspected };
}
