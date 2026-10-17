import { ask, type AskInput } from '@/lib/ask';
import { CONDITIONS } from '@/lib/conditions';
import { store } from '@/lib/store';

export async function POST(req: Request) {
  let b: Partial<AskInput>;
  try { b = await req.json(); } catch { return Response.json({ error: 'Send JSON.' }, { status: 400 }); }
  const question = typeof b.question === 'string' ? b.question.trim() : '';
  if (!question || question.length > 600) return Response.json({ error: 'Ask a question of up to 600 characters.' }, { status: 400 });
  const known = (xs: unknown) => (Array.isArray(xs) ? xs.filter((g): g is string => typeof g === 'string' && g in CONDITIONS).slice(0, 8) : []);

  // A small hourly budget per address keeps the demo's model spend bounded.
  const ip = (req.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim();
  const k = `rl:ask:${ip}:${Math.floor(Date.now() / 3_600_000)}`;
  const used = (await store().get<number>(k)) ?? 0;
  if (used >= 40) return Response.json({ error: 'You’ve asked a lot this hour. A counsellor can answer the rest.' }, { status: 429 });
  await store().put(k, used + 1, 3600);

  const out = await ask({
    lang: b.lang === 'ar' ? 'ar' : 'en',
    level: b.level === 'simple' || b.level === 'detailed' ? b.level : 'standard',
    genes: known(b.genes),
    xl: known(b.xl),
    related: !!b.related,
    question,
    history: Array.isArray(b.history) ? b.history.filter((h) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.text === 'string').slice(-6) : [],
  });
  return Response.json(out, { headers: { 'cache-control': 'no-store' } });
}
