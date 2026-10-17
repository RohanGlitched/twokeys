import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { ask, type AskInput } from '@/lib/ask';
import { labKey } from '@/lib/labkey';
import { CONDITIONS } from '@/lib/conditions';
import { readJson } from '@/lib/http';
import { limited } from '@/lib/ratelimit';
import { store } from '@/lib/store';

/** Answers carry a server signature; only signed answers come back as history, so a client can't put words in the explainer's mouth. */
const sign = (text: string) => Array.from(hmac(sha256, labKey(), new TextEncoder().encode(`twokeys/ask-history/v1|${text}`)), (b) => b.toString(16).padStart(2, '0')).join('');

export async function POST(req: Request) {
  const b = await readJson<Partial<AskInput>>(req);
  if (b instanceof Response) return b;
  const question = typeof b.question === 'string' ? b.question.trim() : '';
  if (!question || question.length > 600) return Response.json({ error: 'Ask a question of up to 600 characters.' }, { status: 400 });
  const known = (xs: unknown) => (Array.isArray(xs) ? xs.filter((g): g is string => typeof g === 'string' && g in CONDITIONS).slice(0, 8) : []);

  // A small hourly budget per client keeps the demo's model spend bounded.
  if (await limited(req, 'ask', 40)) return Response.json({ error: 'You’ve asked a lot this hour. A counsellor can answer the rest.' }, { status: 429 });

  const out = await ask({
    lang: b.lang === 'ar' ? 'ar' : 'en',
    level: b.level === 'simple' || b.level === 'detailed' ? b.level : 'standard',
    genes: known(b.genes),
    xl: known(b.xl),
    sex: b.sex === 'F' || b.sex === 'M' ? b.sex : undefined,
    strengths: b.strengths && typeof b.strengths === 'object' ? Object.fromEntries(Object.entries(b.strengths).filter(([g, v]) => g in CONDITIONS && [0, 1, 2].includes(Number(v))).map(([g, v]) => [g, Number(v)])) : undefined,
    related: !!b.related,
    question,
    history: Array.isArray(b.history)
      ? (b.history as { role?: string; text?: unknown; sig?: unknown }[])
        .filter((h) => h && typeof h.text === 'string' && (h.role === 'user' || (h.role === 'assistant' && typeof h.sig === 'string' && h.sig === sign(h.text as string))))
        .map((h) => ({ role: h.role as 'user' | 'assistant', text: h.text as string })).slice(-6)
      : [],
  });
  // Monitoring without content: daily counts of how each answer was produced, never the question.
  const day = new Date().toISOString().slice(0, 10);
  const db = store();
  const ttl = 60 * 60 * 24 * 90;
  await Promise.all([
    db.incr(`mon:${day}:route:${out.route}`, ttl),
    db.incr(`mon:${day}:lang:${b.lang === 'ar' ? 'ar' : 'en'}`, ttl),
    out.escalate ? db.incr(`mon:${day}:escalate`, ttl) : null,
    out.urgent ? db.incr(`mon:${day}:urgent`, ttl) : null,
    out.model ? db.incr(`mon:${day}:model:${out.model}`, ttl) : null,
  ]).catch((e) => console.error('monitor write failed', e));
  return Response.json({ ...out, sig: sign(out.answer) }, { headers: { 'cache-control': 'no-store' } });
}
