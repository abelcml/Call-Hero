'use client';

import { useEffect, useRef, useState } from 'react';
import type { TriageResult } from '@/lib/types';

/** Assumption for the demo only: average value of one job, in AUD. */
export const AVG_JOB_VALUE_AUD = 350;

const money = new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 });

/** Animated count-up; snaps instantly when the user prefers reduced motion. */
function useCountUp(target: number) {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const start = from.current;
    if (start === target) return;
    let reduced = false;
    try {
      reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {
      /* ignore */
    }
    if (reduced) {
      from.current = target;
      setShown(target);
      return;
    }
    const t0 = performance.now();
    const dur = 650;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      const v = Math.round(start + (target - start) * e);
      from.current = v;
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return shown;
}

function Stat({
  label,
  value,
  format,
  note,
  tone,
}: {
  label: string;
  value: number;
  format: (n: number) => string;
  note: string;
  tone?: 'ok' | 'warn';
}) {
  const shown = useCountUp(value);
  return (
    <div className={`stat ${tone ? `stat-${tone}` : ''}`}>
      <div className="stat-label">
        {tone && <span className="stat-dot" aria-hidden="true" />}
        {label}
      </div>
      <div className="stat-value num" aria-label={format(value)}>
        <span aria-hidden="true">{format(shown)}</span>
      </div>
      <div className="stat-note">{note}</div>
    </div>
  );
}

export function StatsBar({ results }: { results: TriageResult[] }) {
  const total = results.length;
  const auto = results.filter((r) => r.decision === 'auto').length;
  const escalated = total - auto;
  const plain = (n: number) => String(n);
  return (
    <section aria-label="Today's stats" className="stats">
      <Stat label="Total handled" value={total} format={plain} note="calls and messages" />
      <Stat label="Auto-resolved" value={auto} format={plain} note="no staff time needed" tone="ok" />
      <Stat label="Escalated" value={escalated} format={plain} note="sent to a human" tone="warn" />
      <Stat label="Est. customers recovered" value={total} format={plain} note="would have been missed" />
      <Stat
        label="Est. revenue saved"
        value={auto * AVG_JOB_VALUE_AUD}
        format={(n) => money.format(n)}
        note={`assumption: ${money.format(AVG_JOB_VALUE_AUD)} avg job x auto`}
      />
    </section>
  );
}
