'use client';
import type { Category } from '@/lib/monday';
import { maskPhone } from '@/lib/monday';

export const TAGS: Record<Category, { label: string; tone: 'bad' | 'warn' | 'accent' | 'neutral' }> = {
  urgent: { label: 'Urgent', tone: 'bad' },
  complaint: { label: 'Complaint', tone: 'warn' },
  fix_booking: { label: 'Fix booking', tone: 'warn' },
  win_back: { label: 'Win back', tone: 'accent' },
  optional: { label: 'Optional', tone: 'neutral' },
  bad_number: { label: 'Bad number', tone: 'neutral' },
  rebook: { label: 'Rebook', tone: 'neutral' },
  lead: { label: 'Lead', tone: 'neutral' },
  note: { label: 'Note', tone: 'neutral' },
};

export type Status = 'new' | 'progress' | 'handled';
export const STATUS_LABEL: Record<Status, string> = { new: 'New', progress: 'In progress', handled: 'Handled' };

export function StatusPill({ s }: { s: Status }) {
  return <span className={`mon-sp sp-${s}`}>{STATUS_LABEL[s]}</span>;
}

/** Call button: masked in counter-safe mode; disabled with a stated reason when there is no valid number. */
export function CallButton({ phone, safe, note, reason, hidden }: { phone: string | null; safe: boolean; note?: string; reason?: string; hidden?: boolean }) {
  if (hidden) return null;
  if (!phone) return (
    <div className="mon-callwrap">
      <button type="button" className="mon-call" disabled>No valid number</button>
      <span className="mon-pnote">{reason ?? 'No valid phone number on record.'}</span>
    </div>
  );
  const label = safe ? `Call ${maskPhone(phone)}` : `Call ${phone}`;
  return (
    <div className="mon-callwrap">
      <a className="mon-call" href={`tel:${phone.replace(/\D/g, '')}`} aria-label={`${label}${note ? ` (${note})` : ''}`}><span aria-hidden="true">☎</span> {label}</a>
      {note && <span className="mon-pnote">{note}</span>}
    </div>
  );
}
