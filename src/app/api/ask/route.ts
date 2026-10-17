import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { ask, EXPLAINER_VERSION } from '@/lib/ask';
import { parseAskBody } from '@/lib/askinput';
import { subkey } from '@/lib/labkey';
import { readJson } from '@/lib/http';
import { limited } from '@/lib/ratelimit';
import { store } from '@/lib/store';

/**
 * Both sides of the conversation carry a server signature bound to their role; only signed turns come back
 * as history, so a client can neither put words in the explainer's mouth nor slip in an unchecked "question".
 */
const sign = (role: 'user' | 'assistant', text: string) => Array.from(hmac(sha256, subkey('ask-history'), new TextEncoder().encode(`twokeys/ask-history/v2|${role}|${text}`)), (b) => b.toString(16).padStart(2, '0')).join('');

export async function POST(req: Request) {
  const b = await readJson<Record<string, unknown>>(req);
  if (b instanceof Response) return b;
  const input = parseAskBody(b, (role, text, sig) => typeof sig === 'string' && sig === sign(role, text));
  if ('error' in input) return Response.json({ error: input.error }, { status: 400 });

  // A small hourly budget per client keeps the demo's model spend bounded.
  if (await limited(req, 'ask', 40)) return Response.json({ error: 'You’ve asked a lot this hour. A counsellor can answer the rest.' }, { status: 429 });

  const out = await ask(input);
  // Monitoring without content: daily counts of how each answer was produced, never the question.
  const day = new Date().toISOString().slice(0, 10);
  const db = store();
  const ttl = 60 * 60 * 24 * 90;
  const failed = out.route === 'fallback' ? Object.entries(out.checks).filter(([, ok]) => !ok).map(([k]) => k) : [];
  await Promise.all([
    db.incr(`mon:${day}:route:${out.route}`, ttl),
    db.incr(`mon:${day}:lang:${input.lang}`, ttl),
    db.incr(`mon:${day}:version:${EXPLAINER_VERSION}`, ttl),
    out.escalate ? db.incr(`mon:${day}:escalate`, ttl) : null,
    out.urgent ? db.incr(`mon:${day}:urgent`, ttl) : null,
    out.model ? db.incr(`mon:${day}:model:${out.model}`, ttl) : null,
    out.repairs ? db.incr(`mon:${day}:repaired`, ttl) : null,
    ...failed.map((k) => db.incr(`mon:${day}:fail:${k}`, ttl)),
  ]).catch((e) => console.error('monitor write failed', e));
  return Response.json({ ...out, version: EXPLAINER_VERSION, sig: sign('assistant', out.answer), qsig: sign('user', input.question) }, { headers: { 'cache-control': 'no-store' } });
}
