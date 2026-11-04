import type { ConversationView } from '../hooks/useConversationSnapshot';
import { ERROR_MESSAGES } from '../utils/errors';

export function ConversationStatus({ view }: { view: ConversationView }): React.JSX.Element {
  const snapshot = view.status === 'ready' ? view.snapshot : undefined;
  const detected = snapshot?.status === 'detected';
  const labels = { detected: 'Detected', 'not-open': 'No conversation selected', 'unsupported-layout': 'Unsupported layout', error: 'Detection unavailable' };
  const status = snapshot ? labels[snapshot.status] : view.status === 'loading' ? 'Checking conversation' : 'Unavailable';
  const coverage = detected ? snapshot.timestampCoverage === 'complete' ? 'Complete for rendered messages' : snapshot.timestampCoverage === 'partial' ? 'Partial' : 'Unavailable' : 'Unavailable';
  return <div className="text-xs leading-5" aria-label="Conversation metadata">
    <h2 className="text-sm font-medium">Conversation</h2>
    <p className="mt-1" role="status" aria-live="polite">{status}</p>
    {snapshot?.reason === 'UNVERIFIED_SELECTORS' && <p className="mt-1 text-muted">This Instagram layout has not been verified.</p>}
    {view.status === 'error' && <p className="mt-1 text-error">{ERROR_MESSAGES[view.code]}</p>}
    <dl className="mt-2 space-y-1 text-muted">
      <div className="flex justify-between gap-2"><dt>Rendered messages</dt><dd>{detected ? snapshot.renderedMessageCount : 'Unavailable'}</dd></div>
      <div className="flex justify-between gap-2"><dt>Earliest date</dt><dd>{snapshot?.earliestRenderedDate ?? 'Unavailable'}</dd></div>
      <div className="flex justify-between gap-2"><dt>Latest date</dt><dd>{snapshot?.latestRenderedDate ?? 'Unavailable'}</dd></div>
      <div><dt className="inline">Timestamps: </dt><dd className="inline">{coverage}</dd></div>
    </dl>
    {snapshot?.calendarTimeZone && <p className="mt-1 text-muted">Calendar zone: {snapshot.calendarTimeZone}</p>}
    {detected && <p className="mt-1 text-muted">Currently rendered data only. History completeness is unknown.</p>}
  </div>;
}
