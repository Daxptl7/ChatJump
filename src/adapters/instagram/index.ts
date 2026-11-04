import type { ConnectionResponse } from '../../messaging/messages';

/** No DOM is inspected in Phase 1. Phase 0 live navigation remains UNVERIFIED. */
export function instagramConnectionStatus(): ConnectionResponse {
  return { success: true, platform: 'instagram', contentScriptReady: true, conversationDetected: null };
}
