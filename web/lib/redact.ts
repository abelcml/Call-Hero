// PII masking applied BEFORE text is sent to the LLM. Cards are never restored.

export interface RedactResult {
  text: string;
  map: Record<string, string>;
  masked: string[]; // e.g. ['phone','email','card']
}

const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g;
// 13-19 digits, optionally separated by single spaces/dashes
const CARD_RE = /(?<![\d+])(?:\d[ -]?){12,18}\d(?!\d)/g;
// +61 4xx xxx xxx | +61 (0)2 9xxx xxxx | (02) 9xxx xxxx | 0400 000 123 | 02-9xxx-xxxx | other +CC numbers
const PHONE_RES: RegExp[] = [
  /(?<![\w])\+?61[\s-]?\(?0?\)?[\s-]?[2-478](?:[\s-]?\d){8}(?!\d)/g,
  /(?<![\w])\(?0[2-478]\)?(?:[\s-]?\d){8}(?!\d)/g,
  /(?<![\w])\+\d{1,3}[\s-]?\(?\d{1,4}\)?(?:[\s-]?\d){6,10}(?!\d)/g,
  /(?<![\w])1[38]00[\s-]?\d{3}[\s-]?\d{3}(?!\d)/g,
];

export function redact(input: string): RedactResult {
  const map: Record<string, string> = {};
  const counters: Record<string, number> = {};
  const seen: Record<string, string> = {};
  const masked = new Set<string>();

  const sub = (text: string, re: RegExp, kind: 'PHONE' | 'EMAIL' | 'CARD', label: string, validate?: (m: string) => boolean) =>
    text.replace(re, (m) => {
      if (validate && !validate(m)) return m;
      const key = `${kind}:${m}`;
      if (seen[key]) return seen[key];
      const n = (counters[kind] = (counters[kind] ?? 0) + 1);
      const ph = `[${kind}_${n}]`;
      seen[key] = ph;
      if (kind !== 'CARD') map[ph] = m; // cards are intentionally not kept
      masked.add(label);
      return ph;
    });

  let t = input;
  t = sub(t, EMAIL_RE, 'EMAIL', 'email');
  t = sub(t, CARD_RE, 'CARD', 'card', (m) => luhnish(m));
  for (const re of PHONE_RES) t = sub(t, re, 'PHONE', 'phone');
  return { text: t, map, masked: Array.from(masked) };
}

// 13-19 digit run; accept Luhn-valid, or any run that has card-like grouping (4-4-4-4).
function luhnish(m: string): boolean {
  const d = m.replace(/\D/g, '');
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = +d[d.length - 1 - i];
    if (i % 2 === 1) { n *= 2; if (n > 9) n -= 9; }
    sum += n;
  }
  return sum % 10 === 0 || /^\d{4}[ -]\d{4}[ -]\d{4}[ -]\d{1,7}$/.test(m);
}

export function restore(s: string, map: Record<string, string>): string {
  return s
    .replace(/\[CARD_\d+\]/g, '[CARD REDACTED]')
    .replace(/\[(?:PHONE|EMAIL)_\d+\]/g, (ph) => map[ph] ?? ph);
}
