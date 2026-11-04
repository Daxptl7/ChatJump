import { Check, CircleAlert, Unplug } from 'lucide-react';
import type { ConnectionState } from '../types/extension';

const labels: Record<ConnectionState['status'], string> = { checking: 'Checking', connected: 'Connected', unsupported: 'Not on Instagram', unavailable: 'Instagram tab detected but script unavailable', error: 'Error' };
export function ConnectionStatus({ connection }: { connection: ConnectionState }): React.JSX.Element {
  const Icon = connection.status === 'connected' ? Check : connection.status === 'error' ? CircleAlert : Unplug;
  const tone = connection.status === 'connected' ? 'text-success' : connection.status === 'error' ? 'text-error' : 'text-primary';
  return <div><h2 className="text-sm font-medium">Connection status</h2><p className={`mt-2 flex items-start gap-2 text-sm ${tone}`} role="status" aria-live="polite" aria-atomic="true"><Icon size={16} className="mt-0.5 shrink-0" aria-hidden="true" /><span>{labels[connection.status]}</span></p></div>;
}
