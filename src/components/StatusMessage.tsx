import type { ConnectionState } from '../types/extension';
import { ERROR_MESSAGES } from '../utils/errors';
export function StatusMessage({ connection }: { connection: ConnectionState }): React.JSX.Element {
  let message: string;
  switch (connection.status) {
    case 'checking': message = 'Checking the active tab and its connection to ChatJump.'; break;
    case 'connected': message = 'Instagram is connected. Message navigation has not been validated yet.'; break;
    case 'unsupported': message = 'Open www.instagram.com in the active tab, then check the connection again.'; break;
    default: message = ERROR_MESSAGES[connection.code];
  }
  return <p className={`text-xs leading-5 ${connection.status === 'error' ? 'text-error' : 'text-muted'}`} aria-live="polite">{message}</p>;
}
