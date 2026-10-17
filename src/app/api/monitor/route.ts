// Explainer monitoring for the governance page: daily counts of answer routes, escalations and
// languages over the last 30 days. Counts only; no question, answer or person is ever stored here.
import { store } from '@/lib/store';

const KEYS = ['route:guard', 'route:intent', 'route:model', 'route:fallback', 'escalate', 'urgent', 'lang:en', 'lang:ar'] as const;

export async function GET() {
  const db = store();
  const totals: Record<string, number> = Object.fromEntries(KEYS.map((k) => [k, 0]));
  const days = Array.from({ length: 30 }, (_, i) => new Date(Date.now() - i * 86_400_000).toISOString().slice(0, 10));
  await Promise.all(days.flatMap((d) => KEYS.map(async (k) => { totals[k] += (await db.get<number>(`mon:${d}:${k}`)) ?? 0; })));
  return Response.json({ windowDays: 30, totals }, { headers: { 'cache-control': 'no-store' } });
}
