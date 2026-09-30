import type { BookingProposal, Channel, ExtractedFields, Intent, LlmTriage, Sentiment, TriageResult, Urgency } from './types';
import { chatJson } from './deepseek';
import { buildMessages } from './prompt';
import { decide } from './rules';
import { proposeSlot } from './booking';
import { redact, restore } from './redact';

const INTENTS: Intent[] = ['booking', 'quote', 'complaint', 'emergency', 'inquiry', 'other'];
const SENTIMENTS: Sentiment[] = ['positive', 'neutral', 'negative'];
const URGENCIES: Urgency[] = ['low', 'medium', 'high'];
const REQUIRED = ['name', 'phone', 'address', 'issue'] as const;

const str = (v: unknown, max = 500): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : undefined;

export function normalizeLlm(raw: unknown): LlmTriage {
  if (!raw || typeof raw !== 'object') throw new Error('LLM output is not an object');
  const r = raw as Record<string, unknown>;
  const intent = INTENTS.includes(r.intent as Intent) ? (r.intent as Intent) : 'other';
  const rf = (r.fields && typeof r.fields === 'object' ? r.fields : {}) as Record<string, unknown>;
  const fields: ExtractedFields = {};
  for (const k of ['name', 'phone', 'address', 'preferredTime', 'issue'] as const) {
    const v = str(rf[k]);
    if (v) fields[k] = v;
  }
  let confidence = typeof r.confidence === 'number' ? r.confidence : parseFloat(String(r.confidence));
  if (!Number.isFinite(confidence)) confidence = 0.5;
  if (confidence > 1 && confidence <= 100) confidence /= 100;
  confidence = Math.min(1, Math.max(0, confidence));

  let missing = Array.isArray(r.missing) ? r.missing.filter((x): x is string => typeof x === 'string') : [];
  if (intent === 'booking' || intent === 'quote' || intent === 'emergency') {
    // Code is the source of truth for what's missing.
    const derived = REQUIRED.filter((k) => !fields[k]);
    missing = Array.from(new Set([...derived, ...missing.filter((m) => (REQUIRED as readonly string[]).includes(m) && !fields[m as keyof ExtractedFields])]));
  } else if (!Array.isArray(r.missing)) missing = [];

  return {
    intent,
    fields,
    confidence,
    missing,
    summary: str(r.summary, 400) ?? 'No summary available.',
    sentiment: SENTIMENTS.includes(r.sentiment as Sentiment) ? (r.sentiment as Sentiment) : 'neutral',
    urgency: URGENCIES.includes(r.urgency as Urgency) ? (r.urgency as Urgency) : 'medium',
    suggestedReply: str(r.suggestedReply, 1200) ?? 'Thanks for contacting Harbour Home Services. A team member will be in touch shortly.',
  };
}

const EMERGENCY_RE = /gas|burst|flood|fire|smoke|spark|burning|electrocut|shock|sewage|overflow|no power|blackout|煤气|燃气|漏气|爆管|水管爆|漏水严重|淹|着火|火|冒烟|火花|触电|停电|跳闸/i;

function fallbackTriage(text: string): LlmTriage {
  const emergency = EMERGENCY_RE.test(text);
  return {
    intent: 'other',
    fields: {},
    confidence: 0,
    missing: [],
    summary: emergency
      ? 'AI unavailable — message contains possible emergency keywords. Call the customer back immediately.'
      : 'AI unavailable — message needs manual review.',
    sentiment: 'neutral',
    urgency: emergency ? 'high' : 'medium',
    suggestedReply: emergency
      ? 'We received your message and a technician will call you right away. If there is a gas smell, flooding or electrical danger, please leave the area and call 000.'
      : 'Thanks for contacting Harbour Home Services. A team member will get back to you shortly.',
  };
}

function buildAction(llm: LlmTriage, decision: 'auto' | 'human', booking?: BookingProposal): string {
  if (decision === 'human') {
    if (llm.intent === 'emergency') return 'Escalated to on-call technician — call back within 5 minutes';
    if (llm.intent === 'complaint') return 'Escalated to customer care manager — personal follow-up required';
    if (llm.intent === 'booking' || llm.intent === 'quote') {
      return llm.missing.length
        ? `Sent reply asking customer for ${llm.missing.join(', ')}; queued for staff follow-up`
        : 'Queued for staff review before confirming';
    }
    return 'Routed to front-desk staff for review';
  }
  if (llm.intent === 'booking' && booking) return `Booked ${booking.label} and sent confirmation to customer`;
  if (llm.intent === 'quote') return 'Logged quote request and replied with next steps';
  return 'Replied to customer inquiry automatically';
}

function restoreLlm(llm: LlmTriage, map: Record<string, string>): LlmTriage {
  const fields: ExtractedFields = {};
  for (const [k, v] of Object.entries(llm.fields)) if (typeof v === 'string') fields[k as keyof ExtractedFields] = restore(v, map);
  return { ...llm, fields, summary: restore(llm.summary, map), suggestedReply: restore(llm.suggestedReply, map) };
}

export async function triage(rawText: string, channel: Channel = 'call'): Promise<TriageResult> {
  const start = Date.now();
  // Mask PII (phone/email/card) before anything is sent to the LLM.
  const { text, map, masked } = redact(rawText);
  let llm: LlmTriage;
  let source: 'llm' | 'fallback' = 'llm';
  try {
    llm = normalizeLlm(await chatJson(buildMessages(text, channel)));
  } catch (e) {
    console.error('[triage] LLM failed:', e instanceof Error ? e.message : 'unknown');
    llm = fallbackTriage(text);
    source = 'fallback';
  }

  let decision: 'auto' | 'human';
  let reasons: string[];
  if (source === 'fallback') {
    decision = 'human';
    reasons = ['AI unavailable — routed to a human'];
  } else ({ decision, reasons } = decide(llm));

  llm = restoreLlm(llm, map);
  reasons = reasons.map((x) => restore(x, map));

  let booking: BookingProposal | undefined;
  if (decision === 'auto' && llm.intent === 'booking') {
    const p = proposeSlot(llm.fields.preferredTime, llm.urgency);
    booking = { ...p, status: 'confirmed' };
  }

  return {
    ...llm,
    id: crypto.randomUUID(),
    receivedAt: new Date().toISOString(),
    input: text,
    channel,
    decision,
    reasons,
    action: restore(source === 'fallback' ? (llm.urgency === 'high' ? 'Escalated to on-call technician — call back within 5 minutes' : 'Routed to front-desk staff for review') : buildAction(llm, decision, booking), map),
    booking,
    source,
    privacy: { masked },
    latencyMs: Date.now() - start,
  };
}
