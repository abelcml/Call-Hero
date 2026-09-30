import { NextResponse } from 'next/server';
import type { Channel } from '@/lib/types';
import { triage } from '@/lib/triage';
import { deepseekModel } from '@/lib/deepseek';
import { saveCall } from '@/lib/db';

export const runtime = 'nodejs';
export const maxDuration = 30;
export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ ok: true, model: deepseekModel() });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const b = (body && typeof body === 'object' ? body : {}) as { text?: unknown; channel?: unknown; source?: unknown };
  if (typeof b.text !== 'string' || !b.text.trim()) {
    return NextResponse.json({ error: 'text is required and must be a non-empty string' }, { status: 400 });
  }
  const text = b.text.trim();
  if (text.length > 2000) {
    return NextResponse.json({ error: 'text must be at most 2000 characters' }, { status: 400 });
  }
  const channel: Channel = b.channel === 'message' ? 'message' : 'call';
  try {
    const result = await triage(text, channel);
    const source = b.source === 'voice' || b.source === 'phone' ? b.source : 'web';
    const dbId = await saveCall(result, { source });
    result.origin = source;
    if (dbId) {
      result.dbId = dbId;
      result.status = 'new';
    }
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
