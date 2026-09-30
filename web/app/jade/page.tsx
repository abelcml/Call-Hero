'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CallStatus, Channel, Scenario, TriageResult } from '@/lib/types';
import { scenarios } from '@/lib/scenarios';
import { CallSimulator, type SimError } from '@/components/CallSimulator';
import { ResultCard } from '@/components/ResultCard';
import { ActivityLog, type LogItem } from '@/components/ActivityLog';
import { StatsBar } from '@/components/StatsBar';
import { mockTriage } from '@/components/mockTriage';

export default function Page() {
  const [text, setText] = useState('');
  const [channel, setChannel] = useState<Channel>('call');
  const [autoRun, setAutoRun] = useState(false);
  const [mock, setMock] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<SimError | null>(null);
  const [items, setItems] = useState<LogItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeScenario, setActiveScenario] = useState<string | null>(null);
  const seq = useRef(0);
  // Persistence (Supabase via /api/calls). When disabled everything below is inert.
  const [dbOn, setDbOn] = useState(false);
  const [dbItems, setDbItems] = useState<TriageResult[]>([]);
  const [freshIds, setFreshIds] = useState<Set<string>>(new Set());
  const knownIds = useRef<Set<string> | null>(null);
  const statusOv = useRef<Map<string, CallStatus>>(new Map());

  const loadCalls = useCallback(async () => {
    try {
      const res = await fetch('/api/calls', { cache: 'no-store' });
      if (!res.ok) return;
      const data = (await res.json()) as { enabled?: boolean; calls?: TriageResult[] };
      if (!data.enabled) {
        setDbOn(false);
        return;
      }
      const calls = (data.calls ?? []).map((c) => {
        const ov = statusOv.current.get(c.id);
        if (ov) {
          if (c.status === ov) statusOv.current.delete(c.id);
          else return { ...c, status: ov };
        }
        return c;
      });
      const known = knownIds.current;
      if (known) {
        const added = calls.filter((c) => !known.has(c.id)).map((c) => c.id);
        if (added.length) {
          setFreshIds((prev) => new Set([...prev, ...added]));
          window.setTimeout(() => setFreshIds((prev) => new Set([...prev].filter((x) => !added.includes(x)))), 4500);
        }
      }
      knownIds.current = new Set([...(known ?? []), ...calls.map((c) => c.id)]);
      setDbOn(true);
      setDbItems(calls);
    } catch {
      /* keep last good state */
    }
  }, []);

  useEffect(() => {
    void loadCalls();
    const t = window.setInterval(() => {
      if (!document.hidden) void loadCalls();
    }, 5000);
    return () => window.clearInterval(t);
  }, [loadCalls]);

  // Session items (this browser) merged with DB records; DB copy wins (status/origin), dedup by id / dbId.
  const all: LogItem[] = useMemo(() => {
    if (!dbOn) return items;
    const byId = new Map<string, LogItem>();
    for (const i of items) byId.set(i.result.id, i);
    for (const d of dbItems) byId.set(d.id, { result: d, offline: byId.get(d.id)?.offline ?? false });
    return [...byId.values()]
      .sort((a, b) => b.result.receivedAt.localeCompare(a.result.receivedAt));
  }, [items, dbItems, dbOn]);

  const onStatus = useCallback((r: TriageResult, status: CallStatus) => {
    if (!r.dbId) return;
    statusOv.current.set(r.id, status);
    const patch = (x: TriageResult) => (x.id === r.id ? { ...x, status } : x);
    setItems((prev) => prev.map((i) => ({ ...i, result: patch(i.result) })));
    setDbItems((prev) => prev.map(patch));
    void fetch('/api/calls', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: r.dbId, status }),
    }).catch(() => statusOv.current.delete(r.id));
  }, []);

  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get('mock') === '1') setMock(true);
    } catch {
      /* ignore */
    }
  }, []);

  const run = useCallback(
    async (t: string, ch: Channel, forceMock = false, source: 'web' | 'voice' | 'phone' = 'web') => {
      if (!t.trim()) return;
      const my = ++seq.current;
      setLoading(true);
      setError(null);
      const useMock = forceMock || mock;
      try {
        let result: TriageResult;
        if (useMock) {
          await new Promise((r) => setTimeout(r, 900));
          result = await mockTriage(t, ch);
        } else {
          let res: Response;
          try {
            res = await fetch('/api/triage', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ text: t, channel: ch, source }),
            });
          } catch {
            throw new SimFail('Could not reach the AI service. Check your connection.', true);
          }
          let data: unknown = null;
          try {
            data = await res.json();
          } catch {
            /* non-JSON body */
          }
          const apiErr = (data as { error?: string } | null)?.error;
          if (!res.ok || apiErr || !data || typeof (data as TriageResult).decision !== 'string') {
            throw new SimFail(apiErr || `The AI service returned an error (${res.status}).`, res.status >= 500 || !res.ok && !apiErr);
          }
          result = data as TriageResult;
        }
        if (my !== seq.current) return;
        knownIds.current?.add(result.id); // our own submission: no "new arrival" highlight
        setItems((prev) => [{ result, offline: useMock }, ...prev.filter((i) => i.result.id !== result.id)]);
        setSelectedId(result.id);
      } catch (e) {
        if (my !== seq.current) return;
        const f = e instanceof SimFail ? e : new SimFail('Unexpected error. Please try again.', true);
        setError({ message: f.message, canFallback: f.canFallback });
      } finally {
        if (my === seq.current) setLoading(false);
      }
    },
    [mock],
  );

  /** Single entry point for any text to triage (typed, sample, or a voice-call transcript). */
  const processText = useCallback(
    (t: string, ch: Channel, source: 'web' | 'voice' | 'phone' = 'web') => run(t, ch, false, source),
    [run],
  );

  const onScenario = (s: Scenario) => {
    setText(s.text);
    setChannel(s.channel);
    setActiveScenario(s.id);
    setError(null);
    if (autoRun) void processText(s.text, s.channel, 'web');
  };

  const selected = all.find((i) => i.result.id === selectedId) ?? null;

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="header">
        <div className="wrap header-in">
          <div className="brand">
            <span className="logo" aria-hidden="true">
              <svg viewBox="0 0 20 20" width="20" height="20" fill="none">
                <rect x="3" y="8" width="2.4" height="4" rx="1.2" fill="currentColor" />
                <rect x="7.6" y="4.5" width="2.4" height="11" rx="1.2" fill="currentColor" />
                <rect x="12.2" y="6.5" width="2.4" height="7" rx="1.2" fill="currentColor" />
              </svg>
            </span>
            <span className="brand-name">AI Front Desk</span>
            <span className="pill-demo">Demo &middot; Harbour Home Services</span>
          </div>
          <span className="online"><i className="online-dot" aria-hidden="true" />AI online</span>
        </div>
      </header>

      <main id="main" className="wrap">
        <section className="hero" aria-label="Why it matters">
          <h1>Every call answered. <span>Every customer kept.</span></h1>
          <p>
            Small businesses lose customers every time a call goes unanswered. The AI books the easy jobs and hands the
            tricky ones to your team with a ready reply.
          </p>
        </section>

        <StatsBar results={all.map((i) => i.result)} />

        <div className="grid">
          <div className="col">
            {/* VOICE_CALL_SLOT: integrator drops <VoiceCall onTranscript={(text) => void processText(text, 'call', 'voice')} /> here */}
            <CallSimulator
              scenarios={scenarios}
              text={text}
              channel={channel}
              autoRun={autoRun}
              loading={loading}
              mock={mock}
              error={error}
              activeScenario={activeScenario}
              onText={(v) => {
                setText(v);
                setActiveScenario(null);
              }}
              onChannel={setChannel}
              onAutoRun={setAutoRun}
              onScenario={onScenario}
              onSubmit={() => void processText(text, channel, 'web')}
              onFallback={() => {
                setMock(true);
                void run(text, channel, true);
              }}
              onToggleMock={() => {
                setMock((m) => !m);
                setError(null);
              }}
            />
            <ActivityLog items={all} selectedId={selectedId} onSelect={setSelectedId} freshIds={freshIds} />
          </div>
          <div className="col">
            <ResultCard item={selected} loading={loading} onStatus={onStatus} />
          </div>
        </div>

        <footer className="footer">
          Demo data only. Revenue figure is an assumption, not a measurement.
        </footer>
      </main>
    </>
  );
}

class SimFail extends Error {
  canFallback: boolean;
  constructor(message: string, canFallback: boolean) {
    super(message);
    this.canFallback = canFallback;
  }
}
