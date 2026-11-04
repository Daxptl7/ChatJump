import { instagramConnectionStatus } from '../adapters/instagram';
import { isExtensionMessage } from './messages';
import { detectPlatform } from '../services/platformDetection';

export function registerConnectionListener(runtime: typeof chrome.runtime, currentUrl: () => string): () => void {
  const listener = (message: unknown, sender: chrome.runtime.MessageSender, sendResponse: (response: unknown) => void): false | undefined => {
    if (sender.id !== runtime.id || sender.tab || !isExtensionMessage(message)) return undefined;
    if (!detectPlatform(currentUrl()).isSupported) return undefined;
    sendResponse(instagramConnectionStatus());
    return false; // synchronous response; no indefinitely open message port
  };
  runtime.onMessage.addListener(listener);
  return () => runtime.onMessage.removeListener(listener);
}
