// Full mutual disclosure, as a choice. A seated partner can ask to see everything; the lab releases
// each partner's full results to the other only once both have asked. Asking can't be taken back,
// and asking alone reveals nothing.
import type { Role } from '@/lib/lab';
import { needIdentity, personFrom } from '@/lib/identity';
import { readJson } from '@/lib/http';
import { personById } from '@/lib/people';
import { limited } from '@/lib/ratelimit';
import { store } from '@/lib/store';

const TTL = 30 * 24 * 3600;

export async function POST(req: Request) {
  const p = personFrom(req);
  if (!p) return needIdentity();
  const b = await readJson<{ session?: string; role?: Role }>(req);
  if (b instanceof Response) return b;
  if (b.role !== 'A' && b.role !== 'B') return Response.json({ error: 'Role must be A or B.' }, { status: 400 });
  if (!b.session || !/^[0-9a-f]{64}$/.test(b.session)) return Response.json({ error: 'Bad session id.' }, { status: 400 });
  if (await limited(req, 'share', 300, p.id)) return Response.json({ error: 'Too many requests.' }, { status: 429 });
  const db = store();
  const other: Role = b.role === 'A' ? 'B' : 'A';
  const [mine, theirs] = await Promise.all([db.get<string>(`seat:${b.session}:${b.role}`), db.get<string>(`seat:${b.session}:${other}`)]);
  if (mine !== p.id) return Response.json({ error: 'You are not in this pairing.' }, { status: 403 });
  if (!theirs) return Response.json({ error: 'Your partner hasn’t joined yet.' }, { status: 409 });
  const [okA, okB] = await Promise.all([db.get<string>(`ok:${b.session}:A`), db.get<string>(`ok:${b.session}:B`)]);
  if (!okA || !okB) return Response.json({ error: 'Both of you need to confirm each other first.' }, { status: 409 });
  await db.putNew(`share:${b.session}:${b.role}`, true, TTL);
  if (!(await db.get<boolean>(`share:${b.session}:${other}`))) return Response.json({ waiting: true }, { headers: { 'cache-control': 'no-store' } });
  const partner = personById(theirs);
  return Response.json({ waiting: false, findings: partner?.findings ?? [], sex: partner?.sex }, { headers: { 'cache-control': 'no-store' } });
}
