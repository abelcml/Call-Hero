import { NextResponse } from 'next/server';
import { dbEnabled, listCalls, updateStatus, STATUSES } from '@/lib/db';
import type { CallStatus } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  if (!dbEnabled()) return NextResponse.json({ enabled: false, calls: [] });
  return NextResponse.json({ enabled: true, calls: await listCalls(50) });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const b = (body && typeof body === 'object' ? body : {}) as { id?: unknown; status?: unknown };
  if (typeof b.id !== 'string' || !UUID.test(b.id)) return NextResponse.json({ error: 'id must be a uuid' }, { status: 400 });
  if (typeof b.status !== 'string' || !STATUSES.includes(b.status as CallStatus)) {
    return NextResponse.json({ error: `status must be one of ${STATUSES.join(', ')}` }, { status: 400 });
  }
  if (!dbEnabled()) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  const ok = await updateStatus(b.id, b.status as CallStatus);
  return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: 'Update failed' }, { status: 502 });
}
