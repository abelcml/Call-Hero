import type { CallStatus, TriageResult } from '@/lib/types';

export interface LogItem {
  result: TriageResult;
  offline: boolean;
}

export const STATUS_LABEL: Record<CallStatus, string> = { new: 'New', in_progress: 'Called back', done: 'Done' };
export const STATUS_ORDER: CallStatus[] = ['new', 'in_progress', 'done'];

export function originLabel(r: TriageResult): string | null {
  if (r.isDemo || r.origin === 'seed') return 'Demo data';
  if (r.origin === 'voice') return 'Voice';
  if (r.origin === 'phone') return 'Phone';
  if (r.origin === 'web') return 'Web';
  return null;
}

/** Segmented New / Called back / Done control; only meaningful for persisted records. */
export function StatusControl({ result, onStatus }: { result: TriageResult; onStatus: (r: TriageResult, s: CallStatus) => void }) {
  const cur = result.status ?? 'new';
  return (
    <div className="status-seg" role="group" aria-label="Follow-up status">
      {STATUS_ORDER.map((s) => (
        <button key={s} type="button" className="status-btn" aria-pressed={cur === s} onClick={() => onStatus(result, s)}>
          {STATUS_LABEL[s]}
        </button>
      ))}
    </div>
  );
}

export const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export function ActivityLog({
  items,
  selectedId,
  onSelect,
  freshIds,
}: {
  items: LogItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  freshIds?: Set<string>;
}) {
  return (
    <section className="card log-card" aria-labelledby="log-h">
      <div className="card-head">
        <h2 id="log-h">Today&rsquo;s inbox</h2>
        <span className="count mono">{items.length} item{items.length === 1 ? '' : 's'}</span>
      </div>
      {items.length === 0 ? (
        <div className="empty-small">
          <svg viewBox="0 0 32 32" width="28" height="28" fill="none" aria-hidden="true">
            <path d="M4 18l3.2-9.2A2 2 0 019.1 7.5h13.8a2 2 0 011.9 1.3L28 18v6a2 2 0 01-2 2H6a2 2 0 01-2-2v-6z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M4 18h6.5l1.5 3h8l1.5-3H28" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
          </svg>
          <p>Your inbox is clear. Processed calls and messages will appear here, newest first.</p>
        </div>
      ) : (
        <ul className="log">
          {items.map(({ result: r, offline }) => {
            const tone = r.decision === 'auto' ? 'auto' : r.urgency === 'high' || r.intent === 'emergency' ? 'urgent' : 'human';
            return (
              <li key={r.id}>
                <button
                  type="button"
                  className={`log-item rail-${tone}${freshIds?.has(r.id) ? ' fresh' : ''}`}
                  aria-current={r.id === selectedId ? 'true' : undefined}
                  onClick={() => onSelect(r.id)}
                >
                  <span className="log-top">
                    <span className={`tag intent intent-${r.intent}`}>{cap(r.intent)}</span>
                    <span className={`pill pill-${r.decision}`}>{r.decision === 'auto' ? 'Auto' : 'Escalated'}</span>
                    {offline && <span className="tag offline">Offline</span>}
                    {originLabel(r) && <span className={`tag origin${r.isDemo || r.origin === 'seed' ? ' origin-demo' : ''}`}>{originLabel(r)}</span>}
                    {r.dbId && r.status && r.status !== 'new' && (
                      <span className={`tag status-${r.status}`}>{STATUS_LABEL[r.status]}</span>
                    )}
                    <time className="log-time mono" dateTime={r.receivedAt}>
                      {new Date(r.receivedAt).toLocaleTimeString('en-AU', { hour: 'numeric', minute: '2-digit' })}
                    </time>
                  </span>
                  <span className="log-summary">{r.summary}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
