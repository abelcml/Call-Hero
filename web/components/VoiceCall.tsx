'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

type Phase = 'idle' | 'connecting' | 'live' | 'ended';
interface Line { role: 'user' | 'assistant'; text: string }

export function VoiceCall({ onTranscript, disabled }: { onTranscript: (text: string) => void; disabled?: boolean }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [lines, setLines] = useState<Line[]>([]);
  const [volume, setVolume] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const vapiRef = useRef<any>(null);
  const linesRef = useRef<Line[]>([]);
  const deliveredRef = useRef(false);
  const cbRef = useRef(onTranscript);
  const listRef = useRef<HTMLDivElement>(null);
  cbRef.current = onTranscript;

  const finish = useCallback(() => {
    setPhase('ended');
    setVolume(0);
    if (deliveredRef.current) return;
    deliveredRef.current = true;
    const text = linesRef.current
      .map((l) => `${l.role === 'user' ? 'Customer' : 'Front desk'}: ${l.text}`)
      .join('\n');
    if (linesRef.current.some((l) => l.role === 'user')) cbRef.current(text);
  }, []);

  useEffect(() => () => { try { vapiRef.current?.stop(); } catch {} }, []);
  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [lines]);

  const start = useCallback(async () => {
    setError(null);
    const pub = process.env.NEXT_PUBLIC_VAPI_PUBLIC_KEY;
    const aid = process.env.NEXT_PUBLIC_VAPI_ASSISTANT_ID;
    if (!pub || !aid) {
      setError('Voice calling is not configured yet (missing Vapi keys).');
      return;
    }
    setLines([]);
    linesRef.current = [];
    deliveredRef.current = false;
    setPhase('connecting');
    try {
      if (navigator.mediaDevices?.getUserMedia) {
        const s = await navigator.mediaDevices.getUserMedia({ audio: true });
        s.getTracks().forEach((t) => t.stop());
      }
    } catch {
      setPhase('idle');
      setError('Microphone access was blocked. Allow the microphone in your browser and try again.');
      return;
    }
    try {
      const mod: any = await import('@vapi-ai/web');
      const Vapi = mod.default ?? mod;
      const vapi = new Vapi(pub);
      vapiRef.current = vapi;
      vapi.on('call-start', () => setPhase('live'));
      vapi.on('call-end', () => { vapiRef.current = null; finish(); });
      vapi.on('volume-level', (v: number) => setVolume(Math.min(1, Math.max(0, Number(v) || 0))));
      vapi.on('message', (m: any) => {
        if (m?.type === 'transcript' && m.transcriptType === 'final' && typeof m.transcript === 'string' && m.transcript.trim()) {
          const role: Line['role'] = m.role === 'user' ? 'user' : 'assistant';
          const next = [...linesRef.current, { role, text: m.transcript.trim() }];
          linesRef.current = next;
          setLines(next);
        }
      });
      vapi.on('error', (e: any) => {
        const msg = String(e?.error?.message ?? e?.message ?? '');
        console.error('[vapi]', e);
        if (linesRef.current.length === 0) {
          setError(/permission|denied|notallowed/i.test(msg) ? 'Microphone access was blocked.' : 'Could not connect the call. Please try again.');
          setPhase('idle');
        } else {
          setError('The call was interrupted.');
          finish();
        }
      });
      await vapi.start(aid);
    } catch (e) {
      console.error('[vapi] start failed', e);
      setError('Could not start the call. Please try again.');
      setPhase('idle');
    }
  }, [finish]);

  const end = useCallback(() => {
    try { vapiRef.current?.stop(); } catch {}
    // call-end event normally finalises; make sure we do not hang if it does not fire.
    setTimeout(() => { if (!deliveredRef.current) finish(); }, 1500);
  }, [finish]);

  const scale = 1 + volume * 0.6;
  const busy = phase === 'connecting' || phase === 'live';

  return (
    <section className="vc-card" aria-label="AI voice receptionist">
      <div className="vc-head">
        <div className={`vc-orb ${phase === 'live' ? 'vc-orb-live' : ''}`}>
          <span className="vc-ring" style={{ transform: `scale(${scale})`, opacity: phase === 'live' ? 0.35 + volume * 0.5 : 0 }} />
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="9" y="3" width="6" height="11" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0M12 18v3" />
          </svg>
        </div>
        <div className="vc-title">
          <h2>Talk to our AI receptionist</h2>
          <p>
            {phase === 'idle' && 'Speak to the Harbour Home Services front desk live in your browser.'}
            {phase === 'connecting' && 'Connecting...'}
            {phase === 'live' && 'Live. Speak naturally, the AI is listening.'}
            {phase === 'ended' && 'Call ended. Transcript sent for triage.'}
          </p>
        </div>
        {busy ? (
          <button type="button" className="vc-btn vc-end" onClick={end} disabled={phase === 'connecting'}>End call</button>
        ) : (
          <button type="button" className="vc-btn vc-start" onClick={start} disabled={disabled}>
            {phase === 'ended' ? 'Call again' : 'Start call'}
          </button>
        )}
      </div>
      {error && <p className="vc-error" role="alert">{error}</p>}
      {lines.length > 0 && (
        <div className="vc-log" ref={listRef} aria-live="polite">
          {lines.map((l, i) => (
            <div key={i} className={`vc-line ${l.role === 'user' ? 'vc-user' : 'vc-ai'}`}>
              <span className="vc-who">{l.role === 'user' ? 'Customer' : 'AI'}</span>
              <span>{l.text}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
