import { useEffect, useState } from 'react';
import type { ConversationSnapshot } from '../core/messageTypes';
import type { ActiveTab, BrowserClient } from '../types/extension';
import { getConversationSnapshot, withDeadline } from '../messaging/messagingService';
import { errorCode, ExtensionError } from '../utils/errors';
import type { ExtensionErrorCode } from '../utils/errors';

export type ConversationView = { status: 'unavailable' } | { status: 'loading' } | { status: 'ready'; snapshot: ConversationSnapshot } | { status: 'error'; code: ExtensionErrorCode };

export function useConversationSnapshot(client: BrowserClient | undefined, activeTab: ActiveTab | undefined): ConversationView {
  const [result, setResult] = useState<{ tab: ActiveTab | undefined; view: ConversationView }>({ tab: undefined, view: { status: 'unavailable' } });
  useEffect(() => {
    if (!client || activeTab?.id === undefined || !activeTab.url) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const read = async (): Promise<void> => {
      try {
        const snapshot = await getConversationSnapshot(client, activeTab.id!, controller.signal);
        const latest = await withDeadline(client.queryActiveTab, controller.signal);
        if (controller.signal.aborted) return;
        if (!latest || latest.id !== activeTab.id || latest.url !== activeTab.url || latest.status === 'loading') throw new ExtensionError('tab-changed');
        setResult((previous) => previous.tab === activeTab && previous.view.status === 'ready' && JSON.stringify(previous.view.snapshot) === JSON.stringify(snapshot) ? previous : { tab: activeTab, view: { status: 'ready', snapshot } });
      } catch (error) {
        if (controller.signal.aborted) return;
        const code = errorCode(error);
        setResult((previous) => previous.tab === activeTab && previous.view.status === 'error' && previous.view.code === code ? previous : { tab: activeTab, view: { status: 'error', code } });
      }
      if (!controller.signal.aborted) timer = setTimeout(() => { void read(); }, 1000);
    };
    void read();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [client, activeTab]);
  // Never show old conversation data while a new connection is being established.
  return activeTab ? result.tab === activeTab ? result.view : { status: 'loading' } : { status: 'unavailable' };
}
