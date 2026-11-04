import type { ExtensionMessage } from '../messaging/messages';
import type { ExtensionErrorCode } from '../utils/errors';

export interface ActiveTab {
  id?: number | undefined;
  url?: string | undefined;
  status?: string | undefined;
}

/** Browser boundary can be exercised without importing WXT internals into UI tests. */
export interface BrowserClient {
  queryActiveTab: () => Promise<ActiveTab | undefined>;
  sendMessage: (tabId: number, message: ExtensionMessage) => Promise<unknown>;
  subscribe: (onChange: () => void) => () => void;
}

export type ConnectionState =
  | { status: 'checking' }
  | { status: 'connected'; conversationDetected: null }
  | { status: 'unsupported' }
  | { status: 'unavailable'; code: ExtensionErrorCode }
  | { status: 'error'; code: ExtensionErrorCode };
