// Explainer monitoring for the governance page: daily counts of answer routes, escalations and
// languages over the last 30 days. Counts only; no question, answer or person is ever stored here.
import { connection } from 'next/server';
import { store } from '@/lib/store';
import { EXPLAINER_VERSION } from '@/lib/ask';

import { limited } from '@/lib/ratelimit';

const MODEL = process.env.ASK_MODEL ?? 'apac.amazon.nova-pro-v1:0';
const CHECKS = ['numbersOk', 'nonDirective', 'citesOk', 'oddsOk', 'personaOk', 'languageOk', 'framingOk', 'xlOk', 'strengthOk', 'reassureOk', 'relatedOk', 'coverOk'];
const ROUTES = ['guard', 'intent', 'model', 'fallback'];
// Which check turned an answer into a fallback, how often Arabic was repaired, and feedback by how the answer was made.
const KEYS = ['route:guard', 'route:intent', 'route:model', 'route:fallback', 'escalate', 'urgent', 'lang:en', 'lang:ar', 'feedback', 'repaired', `model:${MODEL}`,
  ...CHECKS.map((c) => `fail:${c}`), ...ROUTES.map((r) => `feedback:${r}`)];

export async function GET() {
  await connection();
  const db = store();
  const totals: Record<string, number> = Object.fromEntries(KEYS.map((k) => [k, 0]));
  const days = Array.from({ length: 30 }, (_, i) => new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10));
  // Read every day first, then add: `totals[k] += await …` would race and lose counts.
  const reads = await Promise.all(days.flatMap((d) => KEYS.map(async (k) => [k, (await db.get<number>(`mon:${d}:${k}`)) ?? 0] as const)));
  for (const [k, n] of reads) totals[k] += n;
  return Response.json({ windowDays: 30, model: MODEL, version: EXPLAINER_VERSION, totals }, { headers: { 'cache-control': 'no-store' } });
}

/** “Report a problem” on an explainer answer: counted, never stored with any text. */
export async function POST(req: Request) {
  if (await limited(req, 'feedback', 20)) return Response.json({ ok: true });
  const b = (await req.json().catch(() => ({}))) as { route?: unknown };
  const day = new Date().toISOString().slice(0, 10);
  const ttl = 60 * 60 * 24 * 90;
  await store().incr(`mon:${day}:feedback`, ttl);
  if (typeof b.route === 'string' && ROUTES.includes(b.route)) await store().incr(`mon:${day}:feedback:${b.route}`, ttl);
  return Response.json({ ok: true });
}
