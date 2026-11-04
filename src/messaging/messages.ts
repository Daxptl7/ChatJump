import type { ConversationSnapshot } from '../core/messageTypes';
import { isConversationSnapshot } from '../core/snapshot';

export type ExtensionMessage = { type: 'PING' } | { type: 'GET_CONNECTION_STATUS' } | { type: 'GET_CONVERSATION_STATUS' } | { type: 'GET_RENDERED_MESSAGE_SUMMARY' };
export type SnapshotRequestType = 'GET_CONVERSATION_STATUS' | 'GET_RENDERED_MESSAGE_SUMMARY';
export type SnapshotResponse =
  | { success: true; type: 'GET_CONVERSATION_STATUS'; snapshot: ConversationSnapshot }
  | { success: true; type: 'GET_RENDERED_MESSAGE_SUMMARY'; snapshot: ConversationSnapshot };

/** One schema for both messages. Readiness is independent of unverified conversation DOM. */
export interface ConnectionResponse {
  success: true;
  platform: 'instagram';
  contentScriptReady: true;
  conversationDetected: null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isExtensionMessage(value: unknown): value is ExtensionMessage {
  return isRecord(value) && Object.keys(value).length === 1 && ['PING', 'GET_CONNECTION_STATUS', 'GET_CONVERSATION_STATUS', 'GET_RENDERED_MESSAGE_SUMMARY'].includes(String(value.type));
}

export function isSnapshotResponse(value: unknown, requestType: SnapshotRequestType): value is SnapshotResponse {
  return isRecord(value) && Object.keys(value).length === 3 && value.success === true && value.type === requestType && isConversationSnapshot(value.snapshot);
}

export function isConnectionResponse(value: unknown): value is ConnectionResponse {
  return isRecord(value) && Object.keys(value).length === 4 && value.success === true && value.platform === 'instagram' && value.contentScriptReady === true && value.conversationDetected === null;
}
