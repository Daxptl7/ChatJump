import type { ChatAdapter } from '../../core/ChatAdapter';
import type { ConversationSnapshot, ConversationState, DetectionMetrics, MessageReference } from '../../core/messageTypes';
import { detectPlatform } from '../../services/platformDetection';
import { rangeOf } from '../../../phase0/src/timestampDetector';
import { detectConversation } from './conversationDetector';
import { detectMessages } from './messageDetector';
import { detectScrollContainer } from './scrollContainerDetector';
import { ConversationDOMObserver } from './domObserver';
import { instagramSelectorProfile } from './selectors';
import type { SelectorProfile } from './selectors';
import { layoutDiagnostics } from './layoutDiagnostics';

export function emptySnapshot(status: ConversationSnapshot['status'], verification: ConversationSnapshot['verification'], reason: NonNullable<ConversationSnapshot['reason']>): ConversationSnapshot {
  return { status, verification, confidence: 'low', reason, timestampCoverage: 'unknown', lastUpdatedAt: Date.now(), revision: 0, scrollable: false, olderDirection: 'unknown', virtualizationSuspected: false };
}

export class InstagramAdapter implements ChatAdapter {
  private snapshot: ConversationSnapshot = emptySnapshot('unsupported-layout', 'unverified', 'UNVERIFIED_SELECTORS');
  private state: ConversationState | undefined;
  private path = '';
  private keys = new WeakMap<HTMLElement, string>();
  private nextKey = 0;
  private knownMessages = new WeakSet<HTMLElement>();
  private epoch = 0;
  private publishedEpoch = -1;
  private virtualized = false;
  private observer = new ConversationDOMObserver();
  private subscribers = new Set<(snapshot: ConversationSnapshot) => void>();
  private polling: ReturnType<typeof setInterval> | undefined;
  private disposed = false;
  private detachScroll: (() => void) | undefined;
  private scrollElement: HTMLElement | null = null;
  private scrollTimer: ReturnType<typeof setTimeout> | undefined;
  private metrics: DetectionMetrics = { conversationDetectionMs: 0, messageDetectionMs: 0, timestampParsingMs: 0, mutationProcessingMs: 0, mutationRecords: 0, snapshotUpdates: 0, activeObservers: 0 };

  constructor(private doc: Document = document, private profile: SelectorProfile = instagramSelectorProfile) {}

  isSupportedPage(): boolean { return detectPlatform(this.doc.location.href).isSupported; }
  detectConversation(): ConversationState { return this.disposed ? { status: 'error', reason: 'CONTEXT_INVALIDATED', confidence: 'low', detectedAt: performance.now() } : detectConversation(this.doc, this.profile); }

  private keyFor = (element: HTMLElement): string => {
    let key = this.keys.get(element);
    if (!key) { key = `local-${this.epoch}-${++this.nextKey}`; this.keys.set(element, key); }
    return key;
  };

  private synchronize(): ConversationState {
    const started = performance.now();
    const next = this.detectConversation();
    this.metrics.conversationDetectionMs = performance.now() - started;
    const path = this.doc.location.pathname;
    const changed = this.path !== path || this.state?.conversationElement !== next.conversationElement || this.state?.messageList !== next.messageList || this.state?.identity !== next.identity || this.state?.status !== next.status;
    if (changed) {
      this.observer.stop(); this.detachScroll?.(); this.detachScroll = undefined; this.scrollElement = null;
      clearTimeout(this.scrollTimer); this.scrollTimer = undefined;
      this.knownMessages = new WeakSet(); this.keys = new WeakMap(); this.nextKey = 0; this.epoch++; this.virtualized = false;
    }
    this.path = path; this.state = next;
    if (this.subscribers.size && next.status === 'detected' && next.conversationElement && this.profile.verification === 'manual') {
      try {
        this.observer.start(next.conversationElement, this.profile, (element) => this.knownMessages.has(element), (summary) => {
          this.metrics.mutationRecords += summary.records;
          this.metrics.mutationProcessingMs = summary.processingMs;
          this.virtualized ||= summary.removedKnownMessage;
          this.publish();
        });
      } catch {
        this.state = { status: 'error', reason: 'OBSERVER_FAILED', confidence: 'low', detectedAt: performance.now() };
      }
    }
    this.metrics.activeObservers = this.observer.active ? 1 : 0;
    return this.state;
  }

  private read(): { snapshot: ConversationSnapshot; messages: MessageReference[]; container: HTMLElement | null } {
    if (this.disposed) return { snapshot: emptySnapshot('error', this.profile.verification, 'CONTEXT_INVALIDATED'), messages: [], container: null };
    const state = this.synchronize();
    const root = state.conversationElement, list = state.messageList;
    if (state.status !== 'detected' || !root || !list || this.profile.verification !== 'manual') return { snapshot: emptySnapshot(state.status, this.profile.verification, state.reason ?? 'UNSUPPORTED_LAYOUT'), messages: [], container: null };
    const started = performance.now();
    const scroll = detectScrollContainer(root, list, this.profile, this.virtualized);
    const detection = detectMessages(list, this.profile, this.keyFor, scroll.element);
    this.metrics.messageDetectionMs = performance.now() - started;
    this.metrics.timestampParsingMs = detection.timestampParsingMs;
    if (detection.limited) return { snapshot: emptySnapshot('unsupported-layout', 'manual', 'SCAN_LIMIT'), messages: [], container: scroll.element };
    this.knownMessages = new WeakSet(detection.messages.map((message) => message.element));
    const dated = detection.messages.filter((message) => message.dateISO !== undefined);
    const range = rangeOf(dated.map((message) => message.dateISO!));
    return { container: scroll.element, messages: detection.messages, snapshot: {
      status: 'detected', verification: 'manual', confidence: state.confidence,
      renderedMessageCount: detection.messages.length, visibleMessageCount: detection.messages.filter((message) => message.visible).length,
      datedMessageCount: dated.length, datesDetected: new Set(dated.map((message) => message.dateISO)).size,
      ...(range ? { earliestRenderedDate: range.oldest, latestRenderedDate: range.newest } : {}),
      ...(this.profile.timestamps.displayTimeZoneVerified && this.validZone(this.profile.timestamps.timeZone) ? { calendarTimeZone: this.profile.timestamps.timeZone } : {}),
      timestampCoverage: detection.messages.length > 0 && dated.length === detection.messages.length ? 'complete' : dated.length > 0 ? 'partial' : 'unknown',
      ...(detection.messages.length === 0 ? { reason: 'NO_RENDERED_MESSAGES' as const } : dated.length === detection.messages.length ? {} : { reason: detection.ambiguousDates ? 'AMBIGUOUS_TIMESTAMP' as const : 'TIMESTAMP_UNAVAILABLE' as const }),
      lastUpdatedAt: 0, revision: this.epoch, scrollable: scroll.isScrollable, olderDirection: scroll.olderDirection, virtualizationSuspected: this.virtualized,
    } };
  }

  getRenderedMessages(): MessageReference[] {
    try { return this.read().messages; } catch { this.fail(); return []; }
  }

  getScrollContainer(): HTMLElement | null {
    try { return this.read().container; } catch { this.fail(); return null; }
  }

  private fail(): void {
    this.stopMonitoring();
    this.snapshot = emptySnapshot('error', this.profile.verification, 'ADAPTER_FAILED');
  }

  getSnapshot(): ConversationSnapshot {
    try {
      const { snapshot: next, container } = this.read();
      if (this.subscribers.size && container !== this.scrollElement) {
        this.detachScroll?.(); this.scrollElement = container;
        const onScroll = (): void => {
          if (this.scrollTimer !== undefined) return;
          this.scrollTimer = setTimeout(() => { this.scrollTimer = undefined; this.publish(); }, 100);
        };
        container?.addEventListener('scroll', onScroll, { passive: true });
        this.detachScroll = () => container?.removeEventListener('scroll', onScroll);
      }
      const comparable = (value: ConversationSnapshot): string => JSON.stringify({ ...value, lastUpdatedAt: 0, revision: this.epoch });
      const identityChanged = this.publishedEpoch !== this.epoch;
      if (comparable(next) !== comparable(this.snapshot) || identityChanged) {
        this.snapshot = { ...next, lastUpdatedAt: Date.now(), revision: Math.max(this.snapshot.revision + 1, this.epoch) };
        this.metrics.snapshotUpdates++;
        this.publishedEpoch = this.epoch;
      }
    } catch { this.fail(); }
    return { ...this.snapshot };
  }

  private publish(): void {
    const previous = this.snapshot;
    const snapshot = this.getSnapshot();
    if (previous.revision === snapshot.revision && previous.status === snapshot.status) return;
    for (const callback of this.subscribers) { try { callback({ ...snapshot }); } catch { /* Consumer errors never leak DOM details. */ } }
  }

  private validZone(zone: string): boolean {
    try { new Intl.DateTimeFormat('en-US', { timeZone: zone }).format(); return true; } catch { return false; }
  }

  observeMessages(callback: (snapshot: ConversationSnapshot) => void): () => void {
    if (this.disposed) return () => {};
    this.subscribers.add(callback);
    if (this.polling === undefined) {
      // A route/root/key check, not a document-wide MutationObserver or message scan.
      this.polling = setInterval(() => {
        const before = this.state;
        const path = this.path;
        this.synchronize();
        if (before?.conversationElement !== this.state?.conversationElement || before?.messageList !== this.state?.messageList || before?.identity !== this.state?.identity || before?.status !== this.state?.status || path !== this.path) this.publish();
      }, 500);
    }
    try { callback(this.getSnapshot()); } catch { /* Isolate initial consumer errors too. */ }
    return () => {
      this.subscribers.delete(callback);
      if (!this.subscribers.size) this.stopMonitoring();
    };
  }

  getDiagnostics(): ReturnType<typeof layoutDiagnostics> {
    return layoutDiagnostics(this.getSnapshot(), this.metrics, this.state?.conversationElement);
  }

  private stopMonitoring(): void {
    this.observer.stop(); clearInterval(this.polling); this.polling = undefined;
    clearTimeout(this.scrollTimer); this.scrollTimer = undefined;
    this.detachScroll?.(); this.detachScroll = undefined; this.scrollElement = null;
    this.knownMessages = new WeakSet(); this.keys = new WeakMap(); this.state = undefined;
    this.metrics.activeObservers = 0;
  }

  cleanup(): void {
    this.disposed = true; this.stopMonitoring(); this.subscribers.clear();
    this.snapshot = emptySnapshot('error', this.profile.verification, 'CONTEXT_INVALIDATED');
  }
}
