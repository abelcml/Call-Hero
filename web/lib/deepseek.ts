// Thin DeepSeek (OpenAI-compatible) chat client. Never logs or returns the API key.
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export function deepseekModel(): string {
  return process.env.DEEPSEEK_MODEL || 'deepseek-flash';
}

async function callOnce(messages: ChatMessage[], timeoutMs: number): Promise<string> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new Error('DEEPSEEK_API_KEY not set');
  const base = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: deepseekModel(),
        messages,
        response_format: { type: 'json_object' },
        // deepseek-flash is a reasoning model; disabling thinking removes reasoning tokens (verified).
        thinking: { type: 'disabled' },
        temperature: 0.2,
        max_tokens: 1500,
      }),
    });
    if (!res.ok) throw new Error(`DeepSeek HTTP ${res.status}`);
    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content !== 'string' || !content.trim()) throw new Error('Empty content');
    return content;
  } finally {
    clearTimeout(timer);
  }
}

function tryParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    const a = s.indexOf('{');
    const b = s.lastIndexOf('}');
    if (a >= 0 && b > a) return JSON.parse(s.slice(a, b + 1));
    throw new Error('Invalid JSON');
  }
}

/** Calls the model expecting a JSON object. One retry on failure/empty/invalid JSON. Throws if both fail. */
export async function chatJson(messages: ChatMessage[], timeoutMs = 15000): Promise<unknown> {
  const deadline = Date.now() + 20000;
  let lastErr: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining < 2000) break;
    try {
      const content = await callOnce(messages, Math.min(timeoutMs, remaining));
      return tryParse(content);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('LLM failed');
}
