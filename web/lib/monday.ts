// Monday Morning Screen — turns Jade's weekend call log into a ranked to-do list.
// Pure functions, no I/O. Everything is derived from the data, so it keeps working
// when fields are missing (null names, no recordings, no flags).

export interface WeekendCall {
  id: string;
  started_at: string;
  duration_seconds?: number;
  caller_number?: string | null;
  caller_name?: string | null;
  outcome: string;
  intent?: string;
  /** Administrative summary only. The raw clinical `summary` never reaches the client. */
  admin_summary?: string;
  summary_withheld?: boolean;
  appointment?: { date: string; time: string; type?: string; practitioner?: string; action?: string } | null;
  recording_available?: boolean;
  sentiment?: string;
  flagged?: string;
  repeat_caller?: boolean;
}
export interface WeekendData {
  clinic: { name: string; suburb?: string; practitioners?: string[]; business_hours?: string; recording_enabled?: boolean };
  period: { label?: string; from: string; to: string; note?: string };
  calls: WeekendCall[];
}

export type Category = 'urgent' | 'complaint' | 'fix_booking' | 'win_back' | 'rebook' | 'bad_number' | 'lead' | 'optional' | 'note';

export interface Person { name: string | null; phone: string | null; phoneNote?: string }

export interface ActionItem {
  id: string;
  rank: number;
  category: Category;
  /** Counter-safe headline: first name + initial only, no clinical words. */
  title: string;
  /** Why it matters, counter-safe. */
  why: string;
  /** The single next step. */
  doThis: string;
  person: Person;
  callIds: string[];
  /** Non-clinical detail that stays hidden until revealed: call IDs, times, outcomes. Never call summaries. */
  private?: string[];
  recordingAvailable: boolean;
  timeLabel: string; // when they rang, e.g. "Sun 2:14am"
  /** Jade's four core fields (name, phone, intent, booked-status) that are missing or invalid on the source call. */
  missing: string[];
  /** Steps that cannot be done yet, e.g. call-back with no confirmed number. */
  blocked: string[];
}

export interface CallRow {
  id: string; timeLabel: string; dayLabel: string; name: string; fullName: string | null; phone: string; fullPhone: string | null;
  intentWords: string; outcomeWords: string; adminSummary: string; withheld: boolean; recording: boolean;
  outcome: string; missing: string[];
}

export interface Slot { date: string; time: string; practitioner?: string; label: string; freedBy: string; freedByCallId: string }

export type BookingStatus = 'Recorded' | 'Verify' | 'Priority' | 'Practitioner note';
export interface Booking {
  callId: string;
  /** Counter-safe: first name + initial. */
  name: string;
  fullName: string | null;
  /** Masked phone. */
  phone: string;
  fullPhone: string | null;
  date: string;
  time: string;
  /** Weekday + date + time, e.g. "Wed 19 2:30pm". */
  label: string;
  practitioner?: string;
  type?: string;
  status: BookingStatus;
  reason?: string;
}

export interface MondayView {
  clinic: string;
  nowLabel: string;
  actions: ActionItem[];
  candidateActions: ActionItem[];
  potentialOpenSlots: Slot[];
  bookings: Booking[];
  calls: CallRow[];
  counts: { total: number; booked: number; newPatientsBooked: number; cancelled: number; potentialOpenSlots: number; needAction: number; noAction: number };
  leftOut: { label: string; count: number; ids: string[] }[];
  dataIssues: string[];
  recordingsAvailable: boolean;
}

// ---------- helpers ----------
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function ymd(iso: string) { return iso.slice(0, 10); }
function dayDiff(a: string, b: string) {
  return Math.round((Date.UTC(+a.slice(0, 4), +a.slice(5, 7) - 1, +a.slice(8, 10)) - Date.UTC(+b.slice(0, 4), +b.slice(5, 7) - 1, +b.slice(8, 10))) / 86400000);
}

/** Weekday in the clinic's own frame: the period note says it starts on a Friday, so we anchor to that. */
function makeWeekday(data: WeekendData) {
  const from = ymd(data.period.from);
  const real = new Date(from + 'T12:00:00Z').getUTCDay();
  const anchor = /friday/i.test((data.period.note ?? '') + (data.period.label ?? '')) ? 5 : real;
  return (date: string) => ((anchor + dayDiff(date, from)) % 7 + 7) % 7;
}

function parseHours(s?: string) {
  const m = /(\w{3})-(\w{3})\s+(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/.exec(s ?? '');
  if (!m) return null;
  const a = DAYS.indexOf(m[1]), b = DAYS.indexOf(m[2]);
  const open = new Set<number>(); for (let d = a; d !== (b + 1) % 7; d = (d + 1) % 7) open.add(d);
  return { open, start: +m[3] * 60 + +m[4], end: +m[5] * 60 + +m[6] };
}

function firstName(n?: string | null) {
  if (!n) return 'Unknown caller';
  const [f, ...rest] = n.trim().split(/\s+/);
  return rest.length ? `${f} ${rest[rest.length - 1][0]}.` : f;
}

/** +61412887301 -> 0412 887 301 ; flags length problems. */
export function formatAU(num?: string | null): { display: string | null; valid: boolean } {
  if (!num) return { display: null, valid: false };
  let d = num.replace(/[^\d+]/g, '');
  if (d.startsWith('+61')) d = '0' + d.slice(3);
  const digits = d.replace(/\D/g, '');
  const valid = digits.length === 10 && digits.startsWith('0');
  const display = valid && digits.startsWith('04') ? `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}` : digits;
  return { display, valid };
}
export function maskPhone(display: string | null) { return display ? '•••• ••• ' + display.replace(/\D/g, '').slice(-3) : '—'; }

function timeOfCall(iso: string, wd: (d: string) => number) {
  const hh = +iso.slice(11, 13), mm = iso.slice(14, 16);
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${DAYS[wd(ymd(iso))]} ${h12}:${mm}${hh < 12 ? 'am' : 'pm'}`;
}
function slotLabel(date: string, time: string, wd: (d: string) => number, today: string) {
  const [h, m] = time.split(':').map(Number);
  const t = `${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')}${h < 12 ? 'am' : 'pm'}`;
  const diff = dayDiff(date, today);
  const mon = diff >= 7 ? ' ' + new Date(date + 'T12:00:00Z').toLocaleString('en-AU', { month: 'short', timeZone: 'UTC' }) : '';
  return `${DAYS[wd(date)]} ${+date.slice(8, 10)}${mon} ${t}`;
}
export const OUTCOME_WORDS: Record<string, string> = {
  booked: 'booked', message_taken: 'message taken', no_availability: 'no time available', cancelled: 'cancelled',
  urgent_flagged: 'flagged urgent', failed_callback_number: 'callback number not confirmed', hung_up: 'hung up',
  wrong_number: 'wrong number', question_answered: 'question answered',
};
export const INTENT_WORDS: Record<string, string> = {
  new_patient: 'New patient enquiry', existing_patient: 'Existing patient booking', cancellation: 'Cancellation', billing_query: 'Billing query',
  clinic_question: 'Clinic question', out_of_scope: 'Service not offered', urgent: 'Urgent call', unknown: 'Intent not captured',
};
const intentWords = (i?: string) => INTENT_WORDS[i ?? 'unknown'] ?? (i ? i.replace(/_/g, ' ') : 'Intent not captured');
const outcomeWords = (o: string) => { const w = OUTCOME_WORDS[o] ?? o.replace(/_/g, ' '); return w.charAt(0).toUpperCase() + w.slice(1); };

const CLINICAL = /\b(pain\w*|tooth\w*|teeth|chipped|swelling|bleed\w*|nervous|anxious|anxiety|emergency department|dentist in about|hurt\w*|ache\w*|infection\w*|symptom\w*|medication\w*|whitening)\b/i;

/** Server-side: replaces each call's free-text `summary` with an administrative one. Original kept only when it has no clinical terms. */
export function withAdminSummaries(data: Omit<WeekendData, 'calls'> & { calls: (WeekendCall & { summary?: string })[] }): WeekendData {
  const wd = makeWeekday(data as unknown as WeekendData); const today = ymd(data.period.to);
  return {
    ...data,
    calls: data.calls.map(({ summary, ...c }) => {
      if (summary && !CLINICAL.test(summary)) return { ...c, admin_summary: summary, summary_withheld: false };
      const a = c.appointment;
      const parts = [`${intentWords(c.intent)}. Outcome: ${OUTCOME_WORDS[c.outcome] ?? c.outcome.replace(/_/g, ' ')}.`];
      if (a) parts.push(`${apptType(a.type) ?? 'Appointment'}${a.action ? ` (${a.action})` : ''}: ${slotLabel(a.date, a.time, wd, today)}${a.practitioner ? ' with ' + drShort(a.practitioner) : ''}.`);
      if (c.flagged === 'note_for_practitioner') parts.push('Practitioner note flagged — see clinical system.');
      if (c.flagged === 'urgent' || c.intent === 'urgent') parts.push('Flagged urgent by Jade.');
      return { ...c, admin_summary: parts.join(' '), summary_withheld: true };
    }),
  };
}

function coreMissing(c: WeekendCall) {
  const missing: string[] = []; const blocked: string[] = [];
  if (!c.caller_name) missing.push('name not captured');
  if (c.outcome === 'failed_callback_number') { missing.push('callback number invalid (9 digits)'); missing.push('booked status: not completed (no confirmed callback number)'); blocked.push('Call-back blocked: no confirmed number'); }
  else if (!c.caller_number) { missing.push('phone not captured'); blocked.push('Call-back blocked: no phone number'); }
  else if (!formatAU(c.caller_number).valid) { missing.push('phone invalid'); blocked.push('Call-back blocked: no valid number'); }
  if (!c.intent || c.intent === 'unknown') missing.push('intent not captured');
  if (!(c.outcome in OUTCOME_WORDS)) missing.push('booked status not recorded');
  return { missing, blocked };
}
const dur = (s?: number) => (s == null ? '' : s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);
/** Non-clinical call trail: id · time · outcome · duration. Never the summary. */
function callTrail(cs: WeekendCall[], wd: (d: string) => number, extra?: string[]) {
  return [...cs.map((c) => `${c.id} · ${timeOfCall(c.started_at, wd)} · ${OUTCOME_WORDS[c.outcome] ?? c.outcome.replace(/_/g, ' ')}${c.duration_seconds != null ? ' · ' + dur(c.duration_seconds) : ''}`), ...(extra ?? [])];
}
const apptType = (t?: string) => (t && /emergency/i.test(t) ? 'Priority assessment' : t);
const drShort = (p?: string) => (p ? p.replace(/^Dr\s+\w+\s+/, 'Dr ') : undefined);

// ---------- main ----------
export function buildMonday(data: WeekendData): MondayView {
  const calls = [...(data.calls ?? [])].sort((a, b) => a.started_at.localeCompare(b.started_at));
  const wd = makeWeekday(data);
  const today = ymd(data.period.to);
  const hours = parseHours(data.clinic.business_hours);
  const byNumber = new Map<string, WeekendCall[]>();
  for (const c of calls) if (c.caller_number) byNumber.set(c.caller_number, [...(byNumber.get(c.caller_number) ?? []), c]);
  const handled = new Set<string>();
  const actions: Omit<ActionItem, 'rank' | 'missing' | 'blocked'>[] = [];
  const dataIssues: string[] = [];

  const person = (c: WeekendCall): Person => {
    const f = formatAU(c.caller_number);
    return { name: c.caller_name ?? null, phone: f.display };
  };
  const rec = (cs: WeekendCall[]) => cs.some((c) => c.recording_available === true);
  const bookedLater = (c: WeekendCall) =>
    (byNumber.get(c.caller_number ?? '') ?? []).find((o) => o.started_at > c.started_at && o.outcome === 'booked');

  // Cancellation records alone cannot establish live diary availability.
  const booked = calls.filter((c) => c.outcome === 'booked' && c.appointment);
  const potentialOpenSlots: Slot[] = calls
    .filter((c) => c.appointment?.action === 'cancelled')
    .filter((c) => !booked.some((b) => b.appointment!.date === c.appointment!.date && b.appointment!.time === c.appointment!.time && b.appointment!.practitioner === c.appointment!.practitioner))
    .filter((c) => c.appointment!.date >= today)
    .map((c) => ({
      date: c.appointment!.date, time: c.appointment!.time, practitioner: c.appointment!.practitioner,
      label: slotLabel(c.appointment!.date, c.appointment!.time, wd, today), freedBy: firstName(c.caller_name), freedByCallId: c.id,
    }))
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  // 2) Urgent, unbooked -> human callback, without claiming an appointment fit.
  for (const c of calls.filter((c) => (c.flagged === 'urgent' || c.intent === 'urgent') && !bookedLater(c) && c.outcome !== 'booked')) {
    const night = +c.started_at.slice(11, 13) < 6;
    actions.push({
      id: 'a-' + c.id, category: 'urgent', person: person(c), callIds: [c.id], recordingAvailable: rec([c]),
      timeLabel: timeOfCall(c.started_at, wd),
      title: `Call ${firstName(c.caller_name)} — urgent`,
      why: `Rang ${night ? 'overnight ' : ''}at ${timeOfCall(c.started_at, wd)}; flagged urgent, no appointment yet.`,
      doThis: 'Call back first. Check urgency with the practitioner and confirm a suitable time in the live diary.',
      private: callTrail([c], wd),
    });
    handled.add(c.id);
  }

  // 3) Unresolved complaints, escalate if repeated.
  const complaintGroups = new Map<string, WeekendCall[]>();
  for (const c of calls.filter((c) => c.flagged === 'complaint' || c.intent === 'billing_query'))
    complaintGroups.set(c.caller_number ?? c.id, [...(complaintGroups.get(c.caller_number ?? c.id) ?? []), c]);
  for (const cs of complaintGroups.values()) {
    const last = cs[cs.length - 1], first = cs[0];
    actions.push({
      id: 'a-' + last.id, category: 'complaint', person: person(last), callIds: cs.map((c) => c.id), recordingAvailable: rec(cs),
      timeLabel: timeOfCall(last.started_at, wd),
      title: `${firstName(last.caller_name)} — ${cs.length > 1 ? `${cs.length} calls, ` : ''}billing complaint`,
      why: cs.length > 1 ? `First rang ${timeOfCall(first.started_at, wd)}, again ${timeOfCall(last.started_at, wd)}. No callback yet — getting more frustrated.` : `Asked for a callback from the practice manager.`,
      doThis: 'Practice manager to call back before 9am. Pull the invoice first.',
      private: callTrail(cs, wd),
    });
    cs.forEach((c) => handled.add(c.id));
  }

  // 4) Bookings Jade made outside opening hours.
  if (hours) for (const c of booked) {
    const a = c.appointment!; const d = wd(a.date); const [h, m] = a.time.split(':').map(Number); const t = h * 60 + m;
    const closedDay = !hours.open.has(d); const atClose = t >= hours.end || t < hours.start;
    if (closedDay || atClose) {
      actions.push({
        id: 'a-' + c.id, category: 'fix_booking', person: person(c), callIds: [c.id], recordingAvailable: rec([c]),
        timeLabel: timeOfCall(c.started_at, wd),
        title: `Check ${firstName(c.caller_name)}'s booking — ${closedDay ? `clinic is closed ${DAYS[d]}s` : `starts at closing time`}`,
        why: `Jade recorded ${apptType(a.type) ?? 'an appointment'} for ${slotLabel(a.date, a.time, wd, today)}${closedDay ? ', a day the clinic is closed.' : `, and the clinic closes at ${Math.floor(hours.end / 60)}:00.`}`,
        doThis: `Verify with the diary — Jade recorded ${slotLabel(a.date, a.time, wd, today)}, ${closedDay ? `clinic is closed ${DAYS[d]}s` : 'clinic closes at ' + Math.floor(hours.end / 60) + ':00'}.`,
        private: callTrail([c], wd),
      });
      handled.add(c.id);
    }
  }

  // 5) Lost / waiting new patients -> confirm their constraints before matching.
  const unbookedDemand = calls.filter((c) => c.outcome === 'no_availability' && !bookedLater(c));
  const seen = new Set<string>();
  for (const c of unbookedDemand.sort((a, b) => (a.flagged === 'lost_opportunity' ? -1 : 0) - (b.flagged === 'lost_opportunity' ? -1 : 0))) {
    const key = c.caller_number ?? c.id; if (seen.has(key)) continue; seen.add(key);
    const cs = byNumber.get(c.caller_number ?? '') ?? [c];
    const lost = cs.some((x) => x.flagged === 'lost_opportunity');
    actions.push({
      id: 'a-' + c.id, category: 'win_back', person: person(c), callIds: cs.map((x) => x.id), recordingAvailable: rec(cs),
      timeLabel: timeOfCall(cs[cs.length - 1].started_at, wd),
      title: lost ? `Win back ${firstName(c.caller_name)} — said "I'll try somewhere else"` : `${firstName(c.caller_name)} — ${cs.length > 1 ? `rang ${cs.length}×, ` : ''}no appointment${cs.some((x) => x.flagged === 'waitlist_requested') ? ', asked for waitlist' : ''}`,
      why: lost ? 'New patient who wanted to be seen this week. Nobody has followed up.' : 'New patient who couldn’t get a time that suited.',
      doThis: 'Call to confirm days, time window and clinician flexibility; then check the live diary and offer only a suitable opening.',
      private: callTrail(cs, wd),
    });
    cs.forEach((x) => handled.add(x.id));
  }

  // 7) Bad callback numbers: fall back to caller ID.
  for (const c of calls.filter((c) => c.outcome === 'failed_callback_number' || c.flagged === 'bad_data')) {
    const cid = formatAU(c.caller_number);
    actions.push({
      id: 'a-' + c.id, category: 'bad_number', person: { name: c.caller_name ?? null, phone: cid.valid ? cid.display : null, phoneNote: 'caller ID · unconfirmed' },
      callIds: [c.id], recordingAvailable: rec([c]), timeLabel: timeOfCall(c.started_at, wd),
      title: `${firstName(c.caller_name)} — callback number is a digit short`,
      why: 'Wanted a first appointment; call dropped before the number was confirmed.',
      doThis: cid.valid ? 'Try the caller-ID number (not confirmed by caller).' : 'No valid number. Check the recording, or wait for them to call again.',
      private: callTrail([c], wd),
    });
    handled.add(c.id);
  }

  // 8) Cancellations that asked to be rebooked.
  for (const c of calls.filter((c) => c.outcome === 'cancelled' && !bookedLater(c))) {
    const asked = c.flagged === 'rebook_requested';
    actions.push({
      id: 'a-' + c.id, category: 'rebook', person: person(c), callIds: [c.id], recordingAvailable: rec([c]),
      timeLabel: timeOfCall(c.started_at, wd),
      title: `Rebook ${firstName(c.caller_name)}`,
      why: `Cancelled ${slotLabel(c.appointment!.date, c.appointment!.time, wd, today)}${asked ? ' and asked to be called to rebook.' : '. Said they’d call back — they may not.'}`,
      doThis: c.flagged === 'rebook_requested' ? 'Call and book next week.' : 'Send a rebooking text.',
      private: callTrail([c], wd),
    });
    handled.add(c.id);
  }

  // 9) Service not offered -> referral lead.
  for (const c of calls.filter((c) => c.flagged === 'service_not_offered' || c.intent === 'out_of_scope')) {
    actions.push({
      id: 'a-' + c.id, category: 'lead', person: person(c), callIds: [c.id], recordingAvailable: rec([c]),
      timeLabel: timeOfCall(c.started_at, wd),
      title: `${firstName(c.caller_name)} — asked for a service we don't offer`,
      why: 'Jade promised a call back with a referral. Could also become a general patient.',
      doThis: 'Send the referral today; offer a check-up while you’re at it.',
      private: callTrail([c], wd),
    });
    handled.add(c.id);
  }

  // 10) Notes for the practitioner / priority bookings — no call needed.
  for (const c of calls.filter((c) => !handled.has(c.id) && (c.flagged === 'note_for_practitioner' || c.flagged === 'priority'))) {
    const a = c.appointment;
    actions.push({
      id: 'a-' + c.id, category: 'note', person: person(c), callIds: [c.id], recordingAvailable: rec([c]),
      timeLabel: timeOfCall(c.started_at, wd),
      title: `${c.flagged === 'priority' ? 'Priority booking' : 'Note for'} ${drShort(a?.practitioner) ?? 'practitioner'}: ${firstName(c.caller_name)}${a ? ', ' + slotLabel(a.date, a.time, wd, today) : ''}`,
      why: c.flagged === 'priority' ? 'Booked as a priority assessment. Make sure it is on the day sheet.' : 'Jade flagged a note for the practitioner. Details are in the clinical system.',
      doThis: 'Pass to the practitioner — no call needed.',
      private: callTrail([c], wd, c.flagged === 'note_for_practitioner' ? ['Practitioner note flagged by Jade — open in the clinical system'] : undefined),
    });
    handled.add(c.id);
  }

  // ---------- data issues worth mentioning ----------
  const realFrom = new Date(ymd(data.period.from) + 'T12:00:00Z').getUTCDay();
  if (/friday/i.test(data.period.note ?? '') && realFrom !== 5)
    dataIssues.push(`Dates need checking: they are labelled as a Fri–Mon weekend, but ${ymd(data.period.from)} is actually a ${['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][realFrom]}. Weekdays here follow the clinic's own framing.`);
  for (const c of calls) if (c.caller_number && !formatAU(c.caller_number).valid) dataIssues.push(`Call ${c.id}: caller ID ${c.caller_number} is not a valid AU number.`);
  for (const c of calls) if (c.outcome === 'failed_callback_number') dataIssues.push(`Call ${c.id}: the callback number Jade captured was a digit short — try the caller-ID number (not confirmed by caller).`);
  const nameless = calls.filter((c) => !c.caller_name).length;
  if (nameless) dataIssues.push(`${nameless} calls have no caller name.`);

  // ---------- bookings Jade recorded ----------
  const bookings: Booking[] = booked.map((c) => {
    const a = c.appointment!; const d = wd(a.date); const t = +a.time.slice(0, 2) * 60 + +a.time.slice(3, 5);
    const f = formatAU(c.caller_number);
    const closedDay = !!hours && !hours.open.has(d);
    const atClose = !!hours && (t >= hours.end || t < hours.start);
    const cancelledBefore = (byNumber.get(c.caller_number ?? '') ?? []).some((o) => o.started_at < c.started_at && o.outcome === 'cancelled');
    let status: BookingStatus = 'Recorded'; let reason: string | undefined;
    if (closedDay) { status = 'Verify'; reason = `clinic closed ${DAYS[d]}`; }
    else if (atClose) { status = 'Verify'; reason = 'at closing time'; }
    else if (a.action === 'rescheduled') { status = 'Verify'; reason = 'rescheduled'; }
    else if (cancelledBefore) { status = 'Verify'; reason = 'moved from cancelled'; }
    else if (c.flagged === 'priority') status = 'Priority';
    else if (c.flagged === 'note_for_practitioner') status = 'Practitioner note';
    return {
      callId: c.id, name: firstName(c.caller_name), fullName: c.caller_name ?? null, phone: maskPhone(f.display), fullPhone: f.display,
      date: a.date, time: a.time, label: slotLabel(a.date, a.time, wd, today), practitioner: drShort(a.practitioner), type: apptType(a.type), status, reason,
    };
  }).sort((x, y) => (x.status === 'Verify' ? 0 : 1) - (y.status === 'Verify' ? 0 : 1) || (x.date + x.time).localeCompare(y.date + y.time));

  // ---------- rank ----------
  const order: Category[] = ['urgent', 'complaint', 'fix_booking', 'win_back', 'bad_number', 'rebook', 'lead', 'optional', 'note'];
  const ranked = actions
    .sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category))
    .map((a, i) => ({ ...a, rank: i + 1, ...coreMissing(calls.find((c) => 'a-' + c.id === a.id) ?? calls.find((c) => a.callIds.includes(c.id))!) }));

  // ---------- left out ----------
  const rest = calls.filter((c) => !handled.has(c.id));
  const group = (label: string, f: (c: WeekendCall) => boolean) => { const cs = rest.filter(f); return { label, count: cs.length, ids: cs.map((c) => c.id) }; };
  const leftOut = [
    group('Routine bookings — already in the diary', (c) => c.outcome === 'booked'),
    group('Questions Jade answered (parking, health funds, fees)', (c) => c.outcome === 'question_answered'),
    group('Hung up before saying anything', (c) => c.outcome === 'hung_up'),
    group('Wrong number', (c) => c.outcome === 'wrong_number'),
    group('Cancelled, then rebooked themselves', (c) => c.outcome === 'cancelled' && !!bookedLater(c)),
    group('Availability enquiries later booked', (c) => c.outcome === 'no_availability' && !!bookedLater(c)),
  ];
  const coveredOut = new Set(leftOut.flatMap((g) => g.ids));
  const other = rest.filter((c) => !coveredOut.has(c.id));
  if (other.length) leftOut.push({ label: 'Other', count: other.length, ids: other.map((c) => c.id) });

  const bookedCount = booked.length;
  return {
    clinic: data.clinic.name,
    nowLabel: `${DAYS[wd(today)]} ${+today.slice(8, 10)} ${new Date(today + 'T12:00:00Z').toLocaleString('en-AU', { month: 'short', timeZone: 'UTC' })}, ${slotLabel(today, data.period.to.slice(11, 16), wd, '').split(' ').pop()}`,
    actions: ranked,
    candidateActions: ranked.filter((a) => a.category === 'win_back'),
    potentialOpenSlots,
    bookings,
    calls: calls.map((c) => {
      const f = formatAU(c.caller_number);
      return { id: c.id, timeLabel: timeOfCall(c.started_at, wd), dayLabel: `${DAYS[wd(ymd(c.started_at))]} ${+ymd(c.started_at).slice(8)}`, name: c.caller_name ? firstName(c.caller_name) : 'No name captured', fullName: c.caller_name ?? null, phone: maskPhone(f.display), fullPhone: f.display,
        intentWords: intentWords(c.intent), outcomeWords: outcomeWords(c.outcome), adminSummary: c.admin_summary ?? 'Administrative summary not provided', withheld: !!c.summary_withheld, recording: c.recording_available === true, outcome: c.outcome, missing: coreMissing(c).missing.filter((m) => !m.startsWith('booked')).map((m) => (m.startsWith('name') ? 'name' : m.startsWith('intent') ? 'intent' : m.startsWith('callback') ? 'valid callback number' : 'phone')) };
    }),
    counts: {
      total: calls.length,
      booked: bookedCount,
      newPatientsBooked: booked.filter((c) => c.intent === 'new_patient').length,
      cancelled: calls.filter((c) => c.outcome === 'cancelled').length,
      potentialOpenSlots: potentialOpenSlots.length,
      needAction: ranked.filter((a) => a.category !== 'note' && a.category !== 'optional').length,
      noAction: leftOut.reduce((n, g) => n + g.count, 0),
    },
    leftOut: leftOut.filter((g) => g.count > 0),
    dataIssues,
    recordingsAvailable: calls.some((c) => c.recording_available),
  };
}
