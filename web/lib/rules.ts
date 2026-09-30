import type { Decision, LlmTriage } from './types';

const REQUIRED = ['name', 'phone', 'address', 'issue'] as const;

/** Deterministic hand-off policy. Pure function. */
export function decide(llm: LlmTriage): { decision: Decision; reasons: string[] } {
  const reasons: string[] = [];
  const conf = llm.confidence;
  const pct = Math.round(conf * 100);

  if (llm.intent === 'emergency') {
    return {
      decision: 'human',
      reasons: ['Safety-critical emergency — immediate human callback required', ...(conf < 0.7 ? [`Low confidence (${pct}%)`] : [])],
    };
  }
  if (llm.intent === 'complaint') {
    reasons.push(llm.sentiment === 'negative' ? 'Unhappy customer complaint — needs a personal response' : 'Complaint — needs a human response');
    if (conf < 0.7) reasons.push(`Low confidence (${pct}%)`);
    return { decision: 'human', reasons };
  }
  if (llm.intent === 'other') {
    reasons.push('Request unclear or outside automated scope');
    if (conf < 0.7) reasons.push(`Low confidence (${pct}%)`);
    return { decision: 'human', reasons };
  }
  if (conf < 0.7) {
    return { decision: 'human', reasons: [`Low confidence (${pct}%) — a human should review`] };
  }

  if (llm.intent === 'booking' || llm.intent === 'quote') {
    const absent = REQUIRED.filter((k) => {
      const v = llm.fields?.[k];
      return !(typeof v === 'string' && v.trim()) || llm.missing.includes(k);
    });
    if (absent.length) {
      return { decision: 'human', reasons: [`Missing required details: ${absent.join(', ')}`] };
    }
    if (llm.intent === 'booking') {
      if (conf < 0.75) return { decision: 'human', reasons: [`Confidence ${pct}% is below the 75% auto-booking threshold`] };
      return { decision: 'auto', reasons: [`All required details captured, high confidence (${pct}%)`, 'Standard booking request'] };
    }
    return { decision: 'auto', reasons: [`Quote request with all details captured (${pct}% confidence)`] };
  }

  // inquiry
  return { decision: 'auto', reasons: [`General inquiry answerable automatically (${pct}% confidence)`] };
}
