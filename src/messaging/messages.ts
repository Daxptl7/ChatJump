export type ExtensionMessage = { type: 'PING' } | { type: 'GET_CONNECTION_STATUS' };

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
  return isRecord(value) && Object.keys(value).length === 1 && (value.type === 'PING' || value.type === 'GET_CONNECTION_STATUS');
}

export function isConnectionResponse(value: unknown): value is ConnectionResponse {
  return isRecord(value) && Object.keys(value).length === 4 && value.success === true && value.platform === 'instagram' && value.contentScriptReady === true && value.conversationDetected === null;
}
