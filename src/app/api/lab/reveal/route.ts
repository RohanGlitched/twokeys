// After the phones compare, each asks the lab to name what matched. The lab names nothing until
// both seated people have confirmed each other and both phones have reported what they found. It
// then recomputes the true intersection from its own records for those two people, names only
// that, and says whether each phone's own claim agreed (a tampered or broken comparison shows up).
import { intersection, type Role } from '@/lib/lab';
import { labKey } from '@/lib/labkey';
import { needIdentity, personFrom } from '@/lib/identity';
import { readJson } from '@/lib/http';
import { personById } from '@/lib/people';
import { limited } from '@/lib/ratelimit';
import { store } from '@/lib/store';

const TTL = 30 * 24 * 3600;
const hex64 = /^[0-9a-f]{64}$/;

export async function POST(req: Request) {
  const p = personFrom(req);
  if (!p) return needIdentity();
  const b = await readJson<{ session?: string; role?: Role; matched?: string[] }>(req);
  if (b instanceof Response) return b;
  if (b.role !== 'A' && b.role !== 'B') return Response.json({ error: 'Role must be A or B.' }, { status: 400 });
  if (!b.session || !hex64.test(b.session)) return Response.json({ error: 'Bad session id.' }, { status: 400 });
  if (!Array.isArray(b.matched) || b.matched.length > 64 || !b.matched.every((x) => typeof x === 'string' && hex64.test(x))) {
    return Response.json({ error: 'Bad match list.' }, { status: 400 });
  }
  if (await limited(req, 'reveal', 300, p.id)) return Response.json({ error: 'Too many requests.' }, { status: 429 });
  const db = store();
  const other: Role = b.role === 'A' ? 'B' : 'A';
  const [a, bb] = await Promise.all([db.get<string>(`seat:${b.session}:A`), db.get<string>(`seat:${b.session}:B`)]);
  if ((b.role === 'A' ? a : bb) !== p.id) return Response.json({ error: 'You are not in this pairing.' }, { status: 403 });
  // Record this phone's claim once; it can't be changed after seeing anything.
  await db.putNew(`claim:${b.session}:${b.role}`, b.matched, TTL);
  const [okA, okB, theirClaim] = await Promise.all([db.get<string>(`ok:${b.session}:A`), db.get<string>(`ok:${b.session}:B`), db.get<string[]>(`claim:${b.session}:${other}`)]);
  if (!okA || !okB || !theirClaim) return Response.json({ waiting: true }, { headers: { 'cache-control': 'no-store' } });
  const pa = a ? personById(a) : null, pb = bb ? personById(bb) : null;
  if (!pa || !pb) return Response.json({ error: 'This pairing is incomplete.' }, { status: 409 });
  const truth = intersection(labKey(), b.session, pa.findings, pb.findings);
  const mine = truth[b.role];
  const claimed = new Set((await db.get<string[]>(`claim:${b.session}:${b.role}`)) ?? []);
  const agrees = claimed.size === mine.size && [...claimed].every((x) => mine.has(x));
  return Response.json({ waiting: false, genes: truth.genes, agrees }, { headers: { 'cache-control': 'no-store' } });
}
