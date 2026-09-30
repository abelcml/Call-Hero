'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { buildMonday, type ActionItem, type Booking, type CallRow, type WeekendData } from '@/lib/monday';
import { CallButton, StatusPill, TAGS, type Status } from './ActionCard';

type ViewId = 'appointments' | 'actions' | 'calls';
type Statuses = Record<string, Status>;
type Filter = 'all' | 'needs' | 'bookings' | 'questions' | 'noinfo';

const isMust = (a: ActionItem) => a.category !== 'note' && a.category !== 'optional';
const GROUPS: { title: string; cats: string[] }[] = [
  { title: 'Before 9am', cats: ['urgent', 'complaint', 'fix_booking'] },
  { title: 'Today', cats: ['win_back', 'bad_number', 'rebook', 'lead', 'optional'] },
  { title: 'No call needed', cats: ['note'] },
];
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' }, { id: 'needs', label: 'Needs action' }, { id: 'bookings', label: 'Bookings' }, { id: 'questions', label: 'Questions' }, { id: 'noinfo', label: 'No info' },
];

function parseHash(): { view: ViewId; id: string | null } {
  const h = (typeof window === 'undefined' ? '' : window.location.hash).replace(/^#/, '');
  const [v, id] = h.split('/');
  return { view: v === 'actions' || v === 'calls' ? v : 'appointments', id: id || null };
}
const titleOf = (a: ActionItem) => (a.category === 'optional' ? 'Optional: offer earlier slot' : a.title);

export default function MondayScreen({ raw }: { raw: WeekendData }) {
  const safe = true;
  const [statuses, setStatuses] = useState<Statuses>({});
  const [filter, setFilter] = useState<Filter>('all');
  const [loc, setLoc] = useState<{ view: ViewId; id: string | null }>({ view: 'appointments', id: null });
  const [last, setLast] = useState<{ actions: string | null; calls: string | null; appointments: string | null }>({ actions: null, calls: null, appointments: null });
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const on = () => { const p = parseHash(); setLoc(p); if (p.id) setLast((l) => ({ ...l, [p.view]: p.id })); };
    on(); window.addEventListener('hashchange', on); return () => window.removeEventListener('hashchange', on);
  }, []);
  useEffect(() => { if (!revealed.size) return; const t = setTimeout(() => setRevealed(new Set()), 15000); return () => clearTimeout(t); }, [revealed]);

  const view = buildMonday(raw);
  const { actions, bookings, calls, potentialOpenSlots, dataIssues } = view;

  const st = (id: string): Status => statuses[id] ?? 'new';
  const setStatus = useCallback((id: string, s: Status) => setStatuses((m) => ({ ...m, [id]: s })), []);
  const openMust = actions.filter((a) => isMust(a) && st(a.id) !== 'handled');
  const first = openMust[0];
  const openAll = actions.filter((a) => st(a.id) !== 'handled').length;
  const mustTotal = actions.filter(isMust).length;
  const done = mustTotal - openMust.length;
  const actionFor = (callId: string) => actions.find((a) => a.callIds.includes(callId));
  const bookingFor = (a: ActionItem) => bookings.find((b) => a.callIds.includes(b.callId));
  const toggleReveal = (id: string) => setRevealed((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const tab = (v: ViewId, label: string, count: number) => {
    const rec = last[v];
    return (
      <a key={v} href={`#${v}${rec ? '/' + rec : ''}`} className={`mon-tab${loc.view === v ? ' on' : ''}`} aria-current={loc.view === v ? 'page' : undefined}
        onClick={(e) => { if (loc.view === v && !loc.id) e.preventDefault(); }}>
        {label} <span className="mon-tc num">{count}</span>
      </a>
    );
  };

  const ctx = { safe, statuses, st, setStatus, view, actionFor, bookingFor, revealed, toggleReveal };

  return (
    <div className="mon">
      <a className="skip" href="#main">Skip to content</a>
      <header className="mon-top">
        <div className="wrap mon-top-in">
          <div className="mon-id">
            <span className="mon-clinic">Harbourside Dental · Monday morning</span>
            <span className="mon-now num">{view.nowLabel}</span>
          </div>
          <div className="mon-top-r">
            <span className="mon-progress num" aria-live="polite" role="status">{done} of {mustTotal} done</span>
          </div>
        </div>
        <nav className="wrap mon-tabs" aria-label="Views">
          {tab('appointments', 'Appointments', bookings.length)}
          {tab('actions', 'Staff actions', openAll)}
          {tab('calls', 'Call summaries', calls.length)}
        </nav>
      </header>

      <main className="wrap mon-main" id="main">
        {loc.view === 'appointments' && <Appointments {...ctx} first={first} moreCount={Math.max(0, openMust.length - 1)} sel={loc.id} slots={potentialOpenSlots} others={actions.filter((a) => a !== first && st(a.id) !== 'handled')} />}
        {loc.view === 'actions' && <Actions {...ctx} sel={loc.id} />}
        {loc.view === 'calls' && <Calls {...ctx} sel={loc.id} filter={filter} setFilter={setFilter} dataIssues={dataIssues} />}

      </main>
    </div>
  );
}

interface Ctx {
  safe: boolean; statuses: Statuses; st: (id: string) => Status; setStatus: (id: string, s: Status) => void;
  view: ReturnType<typeof buildMonday>; actionFor: (c: string) => ActionItem | undefined; bookingFor: (a: ActionItem) => Booking | undefined;
  revealed: Set<string>; toggleReveal: (id: string) => void;
}

function useScrollTo(id: string | null, dep: unknown) {
  useEffect(() => { if (!id) return; const el = document.getElementById('rec-' + id); el?.scrollIntoView({ block: 'center', behavior: 'smooth' }); }, [id, dep]);
}

/* ---------------- 1. Appointments ---------------- */
function Appointments({ safe, st, view, actionFor, first, moreCount, sel, slots, others }: Ctx & { first?: ActionItem; moreCount: number; sel: string | null; slots: ReturnType<typeof buildMonday>['potentialOpenSlots']; others: ActionItem[] }) {
  const { bookings, counts, candidateActions } = view;
  useScrollTo(sel, bookings.length);
  return (
    <>
      <p className="mon-strip num">
        <span><b>{counts.total}</b> calls</span><i>·</i>
        <span><b>{counts.booked}</b> booked ({counts.newPatientsBooked} new patients)</span><i>·</i>
        <span><b>{counts.cancelled}</b> cancellations → <b>{counts.potentialOpenSlots}</b> openings to verify</span><i>·</i>
        <span className="mon-strip-need"><b>{moreCount + (first ? 1 : 0)}</b> need you</span>
      </p>

      <section className="mon-first" aria-labelledby="h-first">
        <h1 id="h-first" className="mon-h1">First action <span>· do this before anything else</span></h1>
        {first ? (
          <div className={`mon-firstbox tone-${TAGS[first.category].tone}`}>
            <div className="mon-firstbody">
              <div className="mon-meta"><span className={`mon-tag t-${TAGS[first.category].tone}`}>{TAGS[first.category].label}</span><span className="mon-when">Rang {first.timeLabel}</span><StatusPill s={st(first.id)} /></div>
              <h2 className="mon-title">{first.title}</h2>
              <p className="mon-why">{first.why}</p>
              <p className="mon-do"><strong>Do this:</strong> {first.doThis}</p>
              <div className="mon-tools">
                <a className="mon-lnk" href={`#actions/${first.id}`}>Open in Staff actions →</a>
                {moreCount > 0 && <a className="mon-lnk" href="#actions">{moreCount} more need{moreCount === 1 ? 's' : ''} you →</a>}
              </div>
            </div>
            <div className="mon-firstact"><CallButton phone={first.person.phone} safe={safe} note={first.person.phoneNote} reason={first.blocked[0]} /></div>
          </div>
        ) : (
          <div className="mon-empty" role="status"><strong>Nothing needs you right now.</strong><p>{counts.total === 0 ? 'Jade took no calls while the clinic was closed.' : 'Every must-do item is handled.'}</p></div>
        )}
      </section>

      <div className="mon-grid">
        <section className="mon-ledger" aria-labelledby="h-book">
          <h2 id="h-book" className="mon-h2">Booked by Jade <span className="mon-gc">{bookings.length}</span></h2>
          {bookings.length ? (
            <ul className="mon-rows">
              {bookings.map((b) => {
                const a = actionFor(b.callId); const s = a ? st(a.id) : null;
                const handled = s === 'handled';
                const tone = handled ? 'ok' : b.status === 'Verify' ? 'warn' : b.status === 'Priority' || b.status === 'Practitioner note' ? 'info' : 'ok';
                const label = handled ? 'Handled' : b.status === 'Verify' ? `Needs review: ${b.reason}` : b.status === 'Priority' ? 'Priority booking' : b.status;
                return (
                  <li key={b.callId} id={`rec-${b.callId}`} className={`mon-row bt-${tone}${sel === b.callId ? ' is-sel' : ''}`}>
                    <div className="mon-rt num">{b.label.split(' ').slice(0, 2).join(' ')}<span>{b.label.split(' ').slice(2).join(' ')}</span></div>
                    <div className="mon-rw">
                      <strong>{safe ? b.name : b.fullName ?? b.name}</strong>
                      <span className="mon-b-ph num">{b.fullPhone ? (safe ? b.phone : b.fullPhone) : 'Number not provided'}</span>
                    </div>
                    <div className="mon-rp">{b.practitioner ?? 'Practitioner not recorded'}<span>{b.type ?? 'Type not recorded'}</span></div>
                    <div className="mon-rs">
                      <span className={`mon-st st-${tone}`}>{label}</span>
                      {a && !handled && s === 'progress' && <StatusPill s="progress" />}
                      {handled && b.status === 'Verify' && <span className="mon-b3">was: Needs review — {b.reason}</span>}
                    </div>
                    <div className="mon-rl">
                      {a ? <a className="mon-lnk" href={`#actions/${a.id}`}>Staff action →</a> : null}
                      <a className="mon-lnk" href={`#calls/${b.callId}`}>Call details →</a>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : <p className="mon-none">No bookings were recorded.</p>}
        </section>

        <aside className="mon-side" aria-label="Booking recovery and still to do">
          <section className="mon-panel mon-recovery" aria-labelledby="h-slots">
            <h2 id="h-slots" className="mon-h2">Booking recovery <span className="mon-gc">{candidateActions.length} contacts</span></h2>
            <p className="mon-recovery-intro">Cancellations and patients still looking for a time.</p>
            <h3 className="mon-recovery-sub">Potential openings · check live diary</h3>
            {slots.length ? (
              <ul className="mon-slots">
                {slots.map((s) => (
                  <li key={s.freedByCallId}>
                    <div className="mon-slot-t"><strong>{s.label}</strong>{s.practitioner && <span> · {s.practitioner.replace(/^Dr\s+\w+\s+/, 'Dr ')}</span>} <em className="mon-verify">Check diary</em></div>
                    <div className="mon-slot-f">Cancellation: {s.freedBy} · check appointment type and duration</div>
                  </li>
                ))}
              </ul>
            ) : <p className="mon-none">No cancellation openings recorded.</p>}
            <h3 className="mon-recovery-sub">People to call · ask what works</h3>
            {candidateActions.length ? (
              <ul className="mon-candidates">
                {candidateActions.map((a) => (
                  <li key={a.id}>
                    <span className="mon-candidate-name">{safe ? a.title : a.person.name ?? a.title}</span>
                    <span className="mon-candidate-reason">{a.callIds.length > 1 ? `${a.callIds.length} calls` : 'No suitable time yet'} · check suitable times</span>
                    <a className="mon-lnk" href={`#actions/${a.id}`}>Review follow-up →</a>
                  </li>
                ))}
              </ul>
            ) : <p className="mon-none">No unbooked availability requests.</p>}
            <p className="mon-recovery-rule">Check the diary and patient preferences before offering a time.</p>
          </section>
          <section className="mon-panel" aria-labelledby="h-todo">
            <h2 id="h-todo" className="mon-h2">Still to do <span className="mon-gc">{others.length}</span></h2>
            {others.length ? (
              <ul className="mon-todo">
                {others.map((a) => (
                  <li key={a.id}><a href={`#actions/${a.id}`}>{titleOf(a)}</a><StatusPill s={st(a.id)} /></li>
                ))}
              </ul>
            ) : <p className="mon-none">Nothing else open.</p>}
          </section>
        </aside>
      </div>
    </>
  );
}

/* ---------------- 2. Staff actions ---------------- */
function Actions({ safe, st, setStatus, view, bookingFor, sel }: Ctx & { sel: string | null }) {
  const { actions, calls } = view;
  const cur = actions.find((a) => a.id === sel) ?? (sel ? undefined : actions.find((a) => isMust(a) && st(a.id) !== 'handled') ?? actions[0]);
  const listRef = useRef<HTMLUListElement>(null);
  return (
    <div className={`mon-split${sel ? ' has-sel' : ''}`}>
      <div className="mon-actlist" ref={listRef as never}>
        <h1 className="mon-h1">Staff actions</h1>
        {actions.length === 0 && <p className="mon-none">No staff actions this weekend.</p>}
        {GROUPS.map((g) => {
          const items = actions.filter((a) => g.cats.includes(a.category));
          if (!items.length) return null;
          return (
            <section className="mon-group" key={g.title} aria-label={g.title}>
              <h2 className="mon-gh">{g.title} <span className="mon-gc">{items.length}</span></h2>
              <ul className="mon-alist">
                {items.map((a) => (
                  <li key={a.id}>
                    <a href={`#actions/${a.id}`} className={`mon-arow tone-${TAGS[a.category].tone}${cur?.id === a.id ? ' is-sel' : ''}${st(a.id) === 'handled' ? ' is-done' : ''}`} aria-current={cur?.id === a.id ? 'true' : undefined}>
                      <span className="mon-atitle">{titleOf(a)}</span>
                      <StatusPill s={st(a.id)} />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>

      <section className="mon-detail" aria-label="Action detail">
        {sel && !cur && <p className="mon-none">That action is not available in the current data. <a className="mon-lnk" href="#actions">Back to the list</a></p>}
        {cur && (() => {
          const s = st(cur.id); const tag = TAGS[cur.category]; const bk = bookingFor(cur);
          const evidence = cur.callIds.map((id) => calls.find((c) => c.id === id)).filter(Boolean) as CallRow[];
          return (
            <div className="mon-panel mon-dpanel">
              <a className="mon-lnk mon-backm" href="#actions" onClick={() => undefined}>← All actions</a>
              <div className="mon-meta"><span className={`mon-tag t-${tag.tone}`}>{tag.label}</span><span className="mon-when">Rang {cur.timeLabel}</span><StatusPill s={s} /></div>
              <h2 className="mon-title big">{titleOf(cur)}</h2>
              {!safe && cur.person.name && <p className="mon-who">{cur.person.name}{cur.person.phone ? ` · ${cur.person.phone}` : ''}</p>}
              <dl className="mon-dl">
                <dt>Why</dt><dd>{cur.why}</dd>
                <dt>Do this</dt><dd>{cur.doThis}</dd>
                {cur.blocked.length > 0 && <><dt>Contact issue</dt><dd><ul className="mon-miss blocked">{cur.blocked.map((m) => <li key={m}>{m}</li>)}</ul></dd></>}
                {cur.category === 'win_back' && <><dt>Before offering a time</dt><dd>Confirm the patient’s days and time window, practitioner flexibility, appointment type and duration, and check the live diary.</dd></>}
              </dl>
              <div className="mon-dcontact">
                {cur.category !== 'note' && <CallButton phone={cur.person.phone} safe={safe} note={cur.person.phoneNote} reason={cur.blocked[0] ?? 'No valid phone number on record.'} />}
              </div>
              <div className="mon-btns" role="group" aria-label="Change status">
                <button type="button" className="mon-btn" disabled={s === 'progress' || s === 'handled'} onClick={() => setStatus(cur.id, 'progress')}>Mark in progress</button>
                <button type="button" className="mon-btn primary" disabled={s === 'handled'} onClick={() => setStatus(cur.id, 'handled')}>Mark handled</button>
                <button type="button" className="mon-btn" disabled={s === 'new'} onClick={() => setStatus(cur.id, 'new')}>Reopen</button>
              </div>
              <div className="mon-links">
                {bk ? <a className="mon-lnk" href={`#appointments/${bk.callId}`}>Related appointment → <span className="mon-muted">{bk.label}</span></a> : null}
                <div>
                  <span className="mon-muted">Related calls ({evidence.length}):</span>{' '}
                  {evidence.map((c) => <a key={c.id} className="mon-lnk mon-chip" href={`#calls/${c.id}`}>{c.id} · {c.timeLabel} →</a>)}
                </div>
              </div>
            </div>
          );
        })()}
      </section>
    </div>
  );
}

/* ---------------- 3. Call summaries ---------------- */
function Calls({ safe, st, view, actionFor, revealed, toggleReveal, sel, filter, setFilter, dataIssues }: Ctx & { sel: string | null; filter: Filter; setFilter: (f: Filter) => void; dataIssues: string[] }) {
  const { calls, bookings } = view;
  const pred = (f: Filter, c: CallRow) => f === 'all' ? true : f === 'needs' ? !!actionFor(c.id) : f === 'bookings' ? c.outcome === 'booked' : f === 'questions' ? c.outcome === 'question_answered' : c.outcome === 'hung_up' || c.outcome === 'wrong_number';
  const shown = calls.filter((c) => pred(filter, c));
  useScrollTo(sel, filter);
  const selHidden = sel && calls.some((c) => c.id === sel) && !shown.some((c) => c.id === sel);
  return (
    <>
      <h1 className="mon-h1">Call summaries <span>· {calls.length} calls</span></h1>
      <div className="mon-chips" role="group" aria-label="Filter calls">
        {FILTERS.map((f) => (
          <button key={f.id} type="button" className={`mon-fchip${filter === f.id ? ' on' : ''}`} aria-pressed={filter === f.id} onClick={() => setFilter(f.id)}>
            {f.label} <span className="num">{calls.filter((c) => pred(f.id, c)).length}</span>
          </button>
        ))}
      </div>
      {selHidden && <p className="mon-none">The selected call is hidden by the current filter. <button type="button" className="mon-link" onClick={() => setFilter('all')}>Show all calls</button></p>}
      {shown.length === 0 ? <p className="mon-none">{calls.length ? 'No calls match this filter.' : 'No calls this weekend.'}</p> : (
        <ul className="mon-calls">
          {shown.map((c, i) => {
            const a = actionFor(c.id); const b = bookings.find((x) => x.callId === c.id);
            const newDay = i === 0 || shown[i - 1].dayLabel !== c.dayLabel;
            const hide = safe && !revealed.has(c.id);
            return (
              <li key={c.id} className="mon-cwrap">
                {newDay && <div className="mon-day">{c.dayLabel}</div>}
                <div id={`rec-${c.id}`} className={`mon-crow${sel === c.id ? ' is-sel' : ''}`}>
                  <div className="mon-c1"><strong className="num">{c.id}</strong><span className="num">{c.timeLabel}</span></div>
                  <div className="mon-c2">
                    <div><strong>{safe ? c.name : c.fullName ?? c.name}</strong>{c.fullName === null && null}</div>
                    <div className="mon-b-ph num">{c.fullPhone ? (safe ? c.phone : c.fullPhone) : 'Number not provided'}</div>
                  </div>
                  <div className="mon-c3">
                    <div><b>{c.intentWords}</b> · {c.outcomeWords}</div>
                    <p className="mon-sum">
                      {hide ? <button type="button" className="mon-link" onClick={() => toggleReveal(c.id)}>Show summary</button> : c.adminSummary}
                    </p>
                    <div className="mon-rec">{c.recording ? <span className="mon-recok">Recording available</span> : <span className="mon-norec">No recording</span>}</div>
                  </div>
                  <div className="mon-c4">
                    {a ? <a className="mon-lnk" href={`#actions/${a.id}`}>Staff action → <StatusPill s={st(a.id)} /></a> : null}
                    {b ? <a className="mon-lnk" href={`#appointments/${b.callId}`}>Appointment →</a> : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
