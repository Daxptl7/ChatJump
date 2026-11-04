import { registerConnectionListener } from '../../messaging/contentListener';
import { InstagramAdapter } from './InstagramAdapter';
import type { SelectorProfile } from './selectors';

const sessions = new WeakMap<Document, () => void>();

export function initializeInstagramRuntime(runtime: typeof chrome.runtime, doc: Document, profile?: SelectorProfile): () => void {
  sessions.get(doc)?.();
  const adapter = new InstagramAdapter(doc, profile);
  const stopObservation = adapter.observeMessages(() => {});
  let stopMessages: () => void;
  try { stopMessages = registerConnectionListener(runtime, () => doc.location.href, () => adapter.getSnapshot()); }
  catch { stopObservation(); adapter.cleanup(); return () => {}; }
  let stopped = false;
  const dispose = (): void => {
    if (stopped) return;
    stopped = true;
    try { stopMessages(); } catch { /* Chrome may already have invalidated this extension context. */ }
    stopObservation(); adapter.cleanup();
    if (sessions.get(doc) === dispose) sessions.delete(doc);
  };
  sessions.set(doc, dispose);
  return dispose;
}
