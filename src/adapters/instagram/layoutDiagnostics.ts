import { inspectDOM } from '../../../phase0/src/domInspector';
import type { DOMDiagnostic } from '../../../phase0/src/domInspector';
import type { ConversationSnapshot, DetectionMetrics } from '../../core/messageTypes';

export interface LayoutDiagnostics { status: ConversationSnapshot['status']; reason?: ConversationSnapshot['reason']; metrics: DetectionMetrics; structure?: DOMDiagnostic }

export function layoutDiagnostics(snapshot: ConversationSnapshot, metrics: DetectionMetrics, verifiedRoot?: HTMLElement): LayoutDiagnostics {
  return { status: snapshot.status, ...(snapshot.reason ? { reason: snapshot.reason } : {}), metrics: { ...metrics }, ...(verifiedRoot ? { structure: inspectDOM(verifiedRoot) } : {}) };
}
