import { validDateISO } from '../../phase0/src/timestampDetector';
import type { ConversationSnapshot } from './messageTypes';

const allowedKeys = new Set(['status', 'confidence', 'verification', 'renderedMessageCount', 'visibleMessageCount', 'datedMessageCount', 'datesDetected', 'earliestRenderedDate', 'latestRenderedDate', 'calendarTimeZone', 'timestampCoverage', 'lastUpdatedAt', 'revision', 'reason', 'scrollable', 'olderDirection', 'virtualizationSuspected']);
const reasons = new Set(['NOT_INSTAGRAM', 'NO_CONVERSATION', 'UNVERIFIED_SELECTORS', 'UNSUPPORTED_LAYOUT', 'MESSAGE_CONTAINER_NOT_FOUND', 'NO_RENDERED_MESSAGES', 'TIMESTAMP_UNAVAILABLE', 'AMBIGUOUS_TIMESTAMP', 'SCAN_LIMIT', 'OBSERVER_FAILED', 'CONTEXT_INVALIDATED', 'ADAPTER_FAILED']);

export function isConversationSnapshot(value: unknown): value is ConversationSnapshot {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  if (Object.keys(v).some((key) => !allowedKeys.has(key))) return false;
  if (['status', 'confidence', 'verification', 'timestampCoverage', 'olderDirection'].some((key) => typeof v[key] !== 'string')) return false;
  if (!['detected', 'not-open', 'unsupported-layout', 'error'].includes(String(v.status)) || !['high', 'medium', 'low'].includes(String(v.confidence)) || !['manual', 'unverified'].includes(String(v.verification))) return false;
  if (!['complete', 'partial', 'unknown'].includes(String(v.timestampCoverage)) || !['up', 'down', 'unknown'].includes(String(v.olderDirection))) return false;
  if (typeof v.scrollable !== 'boolean' || typeof v.virtualizationSuspected !== 'boolean' || typeof v.lastUpdatedAt !== 'number' || !Number.isFinite(v.lastUpdatedAt) || v.lastUpdatedAt < 0 || !Number.isSafeInteger(v.revision) || Number(v.revision) < 0) return false;
  if (v.reason !== undefined && (typeof v.reason !== 'string' || !reasons.has(v.reason))) return false;
  if (v.calendarTimeZone !== undefined) {
    if (typeof v.calendarTimeZone !== 'string' || v.calendarTimeZone.length > 100) return false;
    try { new Intl.DateTimeFormat('en-US', { timeZone: v.calendarTimeZone }).format(); } catch { return false; }
  }
  const counts = ['renderedMessageCount', 'visibleMessageCount', 'datedMessageCount', 'datesDetected'] as const;
  if (v.status !== 'detected') return counts.every((key) => v[key] === undefined) && v.earliestRenderedDate === undefined && v.latestRenderedDate === undefined && v.timestampCoverage === 'unknown';
  if (v.verification !== 'manual' || counts.some((key) => !Number.isSafeInteger(v[key]) || Number(v[key]) < 0 || Number(v[key]) > 2000)) return false;
  const total = Number(v.renderedMessageCount), dated = Number(v.datedMessageCount), distinct = Number(v.datesDetected);
  if (dated > total || Number(v.visibleMessageCount) > total || distinct > dated || (dated > 0 && distinct === 0)) return false;
  if (dated === 0) return v.earliestRenderedDate === undefined && v.latestRenderedDate === undefined && v.timestampCoverage === 'unknown';
  if (typeof v.earliestRenderedDate !== 'string' || typeof v.latestRenderedDate !== 'string' || !validDateISO(v.earliestRenderedDate) || !validDateISO(v.latestRenderedDate) || v.earliestRenderedDate > v.latestRenderedDate) return false;
  if ((v.earliestRenderedDate === v.latestRenderedDate) !== (distinct === 1)) return false;
  return v.timestampCoverage === (dated === total ? 'complete' : 'partial');
}
