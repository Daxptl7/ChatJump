export interface ConversationContext {
  isConversationOpen: boolean;
  conversationId?: string;
  conversationElement?: HTMLElement;
  detectedAt: number;
  reason?: string;
}

export type TimestampSource = 'time-element' | 'datetime-attribute' | 'date-separator' | 'aria-label' | 'relative-time';

export interface DetectedTimestamp {
  timestamp?: number;
  dateISO: string;
  source: TimestampSource;
  confidence: 'high' | 'medium' | 'low';
}

export interface TimestampCandidate {
  element: HTMLElement;
  value: string;
  source: TimestampSource;
  /** Must be established by manual inspection, including separator-to-message relationships. */
  associationVerified: boolean;
}

export interface TimestampOptions {
  /** IANA time zone used by both the displayed dates and the chosen calendar date. */
  timeZone: string;
  now?: number;
  /** Only English Today/Yesterday is supported; opt in after confirming UI language. */
  relativeLocale?: 'en';
}

export type TimestampFailure = 'missing' | 'unverified-association' | 'invalid-date' | 'ambiguous-date' | 'unsupported-format' | 'invalid-timezone' | 'conflicting-dates' | 'scan-limit';
export type TimestampParseResult =
  | { ok: true; value: DetectedTimestamp }
  | { ok: false; reason: TimestampFailure };

export interface MessageDate {
  element: HTMLElement;
  detected: DetectedTimestamp;
}

export interface DateRange { oldest: string; newest: string }

export interface TimestampScan {
  messages: HTMLElement[];
  matches: MessageDate[];
  failures: Partial<Record<TimestampFailure, number>>;
  range?: DateRange;
  visibleRange?: DateRange;
  truncated: boolean;
}

export interface ScrollContext {
  container: HTMLElement;
  /** Physical direction; decreasing scrollTop is up, including negative reversed values. */
  olderDirection: 'up' | 'down' | 'unknown';
  isScrollable: boolean;
  virtualizationSuspected: boolean;
}

export interface ScrollEvidence {
  container: HTMLElement;
  olderDirection: 'up' | 'down' | 'unknown';
  /** A manually observed loading/chronology relationship, not an inference from CSS. */
  directionVerified: boolean;
  virtualizationSuspected?: boolean;
}

/** No built-in Instagram selectors. All these functions are trusted, local developer code. */
export interface ConversationAdapter {
  verification: 'unverified' | 'manual';
  /** Single supported route here is a candidate until manually confirmed. Never logged. */
  routeMatches?: (url: URL) => boolean;
  resolveConversation: (doc: Document) => HTMLElement | null;
  /** Must change on an in-place conversation switch, even if its route and root are reused. */
  conversationKey: (root: HTMLElement) => string | undefined;
  getMessages: (root: HTMLElement) => HTMLElement[];
  getTimestampCandidates: (message: HTMLElement, root: HTMLElement) => TimestampCandidate[];
  getScrollEvidence: (root: HTMLElement) => ScrollEvidence | undefined;
  /** Optional stable opaque key. Never exported or logged; bodies/names must not be used. */
  messageKey?: (message: HTMLElement) => string | undefined;
  /** Strong opt-in: ALL history, including newest and oldest, currently rendered without gaps. */
  allHistoryRendered?: (root: HTMLElement) => boolean;
}

export interface ScrollOptions {
  maxAttempts: number;
  maxDurationMs: number;
  scrollStepPx: number;
  delayMs: number;
  signal?: AbortSignal;
}

export type SearchStatus = 'idle' | 'searching' | 'found' | 'not-found' | 'incomplete' | 'cancelled' | 'error';
export interface DateSearchResult {
  status: SearchStatus;
  targetDate: string;
  searchDurationMs: number;
  scrollAttempts: number;
  matchedDate?: string;
  reason?: string;
}

export interface MutationStats {
  mutationEvents: number;
  addedElements: number;
  removedElements: number;
  messageElementsObserved: number;
  uniqueMessagesObserved?: number;
  scrollHeightChanges: number;
  virtualizationSuspected: boolean;
  processingLimited: boolean;
}

export interface BenchmarkResult {
  durationMs: number;
  scrollAttempts: number;
  mutationEvents: number;
  timestampsDetected: number;
  uniqueMessagesObserved?: number;
  successful: boolean;
  outcome: SearchStatus;
  reason?: string;
  messageElementsObserved: number;
  timestampDetectionSuccessRate?: number;
  availableDateRange?: DateRange;
  visibleDateRange?: DateRange;
  loadingDelaysMs: number[];
  stalledAttempts: number;
  historyBatchesObserved: number;
  scrollHeightChanges: number;
  virtualizationSuspected: boolean;
  processingLimited: boolean;
}

export interface SearchProgress {
  status: SearchStatus;
  elapsedMs: number;
  scrollAttempts: number;
  range?: DateRange;
}
