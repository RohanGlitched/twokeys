// Who joined? Before anything is revealed, each seated person sees the other's name (UAE PASS in
// production) and confirms it is their partner. A link someone else photographed can take a seat,
// but nothing is named until both people confirm each other.
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
  const b = await readJson<{ session?: string; role?: Role; ok?: boolean }>(req);
  if (b instanceof Response) return b;
  if (b.role !== 'A' && b.role !== 'B') return Response.json({ error: 'Role must be A or B.' }, { status: 400 });
  if (!b.session || !/^[0-9a-f]{64}$/.test(b.session)) return Response.json({ error: 'Bad session id.' }, { status: 400 });
  if (await limited(req, 'confirm', 300, p.id)) return Response.json({ error: 'Too many requests.' }, { status: 429 });
  const db = store();
  const other: Role = b.role === 'A' ? 'B' : 'A';
  const [mine, theirs] = await Promise.all([db.get<string>(`seat:${b.session}:${b.role}`), db.get<string>(`seat:${b.session}:${other}`)]);
  if (mine !== p.id) return Response.json({ error: 'You are not in this pairing.' }, { status: 403 });
  if (!theirs) return Response.json({ error: 'Your partner hasn’t joined yet.' }, { status: 409 });
  const partner = personById(theirs);
  if (b.ok === true) await db.putNew(`ok:${b.session}:${b.role}`, theirs, TTL);
  return Response.json({ partner: partner ? { name: partner.name, sex: partner.sex } : null }, { headers: { 'cache-control': 'no-store' } });
}
