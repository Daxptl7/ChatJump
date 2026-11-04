import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { Header } from '../../src/components/Header';
import { DateSelector } from '../../src/components/DateSelector';
import { ConnectionStatus } from '../../src/components/ConnectionStatus';
import { ActionButton } from '../../src/components/ActionButton';
import { StatusMessage } from '../../src/components/StatusMessage';
import { useActiveTab } from '../../src/hooks/useActiveTab';
import type { BrowserClient } from '../../src/types/extension';
import { localToday, validateSelectedDate } from '../../src/utils/date';
import { ConversationStatus } from '../../src/components/ConversationStatus';
import { useConversationSnapshot } from '../../src/hooks/useConversationSnapshot';

export default function App({ client }: { client?: BrowserClient }): React.JSX.Element {
  const active = useActiveTab(client);
  const { connection, refresh } = active;
  const conversation = useConversationSnapshot(active.client, active.activeTab);
  const [date, setDate] = useState('');
  const [dateTouched, setDateTouched] = useState(false);
  const today = localToday();
  const dateError = dateTouched ? validateSelectedDate(date, today) : undefined;
  return <div className="popup-shell bg-background text-primary">
    <Header />
    <main>
      <section className="space-y-4 border-b border-line px-5 py-4" aria-label="Instagram connection">
        <div><h2 className="text-sm font-medium">Platform</h2><p className="mt-1 text-sm text-muted">Instagram Web</p></div>
        <ConnectionStatus connection={connection} /><StatusMessage connection={connection} />
        <ConversationStatus view={conversation} />
        <button type="button" className="secondary-button inline-flex items-center justify-center gap-2" onClick={refresh} disabled={connection.status === 'checking'}><RefreshCw size={14} aria-hidden="true" />Check Connection</button>
      </section>
      <section className="space-y-4 px-5 py-4" aria-label="Message date">
        <DateSelector value={date} max={today} {...(dateError ? { error: dateError } : {})} onBlur={() => setDateTouched(true)} onChange={(value) => { setDate(value); setDateTouched(true); }} />
        <ActionButton />
      </section>
    </main>
    <footer className="flex items-center justify-between border-t border-line bg-surface px-5 py-3 text-xs text-muted"><span>Local-first · No chat collection</span><span>Version 0.1.0</span></footer>
  </div>;
}
