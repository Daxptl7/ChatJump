import { instagramConnectionStatus } from '../adapters/instagram';
import { isExtensionMessage } from './messages';
import { detectPlatform } from '../services/platformDetection';
import type { ConversationSnapshot } from '../core/messageTypes';
import { isConversationSnapshot } from '../core/snapshot';
import { emptySnapshot } from '../adapters/instagram/InstagramAdapter';

export function registerConnectionListener(runtime: typeof chrome.runtime, currentUrl: () => string, snapshotProvider?: () => ConversationSnapshot): () => void {
  const listener = (message: unknown, sender: chrome.runtime.MessageSender, sendResponse: (response: unknown) => void): false | undefined => {
    if (sender.id !== runtime.id || sender.tab || !isExtensionMessage(message)) return undefined;
    if (!detectPlatform(currentUrl()).isSupported) return undefined;
    if (message.type === 'PING' || message.type === 'GET_CONNECTION_STATUS') sendResponse(instagramConnectionStatus());
    else {
      let snapshot: ConversationSnapshot;
      try {
        snapshot = snapshotProvider?.() ?? emptySnapshot('unsupported-layout', 'unverified', 'UNVERIFIED_SELECTORS');
        if (!isConversationSnapshot(snapshot)) snapshot = emptySnapshot('error', 'unverified', 'ADAPTER_FAILED');
      } catch { snapshot = emptySnapshot('error', 'unverified', 'ADAPTER_FAILED'); }
      sendResponse({ success: true, type: message.type, snapshot });
    }
    return false; // synchronous response; no indefinitely open message port
  };
  runtime.onMessage.addListener(listener);
  return () => runtime.onMessage.removeListener(listener);
}
