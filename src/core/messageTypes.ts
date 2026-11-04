export type ConversationStatus = 'detected' | 'not-open' | 'unsupported-layout' | 'error';
export type Confidence = 'high' | 'medium' | 'low';
export type DetectionErrorCode = 'NOT_INSTAGRAM' | 'NO_CONVERSATION' | 'UNVERIFIED_SELECTORS' | 'UNSUPPORTED_LAYOUT' | 'MESSAGE_CONTAINER_NOT_FOUND' | 'NO_RENDERED_MESSAGES' | 'TIMESTAMP_UNAVAILABLE' | 'AMBIGUOUS_TIMESTAMP' | 'SCAN_LIMIT' | 'OBSERVER_FAILED' | 'CONTEXT_INVALIDATED' | 'ADAPTER_FAILED';

export interface ConversationState {
  status: ConversationStatus;
  conversationElement?: HTMLElement;
  messageList?: HTMLElement;
  /** Private opaque identity, used only in this content-script instance. */
  identity?: string;
  detectedAt: number;
  confidence: Confidence;
  reason?: DetectionErrorCode;
}

export interface ParsedTimestamp {
  dateISO: string;
  timestampMs?: number;
  source: 'datetime-attribute' | 'time-element' | 'date-separator' | 'aria-label' | 'relative-label';
  precision: 'instant' | 'calendar-date';
  confidence: Confidence;
}

export interface MessageReference {
  localKey: string;
  element: HTMLElement;
  dateISO?: string;
  timestampMs?: number;
  timestampConfidence: Confidence | 'unknown';
  source: 'direct-timestamp' | 'date-group' | 'unknown';
  visible: boolean;
}

/** The ONLY adapter model allowed across the messaging boundary. No nodes or identity keys. */
export interface ConversationSnapshot {
  status: ConversationStatus;
  confidence: Confidence;
  verification: 'manual' | 'unverified';
  renderedMessageCount?: number;
  visibleMessageCount?: number;
  datedMessageCount?: number;
  datesDetected?: number;
  earliestRenderedDate?: string;
  latestRenderedDate?: string;
  calendarTimeZone?: string;
  timestampCoverage: 'complete' | 'partial' | 'unknown';
  lastUpdatedAt: number;
  revision: number;
  reason?: DetectionErrorCode;
  scrollable: boolean;
  olderDirection: 'up' | 'down' | 'unknown';
  virtualizationSuspected: boolean;
}

export interface ScrollContainerInfo {
  element: HTMLElement | null;
  isScrollable: boolean;
  olderDirection: 'up' | 'down' | 'unknown';
  virtualizationSuspected: boolean;
}

export interface DetectionMetrics {
  conversationDetectionMs: number;
  messageDetectionMs: number;
  timestampParsingMs: number;
  mutationProcessingMs: number;
  mutationRecords: number;
  snapshotUpdates: number;
  activeObservers: number;
}
