import type { CallSource, CallStatus, TriageResult } from './types';

// Server-only Supabase PostgREST access (secret key, RLS on with no policies).
const base = () => (process.env.SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
const key = () => (process.env.SUPABASE_SECRET_KEY ?? '').trim();

export function dbEnabled(): boolean {
  return /^https?:\/\//.test(base()) && !!key();
}

const headers = (extra: Record<string, string> = {}) => ({
  apikey: key(),
  Authorization: `Bearer ${key()}`,
  'Content-Type': 'application/json',
  ...extra,
});

export const STATUSES: CallStatus[] = ['new', 'in_progress', 'done'];
export const SOURCES: CallSource[] = ['web', 'voice', 'phone', 'seed'];

export async function saveCall(
  result: TriageResult,
  opts: { source?: CallSource; isDemo?: boolean; createdAt?: string } = {},
): Promise<string | null> {
  if (!dbEnabled()) return null;
  try {
    const row: Record<string, unknown> = {
      source: opts.source ?? 'web',
      channel: result.channel,
      input_redacted: result.input,
      intent: result.intent,
      decision: result.decision,
      urgency: result.urgency,
      summary: result.summary,
      result,
      is_demo: !!opts.isDemo,
    };
    if (opts.createdAt) row.created_at = opts.createdAt;
    const res = await fetch(`${base()}/rest/v1/calls`, {
      method: 'POST',
      headers: headers({ Prefer: 'return=representation' }),
      body: JSON.stringify(row),
      cache: 'no-store',
    });
    if (!res.ok) {
      console.error('[db] saveCall failed', res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const data = (await res.json()) as { id?: string }[];
    return data?.[0]?.id ?? null;
  } catch (e) {
    console.error('[db] saveCall error', e instanceof Error ? e.message : 'unknown');
    return null;
  }
}

interface Row {
  id: string;
  created_at: string;
  source: CallSource;
  status: CallStatus;
  is_demo: boolean;
  result: TriageResult;
}

export async function listCalls(limit = 50): Promise<TriageResult[]> {
  if (!dbEnabled()) return [];
  try {
    const n = Math.min(200, Math.max(1, Math.floor(limit)));
    const res = await fetch(
      `${base()}/rest/v1/calls?select=id,created_at,source,status,is_demo,result&order=created_at.desc&limit=${n}`,
      { headers: headers(), cache: 'no-store' },
    );
    if (!res.ok) {
      console.error('[db] listCalls failed', res.status, (await res.text()).slice(0, 200));
      return [];
    }
    const rows = (await res.json()) as Row[];
    return rows
      .filter((r) => r.result && typeof r.result === 'object')
      .map((r) => ({
        ...r.result,
        dbId: r.id,
        status: r.status,
        origin: r.is_demo ? 'seed' : r.source,
        isDemo: r.is_demo,
        receivedAt: r.created_at,
      }));
  } catch (e) {
    console.error('[db] listCalls error', e instanceof Error ? e.message : 'unknown');
    return [];
  }
}

export async function updateStatus(id: string, status: CallStatus): Promise<boolean> {
  if (!dbEnabled()) return false;
  try {
    const res = await fetch(`${base()}/rest/v1/calls?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify({ status }),
      cache: 'no-store',
    });
    if (!res.ok) console.error('[db] updateStatus failed', res.status);
    return res.ok;
  } catch (e) {
    console.error('[db] updateStatus error', e instanceof Error ? e.message : 'unknown');
    return false;
  }
}
