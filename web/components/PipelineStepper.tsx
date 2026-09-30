'use client';

import { useEffect, useState } from 'react';
import type { TriageResult } from '@/lib/types';

const NODES = [
  { key: 'understand', label: 'Understand', live: 'Understanding request' },
  { key: 'extract', label: 'Extract', live: 'Extracting details' },
  { key: 'decide', label: 'Decide', live: 'Deciding' },
  { key: 'act', label: 'Act', live: 'Taking action' },
] as const;

const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

function captions(r: TriageResult): string[] {
  const n = Object.values(r.fields ?? {}).filter((v) => typeof v === 'string' && v.trim()).length;
  const act = r.booking
    ? r.booking.status === 'confirmed'
      ? 'Booked'
      : 'Booking proposed'
    : r.decision === 'auto'
      ? 'Reply sent'
      : 'Staff alerted';
  return [cap(r.intent), `${n} field${n === 1 ? '' : 's'}`, r.decision === 'auto' ? 'Auto' : 'Human', act];
}

/** 4-step pipeline. Idle = dim, loading = steps light up in sequence, result = all complete. */
export function PipelineStepper({ loading, result }: { loading: boolean; result: TriageResult | null }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!loading) {
      setStep(0);
      return;
    }
    const id = setInterval(() => setStep((s) => Math.min(s + 1, NODES.length - 1)), 900);
    return () => clearInterval(id);
  }, [loading]);

  const done = !loading && !!result;
  const caps = done && result ? captions(result) : null;
  const tone = done && result ? (result.decision === 'auto' ? 'auto' : result.urgency === 'high' || result.intent === 'emergency' ? 'urgent' : 'human') : '';

  const live = loading
    ? `Step ${step + 1} of 4: ${NODES[step].live}`
    : done && caps
      ? `Pipeline complete. ${NODES.map((n, i) => `${n.label}: ${caps[i]}`).join('. ')}.`
      : '';

  return (
    <div className="pipe" data-state={loading ? 'loading' : done ? 'done' : 'idle'}>
      <ol className="pipe-list" aria-label="Processing pipeline">
        {NODES.map((n, i) => {
          const state = loading ? (i < step ? 'done' : i === step ? 'active' : 'idle') : done ? 'done' : 'idle';
          const isDecide = i === 2;
          return (
            <li key={n.key} className={`pipe-node is-${state} ${done && isDecide ? `tone-${tone}` : ''}`}>
              <span className="pipe-dot" aria-hidden="true">
                {state === 'done' ? (
                  <svg viewBox="0 0 16 16" width="12" height="12" fill="none">
                    <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  <span className="num">{i + 1}</span>
                )}
              </span>
              <span className="pipe-label">{n.label}</span>
              <span className="pipe-cap">{caps ? caps[i] : state === 'active' ? '…' : ' '}</span>
            </li>
          );
        })}
      </ol>
      <p className="sr-only" aria-live={done ? 'polite' : 'off'}>{live}</p>
    </div>
  );
}
