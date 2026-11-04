import type { ParsedTimestamp } from '../../core/messageTypes';

export interface TimestampRule {
  /** Selector scoped to a confirmed message or separator, not the whole page. */
  selector: string;
  read: 'datetime' | 'aria-label' | 'leaf-text';
  source: ParsedTimestamp['source'];
  associationVerified: true;
}

export interface TimestampSettings {
  /** The observed Instagram calendar zone, independently confirmed, not the popup's default. */
  timeZone: string;
  displayTimeZoneVerified: boolean;
  locale?: string;
  numericDateOrder?: 'DMY' | 'MDY' | 'YMD';
  now?: number;
}

export type DateGroupStrategy =
  | { kind: 'contained'; groupSelector: string; separatorSelector: string; dateRule: TimestampRule; associationVerified: true }
  | { kind: 'siblings'; separatorSelector: string; dateRule: TimestampRule; associationVerified: true;
      /** Verified side governed by the separator in DOM order; never inferred from CSS. */
      direction: 'forward' | 'backward'; orderingVerified: true };

export interface VerifiedSelectorProfile {
  verification: 'manual';
  /** Primary then fallback strategies, each manually verified as identifying the active root. */
  conversationSelectors: readonly string[];
  conversationKeyAttribute: string;
  messageListSelector: string;
  messageSelector: string;
  timestampRules: readonly TimestampRule[];
  timestamps: TimestampSettings;
  dateGroups?: DateGroupStrategy;
  scrollSelector?: string;
  olderDirection?: 'up' | 'down';
  directionVerified?: boolean;
  /** Optional stable, scoped app region for root replacement discovery. Never body/html. */
  transitionRootSelector?: string;
}

export type SelectorProfile = { verification: 'unverified' } | VerifiedSelectorProfile;

/** No Instagram DOM selectors have been observed live. Do not enable guessed selectors.
 * Calibrate this export locally after manual inspection; see docs/phase2-implementation.md. */
export const instagramSelectorProfile: SelectorProfile = { verification: 'unverified' };

export const MAX_MESSAGES = 2000;
export const MAX_ELEMENTS = 4000;

export function visibleStructure(element: HTMLElement): boolean {
  if (!element.isConnected || element.closest('[hidden], [aria-hidden="true"]')) return false;
  for (let node: HTMLElement | null = element; node; node = node.parentElement) {
    const style = node.ownerDocument.defaultView?.getComputedStyle(node);
    if (style?.display === 'none' || style?.visibility === 'hidden' || style?.contentVisibility === 'hidden') return false;
  }
  return true;
}

/** Native selector queries are scoped; bound all subsequent processing. */
export function scopedElements(root: HTMLElement, selector: string, limit = MAX_ELEMENTS): { elements: HTMLElement[]; limited: boolean } {
  if (selector === ':scope') return { elements: [root], limited: false };
  const result = root.querySelectorAll<HTMLElement>(selector);
  const elements: HTMLElement[] = [];
  for (let index = 0; index < Math.min(result.length, limit); index++) if (result[index] instanceof HTMLElement) elements.push(result[index]!);
  return { elements, limited: result.length > limit };
}

export function uniqueScoped(root: HTMLElement, selector: string): HTMLElement | null {
  const result = scopedElements(root, selector, 2);
  return !result.limited && result.elements.length === 1 ? result.elements[0]! : null;
}
