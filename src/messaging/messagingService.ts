import type { BrowserClient } from '../types/extension';
import { ExtensionError } from '../utils/errors';
import { isConnectionResponse } from './messages';
import type { ConnectionResponse } from './messages';

/** Bounds tab queries and messages, including APIs that never settle. */
export function withDeadline<T>(operation: () => Promise<T>, signal?: AbortSignal, timeoutMs = 2000): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = (): void => { clearTimeout(timer); signal?.removeEventListener('abort', abort); };
    const finish = (callback: () => void): void => { if (!settled) { settled = true; cleanup(); callback(); } };
    const abort = (): void => finish(() => reject(new ExtensionError('cancelled')));
    const timer = setTimeout(() => finish(() => reject(new ExtensionError('timeout'))), timeoutMs);
    if (signal?.aborted) return abort();
    signal?.addEventListener('abort', abort, { once: true });
    Promise.resolve().then(() => {
      if (settled) throw new ExtensionError('cancelled');
      return operation();
    }).then(
      (value) => finish(() => resolve(value)),
      (error: unknown) => finish(() => reject(error)),
    );
  });
}

export async function checkConnection(client: BrowserClient, tabId: number, signal?: AbortSignal): Promise<ConnectionResponse> {
  let response: unknown;
  try {
    response = await withDeadline(() => client.sendMessage(tabId, { type: 'GET_CONNECTION_STATUS' }), signal);
  } catch (error) {
    if (error instanceof ExtensionError) throw error;
    // Only inspect the browser's error in memory; never show/log its raw URL or stack.
    const message = error instanceof Error ? error.message : '';
    const missing = /receiving end does not exist|could not establish connection|message port closed/i.test(message);
    throw new ExtensionError(missing ? 'script-unavailable' : 'messaging-failed');
  }
  if (!isConnectionResponse(response)) throw new ExtensionError('unexpected-response');
  return response;
}
