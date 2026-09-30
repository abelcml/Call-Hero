'use client';

import { useEffect, useRef, useState } from 'react';
import type { Channel, Scenario } from '@/lib/types';

export const STEPS = ['Understanding request', 'Extracting details', 'Deciding'];

export interface SimError {
  message: string;
  canFallback: boolean;
}

interface Props {
  scenarios: Scenario[];
  text: string;
  channel: Channel;
  autoRun: boolean;
  loading: boolean;
  mock: boolean;
  error: SimError | null;
  activeScenario: string | null;
  onText: (t: string) => void;
  onChannel: (c: Channel) => void;
  onAutoRun: (v: boolean) => void;
  onScenario: (s: Scenario) => void;
  onSubmit: () => void;
  onFallback: () => void;
  onToggleMock: () => void;
}

export function CallSimulator(p: Props) {
  const [step, setStep] = useState(0);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!p.loading) {
      setStep(0);
      return;
    }
    const id = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 900);
    return () => clearInterval(id);
  }, [p.loading]);

  const isCall = p.channel === 'call';
  const empty = p.text.trim().length === 0;

  const tone = (s: Scenario) => (s.expectDecision === 'auto' ? 'auto' : s.expectIntent === 'emergency' ? 'urgent' : 'human');

  return (
    <section className="card" aria-labelledby="sim-h">
      <div className="card-head">
        <h2 id="sim-h">Incoming {isCall ? 'call' : 'message'}</h2>
        <div className="seg" role="group" aria-label="Channel">
          {(['call', 'message'] as Channel[]).map((c) => (
            <button
              key={c}
              type="button"
              className="seg-btn"
              aria-pressed={p.channel === c}
              onClick={() => p.onChannel(c)}
              disabled={p.loading}
            >
              {c === 'call' ? <PhoneIcon /> : <MsgIcon />}
              {c === 'call' ? 'Call' : 'Message'}
            </button>
          ))}
        </div>
      </div>

      <div className="chips-head">
        <span id="chips-l" className="label">Try a sample</span>
        <span className="legend" aria-hidden="true">
          <span className="legend-i"><i className="dot dot-auto" />Auto</span>
          <span className="legend-i"><i className="dot dot-human" />Human</span>
          <span className="legend-i"><i className="dot dot-urgent" />Emergency</span>
        </span>
      </div>
      <div className="chips" role="group" aria-labelledby="chips-l">
        {p.scenarios.map((s) => (
          <button
            key={s.id}
            type="button"
            className="chip"
            aria-pressed={p.activeScenario === s.id}
            disabled={p.loading}
            title={`Expected: ${s.expectDecision === 'auto' ? 'handled automatically' : s.expectIntent === 'emergency' ? 'emergency escalation' : 'escalated to human'}`}
            onClick={() => {
              p.onScenario(s);
              ref.current?.focus();
            }}
          >
            <i className={`dot dot-${tone(s)}`} aria-hidden="true" />
            {s.label}
            <span className="chip-ch" aria-hidden="true">{s.channel === 'call' ? <PhoneIcon /> : <MsgIcon />}</span>
          </button>
        ))}
      </div>

      <div className="editor">
        <div className="editor-bar">
          <label htmlFor="transcript" className="editor-label">
            <i className={`rec ${p.loading ? 'rec-on' : ''}`} aria-hidden="true" />
            {isCall ? 'Call transcript' : 'Customer message'}
          </label>
          <span className="mono editor-count">{p.text.length} chars</span>
        </div>
        <textarea
          id="transcript"
          ref={ref}
          className="textarea"
          rows={5}
          value={p.text}
          placeholder={
            isCall
              ? 'Paste a call transcript, e.g. "Hi, my kitchen tap is leaking, can someone come tomorrow?"'
              : 'Type or paste a customer message'
          }
          onChange={(e) => p.onText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && !empty && !p.loading) {
              e.preventDefault();
              p.onSubmit();
            }
          }}
        />
      </div>

      <div className="actions">
        <button type="button" className="btn primary" disabled={empty || p.loading} onClick={p.onSubmit}>
          {p.loading ? (
            <>
              <span className="spinner" aria-hidden="true" /> Processing&hellip;
            </>
          ) : (
            'Process with AI'
          )}
        </button>
        <span className="hint">
          <kbd>Ctrl</kbd><span className="hint-plus">/</span><kbd>&#8984;</kbd><span className="hint-plus">+</span><kbd>Enter</kbd>
        </span>
      </div>

      <div className="actions-sub">
        <label className="check">
          <input type="checkbox" checked={p.autoRun} onChange={(e) => p.onAutoRun(e.target.checked)} />
          Auto-run
        </label>
        <button type="button" className="btn link" onClick={p.onToggleMock} disabled={p.loading}>
          {p.mock ? 'Switch to live AI' : 'Use offline demo data'}
        </button>
      </div>

      <div className="status" aria-live="polite">
        {p.loading && (
          <p className="status-line">
            <span className="status-n mono">{step + 1}/{STEPS.length}</span> {STEPS[step]}&hellip;
          </p>
        )}
      </div>

      {p.error && (
        <div className="error" role="alert">
          <p>
            <strong>Something went wrong.</strong> {p.error.message}
          </p>
          <div className="error-actions">
            <button type="button" className="btn small" onClick={p.onSubmit}>
              Retry
            </button>
            {p.error.canFallback && (
              <button type="button" className="btn small primary" onClick={p.onFallback}>
                Use offline demo data
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
      <path d="M4.2 2h2l1 2.6-1.3.9a7 7 0 003.6 3.6l.9-1.3 2.6 1v2A1.7 1.7 0 0111.3 12.5 9.6 9.6 0 013.5 4.7 1.7 1.7 0 014.2 2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}
function MsgIcon() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" aria-hidden="true">
      <path d="M2.5 4.5A1.5 1.5 0 014 3h8a1.5 1.5 0 011.5 1.5v5A1.5 1.5 0 0112 11H7l-3 2.5V11a1.5 1.5 0 01-1.5-1.5v-5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}
