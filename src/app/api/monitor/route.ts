// Explainer monitoring for the governance page: daily counts of answer routes, escalations and
// languages over the last 30 days. Counts only; no question, answer or person is ever stored here.
import { connection } from 'next/server';
import { store } from '@/lib/store';

import { limited } from '@/lib/ratelimit';

const MODEL = process.env.ASK_MODEL ?? 'apac.amazon.nova-pro-v1:0';
const KEYS = ['route:guard', 'route:intent', 'route:model', 'route:fallback', 'escalate', 'urgent', 'lang:en', 'lang:ar', 'feedback', `model:${MODEL}`] as const;

export async function GET() {
  await connection();
  const db = store();
  const totals: Record<string, number> = Object.fromEntries(KEYS.map((k) => [k, 0]));
  const days = Array.from({ length: 30 }, (_, i) => new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10));
  // Read every day first, then add: `totals[k] += await …` would race and lose counts.
  const reads = await Promise.all(days.flatMap((d) => KEYS.map(async (k) => [k, (await db.get<number>(`mon:${d}:${k}`)) ?? 0] as const)));
  for (const [k, n] of reads) totals[k] += n;
  return Response.json({ windowDays: 30, model: MODEL, totals }, { headers: { 'cache-control': 'no-store' } });
}

/** “Report a problem” on an explainer answer: counted, never stored with any text. */
export async function POST(req: Request) {
  if (await limited(req, 'feedback', 20)) return Response.json({ ok: true });
  const day = new Date().toISOString().slice(0, 10);
  await store().incr(`mon:${day}:feedback`, 60 * 60 * 24 * 90);
  return Response.json({ ok: true });
}
