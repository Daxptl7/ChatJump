export type ExtensionErrorCode = 'browser-unavailable' | 'no-active-tab' | 'url-unavailable' | 'script-unavailable' | 'messaging-failed' | 'unexpected-response' | 'timeout' | 'cancelled' | 'tab-changed';

export class ExtensionError extends Error {
  constructor(readonly code: ExtensionErrorCode) { super(code); this.name = 'ExtensionError'; }
}

export const ERROR_MESSAGES: Record<ExtensionErrorCode, string> = {
  'browser-unavailable': 'Open ChatJump from the Chrome extension toolbar.',
  'no-active-tab': 'No active tab was found. Select a browser tab and check again.',
  'url-unavailable': 'Chrome cannot read this tab. Open Instagram Web, then click the ChatJump icon again.',
  'script-unavailable': 'Instagram is open, but ChatJump could not connect. Reload the Instagram tab after installing or reloading the extension, then try again.',
  'messaging-failed': 'Chrome could not complete the connection check. Reload the Instagram tab and try again.',
  'unexpected-response': 'ChatJump received an incompatible response. Reload the extension and Instagram tab, then try again.',
  'timeout': 'The connection check timed out. Wait for Instagram to finish loading, then try again.',
  'cancelled': 'The connection check was cancelled. Try again when ready.',
  'tab-changed': 'The active page changed during the check. Click Check Connection to try again.',
};

export function errorCode(error: unknown, fallback: ExtensionErrorCode = 'messaging-failed'): ExtensionErrorCode {
  return error instanceof ExtensionError ? error.code : fallback;
}
