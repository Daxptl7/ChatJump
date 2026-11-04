import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { checkConnection, withDeadline } from '../messaging/messagingService';
import { createBrowserClient } from '../services/browserClient';
import { detectPlatform } from '../services/platformDetection';
import type { BrowserClient, ConnectionState } from '../types/extension';
import { errorCode, ExtensionError } from '../utils/errors';

export function useActiveTab(providedClient?: BrowserClient): { connection: ConnectionState; refresh: () => void } {
  const client = useMemo(() => providedClient ?? createBrowserClient(), [providedClient]);
  const [connection, setConnection] = useState<ConnectionState>({ status: 'checking' });
  const pending = useRef<AbortController | undefined>(undefined);

  const refresh = useCallback((): void => {
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    const current = (): boolean => pending.current === controller && !controller.signal.aborted;
    void (async () => {
      await Promise.resolve();
      if (!current()) return;
      setConnection({ status: 'checking' });
      try {
        if (!client) throw new ExtensionError('browser-unavailable');
        const tab = await withDeadline(client.queryActiveTab, controller.signal);
        if (!current()) return;
        if (!tab || tab.id === undefined) throw new ExtensionError('no-active-tab');
        if (!tab.url) throw new ExtensionError('url-unavailable');
        if (!detectPlatform(tab.url).isSupported) { setConnection({ status: 'unsupported' }); return; }
        await checkConnection(client, tab.id, controller.signal);
        const latest = await withDeadline(client.queryActiveTab, controller.signal);
        if (!current()) return;
        if (latest?.id !== tab.id || latest.url !== tab.url || latest.status === 'loading') throw new ExtensionError('tab-changed');
        setConnection({ status: 'connected', conversationDetected: null });
      } catch (error) {
        if (!current()) return;
        const code = errorCode(error);
        setConnection(code === 'script-unavailable' || code === 'timeout' ? { status: 'unavailable', code } : { status: 'error', code });
      }
    })();
  }, [client]);

  useEffect(() => {
    refresh();
    const unsubscribe = client?.subscribe(refresh);
    return () => { pending.current?.abort(); unsubscribe?.(); };
  }, [client, refresh]);

  return { connection, refresh };
}
