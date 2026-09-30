import type { BookingProposal, Urgency } from './types';

const TZ = 'Australia/Sydney';
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

interface Parts { y: number; m: number; d: number; h: number; mi: number; dow: number }

function partsIn(date: Date): Parts {
  const f = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', hourCycle: 'h23', weekday: 'short',
  });
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(date)) o[p.type] = p.value;
  const dow = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(o.weekday);
  return { y: +o.year, m: +o.month, d: +o.day, h: +o.hour, mi: +o.minute, dow };
}

/** Convert a Sydney wall-clock time to a real instant. */
function sydneyToDate(y: number, m: number, d: number, h: number): Date {
  const guess = Date.UTC(y, m - 1, d, h, 0);
  let t = guess;
  for (let i = 0; i < 2; i++) {
    const p = partsIn(new Date(t));
    const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi);
    t += guess - asUtc;
  }
  return new Date(t);
}

interface Slot { date: Date; dayOffset: number; hour: number; dow: number; taken: boolean }

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

function label(date: Date): string {
  const f = new Intl.DateTimeFormat('en-AU', {
    timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true,
  });
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(date)) o[p.type] = p.value;
  return `${o.weekday} ${o.day} ${o.month}, ${o.hour}:${o.minute} ${o.dayPeriod.toUpperCase()}`;
}

/** Next 5 business days (incl. today if still within hours), 8:00-16:00 hourly. */
export function generateSlots(now = new Date()): Slot[] {
  const n = partsIn(now);
  const slots: Slot[] = [];
  let dayOffset = 0;
  let business = 0;
  while (business < 5 && dayOffset < 14) {
    const base = new Date(Date.UTC(n.y, n.m - 1, n.d + dayOffset));
    const y = base.getUTCFullYear(), m = base.getUTCMonth() + 1, d = base.getUTCDate();
    const dow = base.getUTCDay();
    if (dow !== 0 && dow !== 6) {
      business++;
      for (let h = 8; h <= 16; h++) {
        const date = sydneyToDate(y, m, d, h);
        if (date.getTime() <= now.getTime() + 60 * 60 * 1000) continue; // need >=1h notice
        const taken = hash(`${y}-${m}-${d}-${h}`) % 100 < 35;
        slots.push({ date, dayOffset, hour: h, dow, taken });
      }
    }
    dayOffset++;
  }
  return slots;
}

export function proposeSlot(preferredTime: string | undefined, urgency: Urgency = 'medium', now = new Date()): BookingProposal {
  const free = generateSlots(now).filter((s) => !s.taken);
  const hint = (preferredTime || '').toLowerCase();
  const nowP = partsIn(now);

  let pick: Slot | undefined;
  if (urgency === 'high') {
    pick = free[0];
  } else if (hint) {
    const wantsToday = /\btoday\b|今天/.test(hint);
    const wantsTomorrow = /tomorrow|tmrw|tmr\b|明天/.test(hint);
    const zh = hint.match(/(?:周|星期|礼拜)([日天一二三四五六])/);
    const zhIdx = zh ? '日一二三四五六'.indexOf(zh[1] === '天' ? '日' : zh[1]) : -1;
    const dayIdx = zhIdx >= 0 ? zhIdx : DAYS.findIndex((dn) => hint.includes(dn) || hint.includes(dn.slice(0, 3) + ' ') || new RegExp(`\\b${dn.slice(0, 3)}\\b`).test(hint));
    const morning = /morning|\bam\b|上午|早/.test(hint);
    const arvo = /arvo|afternoon|\bpm\b|下午/.test(hint);
    let cands = free;
    if (wantsToday) cands = cands.filter((s) => s.dayOffset === 0);
    else if (wantsTomorrow) {
      cands = cands.filter((s) => s.dayOffset === 1);
    } else if (dayIdx >= 0) cands = cands.filter((s) => s.dow === dayIdx);
    if (morning) cands = cands.filter((s) => s.hour < 12);
    else if (arvo) cands = cands.filter((s) => s.hour >= 13);
    pick = cands[0];
  }
  pick = pick ?? free[0] ?? generateSlots(now)[0];
  return { slot: pick.date.toISOString(), label: label(pick.date), status: 'proposed' };
}
