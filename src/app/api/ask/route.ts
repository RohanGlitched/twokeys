import { ask, type AskInput } from '@/lib/ask';
import { CONDITIONS } from '@/lib/conditions';
import { readJson } from '@/lib/http';
import { limited } from '@/lib/ratelimit';

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
    related: !!b.related,
    question,
    history: Array.isArray(b.history) ? b.history.filter((h) => h && (h.role === 'user' || h.role === 'assistant') && typeof h.text === 'string').slice(-6) : [],
  });
  return Response.json(out, { headers: { 'cache-control': 'no-store' } });
}
