import type { ExtractedFields, TriageResult } from '@/lib/types';
import { ConfidenceMeter } from './ConfidenceMeter';
import { STEPS } from './CallSimulator';
import { PipelineStepper } from './PipelineStepper';
import { cap, originLabel, StatusControl, type LogItem } from './ActivityLog';
import type { CallStatus } from '@/lib/types';

const FIELD_LABELS: [keyof ExtractedFields, string][] = [
  ['name', 'Name'],
  ['phone', 'Phone'],
  ['address', 'Address'],
  ['preferredTime', 'Preferred time'],
  ['issue', 'Issue'],
];

const MONO_FIELDS: (keyof ExtractedFields)[] = ['phone'];

export function ResultCard({
  item,
  loading,
  step,
  onStatus,
}: {
  item: LogItem | null;
  loading: boolean;
  step?: number;
  onStatus?: (r: TriageResult, s: CallStatus) => void;
}) {
  void step;
  return (
    <section className="card result" aria-labelledby="res-h" aria-live="polite" aria-busy={loading}>
      <div className="card-head">
        <h2 id="res-h">AI result</h2>
        {item?.offline && !loading && <span className="tag offline">Offline demo data</span>}
      </div>
      <PipelineStepper loading={loading} result={item && !loading ? item.result : null} />
      {loading ? (
        <Skeleton />
      ) : !item ? (
        <Empty />
      ) : (
        <Result key={item.result.id} item={item} onStatus={onStatus} />
      )}
    </section>
  );
}

function Empty() {
  return (
    <div className="empty">
      <svg className="empty-art" viewBox="0 0 220 120" width="220" height="120" fill="none" aria-hidden="true">
        <rect x="14" y="18" width="112" height="70" rx="12" className="art-card" />
        <rect x="28" y="34" width="52" height="6" rx="3" className="art-bar" />
        <rect x="28" y="48" width="80" height="6" rx="3" className="art-bar" />
        <rect x="28" y="62" width="36" height="6" rx="3" className="art-bar" />
        <path d="M40 88l-8 14 20-10" className="art-card" strokeLinejoin="round" />
        <rect x="104" y="46" width="94" height="58" rx="12" className="art-accent" />
        <path d="M122 76l9 9 20-20" className="art-check" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="190" cy="30" r="5" className="art-dot" />
        <circle cx="166" cy="20" r="3" className="art-dot2" />
      </svg>
      <p className="empty-title">No call processed yet</p>
      <p className="empty-sub">Pick a sample or paste a call to see the AI front desk work.</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="skeleton" role="status">
      <span className="sr-only">{STEPS.join(', ')}</span>
      <div className="sk sk-hero" />
      <div className="sk sk-line" />
      <div className="sk sk-line short" />
      <div className="sk sk-grid" />
    </div>
  );
}

function CheckIcon({ draw }: { draw?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
      <path
        className={draw ? 'draw' : ''}
        d="M5.5 12.5l4.2 4.2 8.8-9.4"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function HandoffIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" stroke="currentColor" strokeWidth="2" />
      <path d="M3.5 19c.4-3.2 2.6-5 5.5-5 1.5 0 2.7.4 3.6 1.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M15 17.5h5.5m0 0l-2.2-2.2m2.2 2.2l-2.2 2.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function AlertIcon() {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" aria-hidden="true">
      <path d="M12 4.2l8.6 15H3.4l8.6-15z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M12 10v4.2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="16.9" r="1.1" fill="currentColor" />
    </svg>
  );
}

function BookingTicket({ booking }: { booking: NonNullable<TriageResult['booking']> }) {
  const m = booking.label.match(/^(\w{3,9})\s+(\d{1,2})\s+(\w{3,9}),?\s*(.*)$/);
  const confirmed = booking.status === 'confirmed';
  return (
    <div className="ticket">
      <div className="ticket-cal" aria-hidden="true">
        {m ? (
          <>
            <span className="ticket-mon">{m[3].slice(0, 3)}</span>
            <span className="ticket-day num">{m[2]}</span>
            <span className="ticket-dow">{m[1].slice(0, 3)}</span>
          </>
        ) : (
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
            <rect x="4" y="5.5" width="16" height="14" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
            <path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        )}
      </div>
      <div className="ticket-main">
        <div className="label">{confirmed ? 'Booking confirmed' : 'Proposed booking'}</div>
        <div className="ticket-slot">{booking.label}</div>
      </div>
      <span className={`pill ${confirmed ? 'pill-auto' : 'pill-human'}`}>{cap(booking.status)}</span>
    </div>
  );
}

function Result({ item, onStatus }: { item: LogItem; onStatus?: (r: TriageResult, s: CallStatus) => void }) {
  const r = item.result;
  const auto = r.decision === 'auto';
  const escalatedHigh = !auto && (r.urgency === 'high' || r.intent === 'emergency');
  const tone = auto ? 'auto' : escalatedHigh ? 'urgent' : 'human';
  return (
    <div className="result-body">
      <div className={`decision decision-${tone}`}>
        <div className="decision-head">
          <span className="decision-ico">{auto ? <CheckIcon draw /> : escalatedHigh ? <AlertIcon /> : <HandoffIcon />}</span>
          <div>
            <div className="decision-kicker">{auto ? 'Decision: automatic' : escalatedHigh ? 'Decision: urgent handoff' : 'Decision: human handoff'}</div>
            <div className="decision-title">{auto ? 'Handled automatically' : 'Escalated to human'}</div>
          </div>
        </div>
        <ul className="reasons">
          {r.reasons.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
        <p className="action">
          <span className="label">Action</span>
          {r.action}
        </p>
      </div>

      <div className="block">
        <p className="summary">{r.summary}</p>
        <div className="tags">
          <span className={`tag intent intent-${r.intent}`}>{cap(r.intent)}</span>
          <span className={`tag urg urg-${r.urgency}`}>{cap(r.urgency)} urgency</span>
          <span className={`tag sent sent-${r.sentiment}`}>
            <i className="tag-dot" aria-hidden="true" />
            {cap(r.sentiment)}
          </span>
          <span className="tag chan">{r.channel === 'call' ? 'Call' : 'Message'}</span>
          {originLabel(r) && <span className={`tag origin${r.isDemo || r.origin === 'seed' ? ' origin-demo' : ''}`}>{originLabel(r)}</span>}
          {r.privacy && r.privacy.masked.length > 0 && (
            <span className="tag privacy">
              <svg viewBox="0 0 16 16" width="11" height="11" fill="none" aria-hidden="true">
                <rect x="3" y="7" width="10" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.6" />
                <path d="M5.5 7V5.2a2.5 2.5 0 015 0V7" stroke="currentColor" strokeWidth="1.6" />
              </svg>
              Privacy: {r.privacy.masked.join(', ')} masked before AI
            </span>
          )}
        </div>
        {r.dbId && onStatus && (
          <div className="status-row">
            <span className="label">Follow-up</span>
            <StatusControl result={r} onStatus={onStatus} />
          </div>
        )}
      </div>

      <div className="block">
        <div className="label">Confidence</div>
        <ConfidenceMeter value={r.confidence} />
      </div>

      <div className="block">
        <div className="label">Extracted details</div>
        <dl className="kv">
          {FIELD_LABELS.map(([k, label]) => {
            const v = r.fields?.[k];
            return (
              <div key={k} className={`kv-row ${k === 'issue' ? 'wide' : ''}`}>
                <dt>{label}</dt>
                <dd className={MONO_FIELDS.includes(k) && v ? 'mono' : ''}>{v ? v : <span className="chip-missing">Missing</span>}</dd>
              </div>
            );
          })}
        </dl>
      </div>

      {r.booking && <BookingTicket booking={r.booking} />}

      <div className="block">
        <div className="label reply-label">
          {auto ? (
            <>
              <svg viewBox="0 0 16 16" width="12" height="12" fill="none" aria-hidden="true">
                <path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Sent to customer
            </>
          ) : (
            'Suggested reply (staff)'
          )}
        </div>
        <div className="chat">
          <span className={`avatar ${auto ? '' : 'avatar-draft'}`} aria-hidden="true">AI</span>
          <div className={`bubble ${auto ? '' : 'bubble-draft'}`}>{r.suggestedReply}</div>
        </div>
      </div>

      {r.source === 'fallback' && (
        <p className="warn-note" role="note">
          AI fallback: the language model was unavailable, so rule-based triage was used and the case was escalated for safety.
        </p>
      )}

      <div className="meta mono">
        <span>Processed in {r.latencyMs} ms</span>
        <span aria-hidden="true">&middot;</span>
        <span>Source: {r.source === 'llm' ? 'AI model' : 'fallback rules'}</span>
        <span aria-hidden="true">&middot;</span>
        <span>{r.id}</span>
      </div>

      <details className="raw">
        <summary>Raw JSON</summary>
        <pre className="mono">{JSON.stringify(r, null, 2)}</pre>
      </details>
    </div>
  );
}
