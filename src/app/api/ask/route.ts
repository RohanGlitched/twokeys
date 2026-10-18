import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { ask, EXPLAINER_VERSION } from '@/lib/ask';
import { parseAskBody } from '@/lib/askinput';
import { subkey } from '@/lib/labkey';
import { readJson } from '@/lib/http';
import { limited } from '@/lib/ratelimit';
import { store } from '@/lib/store';
import { signUrgent } from '@/lib/desk';
import { personFrom } from '@/lib/identity';

/**
 * History turns carry a server signature bound to their role, the couple's result (genes, X-linked genes,
 * strengths, relatedness, language), the explainer version and a one-day expiry. Only signed turns come back
 * as history, so a client can't put words in the explainer's mouth, splice a turn from another couple's
 * conversation, or replay an old one. A question is signed only when it was answered by the checked model
 * path, so a refused question (an injection, a probe) can never re-enter as history.
 */
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const contextOf = (b: Record<string, unknown>) => JSON.stringify([b.lang === 'ar' ? 'ar' : 'en', [...((b.genes as string[]) ?? [])].sort(), [...((b.xl as string[]) ?? [])].sort(), b.strengths ?? {}, b.kinds ?? {}, b.chances ?? {}, b.outcomes ?? {}, b.arrangementUnknown ?? [], !!b.related]);
const mac = (ctx: string, exp: number, role: string, text: string) => hex(hmac(sha256, subkey('ask-history'), new TextEncoder().encode(`twokeys/ask-history/v3|${EXPLAINER_VERSION}|${ctx}|${exp}|${role}|${text}`)));
const sign = (ctx: string, role: 'user' | 'assistant', text: string) => { const exp = Math.floor(Date.now() / 1000) + 86_400; return `${exp}.${mac(ctx, exp, role, text)}`; };
const verify = (ctx: string, role: string, text: string, sig: unknown) => {
  if (typeof sig !== 'string') return false;
  const [e, m] = sig.split('.');
  const exp = Number(e);
  return Number.isInteger(exp) && exp > Date.now() / 1000 && m === mac(ctx, exp, role, text);
};
/** Demo spend guard: per address per hour, and for the whole service per day. */
const PER_HOUR = 150;
const PER_DAY = 5000;

export async function POST(req: Request) {
  const b = await readJson<Record<string, unknown>>(req);
  if (b instanceof Response) return b;
  // At most 12 history turns are even looked at, before any signature is checked.
  if (Array.isArray(b.history)) b.history = (b.history as unknown[]).slice(-12);
  const ctx = contextOf(b);
  const input = parseAskBody(b, (role, text, sig) => verify(ctx, role, text, sig));
  if ('error' in input) return Response.json({ error: input.error, code: 'bad_request' }, { status: 400 });

  // Bounded model spend: an hourly budget per address and a daily one for the service.
  const today = new Date().toISOString().slice(0, 10);
  if (await limited(req, 'ask', PER_HOUR) || (await store().incr(`ask:day:${today}`, 60 * 60 * 26)) > PER_DAY) {
    return Response.json({ error: 'The demo’s question budget is used up for now. A counsellor can answer the rest.', code: 'rate_limited' }, { status: 429 });
  }

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
  return Response.json({ ...out, version: EXPLAINER_VERSION, sig: sign(ctx, 'assistant', out.answer), ...(out.route === 'model' ? { qsig: sign(ctx, 'user', input.question) } : {}),
    // A crisis reply carries a same-day flag the desk accepts, bound to the signed-in person and today.
    ...(out.urgent ? (() => { const p = personFrom(req); return p ? { urgentSig: signUrgent(p.id) } : {}; })() : {}) }, { headers: { 'cache-control': 'no-store' } });
}
