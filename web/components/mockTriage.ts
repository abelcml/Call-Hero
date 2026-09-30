import type { Channel, ExtractedFields, Intent, Sentiment, TriageResult, Urgency } from '@/lib/types';

/** Offline demo data: simple keyword rules so the demo works with no API/network. */

const has = (t: string, words: string[]) => words.some((w) => t.includes(w));

function nextSlot(urgent: boolean): { slot: string; label: string } {
  const d = new Date();
  if (urgent) {
    d.setHours(d.getHours() + 1, 0, 0, 0);
  } else {
    d.setDate(d.getDate() + 1);
    d.setHours(14, 0, 0, 0);
    // skip Sunday
    if (d.getDay() === 0) d.setDate(d.getDate() + 1);
  }
  const label = d
    .toLocaleString('en-AU', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })
    .replace(',', ',');
  return { slot: d.toISOString(), label };
}

function extract(text: string): ExtractedFields {
  const fields: ExtractedFields = {};
  const name =
    text.match(/(?:my name(?:'s| is)|this is|i am|i'm|it's)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/) ??
    text.match(/(?:^|[.\n]\s*)([A-Z][a-z]+)\s+here\b/);
  if (name) fields.name = name[1].trim();
  const phone = text.match(/(?:\+?61|0)[\d\s-]{8,13}\d/);
  if (phone) fields.phone = phone[0].trim();
  const addr = text.match(
    /\b\d{1,4}[A-Za-z]?(?:\/\d+)?\s+[A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+)?\s+(?:St|Street|Rd|Road|Ave|Avenue|Pde|Parade|Dr|Drive|Ln|Lane|Cres|Crescent|Pl|Place|Way|Ct|Court)\b\.?(?:,?\s+[A-Z][a-z]+)?/,
  );
  if (addr) fields.address = addr[0].trim();
  const time = text.match(
    /\b(?:(?:this|tomorrow|next|on)\s+)?(?:today|tonight|tomorrow(?:\s+(?:morning|afternoon|arvo|evening))?|monday|tuesday|wednesday|thursday|friday|saturday|sunday|(?:this|next)\s+week(?:end)?|asap|as soon as possible|right now|(?:around\s+)?\d{1,2}(?::\d{2})?\s?(?:am|pm))\b/i,
  );
  if (time) fields.preferredTime = time[0].trim();
  const issue = text.match(
    /\b(?:blocked|leaking|leak(?:y)?|burst|broken|not working|won'?t|dripping|flood(?:ed|ing)?|no (?:power|hot water)|hot water|toilet|tap|drain|switchboard|power point|light(?:s)?|sparks?|gas|smell|fence|door|window)\b[^.!?\n]*/i,
  );
  if (issue) fields.issue = issue[0].trim().slice(0, 90);
  return fields;
}

export async function mockTriage(text: string, channel: Channel = 'call'): Promise<TriageResult> {
  const started = performance.now();
  const t = text.toLowerCase();

  let intent: Intent = 'inquiry';
  if (has(t, ['burst', 'flood', 'gas ', 'gas.', 'gas smell', 'smell gas', 'sparks', 'sparking', 'smoke', 'electrocut', 'no power at all', 'water everywhere', 'emergency', 'urgent', 'right now', 'asap'])) intent = 'emergency';
  else if (has(t, ['complain', 'unhappy', 'terrible', 'unacceptable', 'refund', 'third time', 'still not', 'again', 'disappointed', 'rude', 'never showed', 'no-show', 'not happy'])) intent = 'complaint';
  else if (has(t, ['quote', 'how much', 'estimate', 'price', 'cost', 'pricing'])) intent = 'quote';
  else if (has(t, ['book', 'appointment', 'schedule', 'come out', 'come and', 'fix', 'available', 'tomorrow', 'blocked', 'leaking', 'repair'])) intent = 'booking';
  else if (has(t, ['hours', 'do you', 'service area', 'cover', 'licensed', 'insured', 'warranty'])) intent = 'inquiry';
  else if (t.trim().length < 15) intent = 'other';

  const fields = extract(text);
  const missing: string[] = [];
  if (!fields.phone) missing.push('phone');
  if (!fields.address && (intent === 'booking' || intent === 'emergency' || intent === 'quote')) missing.push('address');
  if (!fields.name) missing.push('name');

  let sentiment: Sentiment = 'neutral';
  if (has(t, ['thank', 'great', 'appreciate', 'happy with', 'love'])) sentiment = 'positive';
  if (intent === 'complaint' || has(t, ['angry', 'furious', 'terrible', 'panic', 'scared', 'worried'])) sentiment = 'negative';

  let urgency: Urgency = 'low';
  if (intent === 'emergency') urgency = 'high';
  else if (intent === 'complaint' || intent === 'booking' || has(t, ['today', 'soon', 'leak'])) urgency = 'medium';

  let confidence = 0.9 - missing.length * 0.06;
  if (intent === 'other') confidence = 0.4;
  if (intent === 'complaint') confidence = Math.min(confidence, 0.78);
  confidence = Math.max(0.3, Math.min(0.97, confidence));

  const critical = missing.includes('phone') || missing.includes('address');
  const human = intent === 'emergency' || intent === 'complaint' || intent === 'other' || confidence < 0.75 || (intent === 'booking' && critical);
  const decision = human ? ('human' as const) : ('auto' as const);

  const reasons: string[] = [];
  if (intent === 'emergency') reasons.push('Possible safety risk or property damage: a person must dispatch immediately');
  if (intent === 'complaint') reasons.push('Customer is upset: complaints need a personal response');
  if (intent === 'other') reasons.push('Request is unclear and does not match a known service');
  if (confidence < 0.75 && intent !== 'other') reasons.push(`Confidence ${Math.round(confidence * 100)}% is below the 75% auto-handling threshold`);
  if (intent === 'booking' && critical && !human) reasons.push('Missing contact details');
  if (intent === 'booking' && critical) reasons.push(`Missing key details: ${missing.filter((m) => m !== 'name').join(', ')}`);
  if (!human) {
    reasons.push(`Clear ${intent} request with high confidence (${Math.round(confidence * 100)}%)`);
    if (missing.length === 0) reasons.push('All key details were captured');
    reasons.push('Low urgency and neutral or positive tone');
  }

  const summary = fields.issue
    ? `${intent[0].toUpperCase()}${intent.slice(1)}: ${fields.issue}${fields.address ? ` at ${fields.address}` : ''}.`
    : `${intent[0].toUpperCase()}${intent.slice(1)} request received via ${channel}.`;

  let booking: TriageResult['booking'];
  let action: string;
  if (intent === 'booking' && !human) {
    const s = nextSlot(false);
    booking = { ...s, status: 'confirmed' };
    action = `Booked ${s.label} and sent confirmation to the customer`;
  } else if (intent === 'quote' && !human) {
    action = 'Sent standard price guide and offered a free on-site quote';
  } else if (intent === 'inquiry' && !human) {
    action = 'Answered the enquiry from the knowledge base';
  } else if (intent === 'emergency') {
    const s = nextSlot(true);
    booking = { ...s, status: 'proposed' };
    action = 'Paged on-call technician and flagged as priority';
  } else if (intent === 'complaint') {
    action = 'Escalated to the service manager for a same-day callback';
  } else {
    action = 'Queued for staff review';
  }

  const who = fields.name ? ` ${fields.name}` : '';
  let suggestedReply: string;
  if (intent === 'emergency')
    suggestedReply = `Hi${who}, we understand this is urgent. If anyone is in danger, please call 000. Our on-call technician has been alerted and will call you within 10 minutes. Please turn off the water or power at the mains if it is safe to do so.`;
  else if (intent === 'complaint')
    suggestedReply = `Hi${who}, I'm really sorry about your experience. Our service manager has been notified and will call you today to make this right.`;
  else if (booking)
    suggestedReply = `Hi${who}, you're booked in for ${booking.label}. Our technician will text you when they are on the way. Reply here if you need to change the time.`;
  else if (intent === 'quote')
    suggestedReply = `Hi${who}, thanks for reaching out. We offer free on-site quotes. ${missing.includes('address') ? 'What is the address of the job?' : 'We can visit at a time that suits you.'}`;
  else if (missing.length)
    suggestedReply = `Hi${who}, thanks for contacting Harbour Home Services. Could you please send your ${missing.join(' and ')} so we can get you booked in?`;
  else suggestedReply = `Hi${who}, thanks for contacting Harbour Home Services. We're open Mon-Sat 7am-6pm and service the Sydney metro area. How can we help?`;

  await new Promise((r) => setTimeout(r, 0));
  return {
    id: `mock-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    receivedAt: new Date().toISOString(),
    input: text,
    channel,
    intent,
    fields,
    confidence,
    missing,
    summary,
    sentiment,
    urgency,
    suggestedReply,
    decision,
    reasons,
    action,
    booking,
    source: 'llm',
    latencyMs: Math.max(1, Math.round(performance.now() - started)) + 600,
  };
}
