import { NextResponse } from 'next/server';
import { triage } from '@/lib/triage';

export const runtime = 'nodejs';
export const maxDuration = 30;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v);

function extractTranscript(message: Obj): string {
  const artifact = isObj(message.artifact) ? message.artifact : {};
  for (const t of [artifact.transcript, message.transcript]) {
    if (typeof t === 'string' && t.trim()) return t.trim();
  }
  const msgs = Array.isArray(artifact.messages)
    ? artifact.messages
    : Array.isArray(message.messages)
      ? message.messages
      : [];
  const lines: string[] = [];
  for (const m of msgs) {
    if (!isObj(m)) continue;
    const role = String(m.role ?? '');
    const text = String(m.message ?? m.content ?? '').trim();
    if (!text) continue;
    if (role === 'user') lines.push(`Customer: ${text}`);
    else if (role === 'assistant' || role === 'bot') lines.push(`Front desk: ${text}`);
  }
  return lines.join('\n');
}

export async function POST(req: Request) {
  const secret = process.env.VAPI_WEBHOOK_SECRET;
  if (secret) {
    const got = req.headers.get('x-vapi-secret');
    if (got !== secret) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: true });
  }
  const message = isObj(body) && isObj(body.message) ? body.message : isObj(body) ? body : {};
  if (message.type !== 'end-of-call-report') return NextResponse.json({ ok: true });

  const call = isObj(message.call) ? message.call : {};
  const callType = String(call.type ?? '');
  // Web calls are processed by the browser (onTranscript -> /api/triage), avoid duplicates.
  if (callType === 'webCall') return NextResponse.json({ ok: true, skipped: 'web-call' });

  const text = extractTranscript(message);
  if (!text) return NextResponse.json({ ok: true, skipped: 'empty' });

  try {
    const result = await triage(text, 'call');
    let saved: string | null = null;
    try {
      const db = (await import('@/lib/db').catch(() => null)) as
        | { saveCall?: (r: unknown, o: { source: string }) => Promise<string | null> }
        | null;
      if (db?.saveCall) saved = await db.saveCall(result, { source: 'phone' });
    } catch (e) {
      console.error('[vapi webhook] saveCall failed', e);
    }
    return NextResponse.json({ ok: true, id: saved ?? result.id });
  } catch (e) {
    console.error('[vapi webhook] triage failed', e);
    return NextResponse.json({ ok: true });
  }
}
