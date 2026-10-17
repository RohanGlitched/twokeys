// Who joined? The person who made the link sees the joiner's name first (UAE PASS in production) and
// confirms it; only then does the joiner see whose link it was, and confirm in turn. So someone who
// photographed a link learns nobody's name, and no tokens exist until both have said yes.
import type { Role } from '@/lib/lab';
import { needIdentity, personFrom } from '@/lib/identity';
import { readJson } from '@/lib/http';
import { personById } from '@/lib/people';
import { limited } from '@/lib/ratelimit';
import { hex64, PAIR_TTL, seats } from '@/lib/seats';
import { store } from '@/lib/store';

export async function POST(req: Request) {
  const p = personFrom(req);
  if (!p) return needIdentity();
  const b = await readJson<{ session?: string; role?: Role; ok?: boolean }>(req);
  if (b instanceof Response) return b;
  if (b.role !== 'A' && b.role !== 'B') return Response.json({ error: 'Role must be A or B.' }, { status: 400 });
  if (!b.session || !hex64.test(b.session)) return Response.json({ error: 'Bad session id.' }, { status: 400 });
  if (await limited(req, 'confirm', 600, p.id)) return Response.json({ error: 'Too many requests.' }, { status: 429 });
  const s = await seats(b.session);
  const mine = b.role === 'A' ? s.A : s.B, theirs = b.role === 'A' ? s.B : s.A;
  if (mine !== p.id) return Response.json({ error: 'You are not in this pairing.' }, { status: 403 });
  if (!theirs) return Response.json({ waiting: true }, { headers: { 'cache-control': 'no-store' } });
  // The joiner sees nothing until the link's creator has confirmed them.
  if (b.role === 'B' && s.okA !== p.id) return Response.json({ waiting: true }, { headers: { 'cache-control': 'no-store' } });
  if (b.ok === true) await store().putNew(`ok:${b.session}:${b.role}`, theirs, PAIR_TTL);
  const partner = personById(theirs);
  return Response.json({ waiting: false, partner: partner ? { name: partner.name, sex: partner.sex } : null }, { headers: { 'cache-control': 'no-store' } });
}
