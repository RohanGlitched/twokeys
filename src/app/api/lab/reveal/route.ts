// After the phones compare, each asks the lab to name what matched. The lab recomputes the true
// intersection from its own records for the two people seated in this session and names only that;
// it also says whether the phone's own claim agreed (a tampered or broken comparison shows up here).
import { intersection, type Role } from '@/lib/lab';
import { labKey } from '@/lib/labkey';
import { needIdentity, personFrom } from '@/lib/identity';
import { readJson } from '@/lib/http';
import { personById } from '@/lib/people';
import { limited } from '@/lib/ratelimit';
import { store } from '@/lib/store';

export async function POST(req: Request) {
  const p = personFrom(req);
  if (!p) return needIdentity();
  const b = await readJson<{ session?: string; role?: Role; matched?: number[] }>(req);
  if (b instanceof Response) return b;
  if (b.role !== 'A' && b.role !== 'B') return Response.json({ error: 'Role must be A or B.' }, { status: 400 });
  if (!b.session || !/^[0-9a-f]{64}$/.test(b.session)) return Response.json({ error: 'Bad session id.' }, { status: 400 });
  if (!Array.isArray(b.matched) || b.matched.length > 64 || !b.matched.every((x) => Number.isInteger(x) && x >= 0 && x < 64)) {
    return Response.json({ error: 'Bad match list.' }, { status: 400 });
  }
  if (await limited(req, 'reveal', 60, p.id)) return Response.json({ error: 'Too many requests.' }, { status: 429 });
  const db = store();
  const [a, bb] = await Promise.all([db.get<string>(`seat:${b.session}:A`), db.get<string>(`seat:${b.session}:B`)]);
  if ((b.role === 'A' ? a : bb) !== p.id) return Response.json({ error: 'You are not in this pairing.' }, { status: 403 });
  const pa = a ? personById(a) : null, pb = bb ? personById(bb) : null;
  if (!pa || !pb) return Response.json({ error: 'Your partner hasn’t joined yet.' }, { status: 409 });
  const truth = intersection(labKey(), b.session, pa.findings, pb.findings);
  const mine = truth[b.role];
  const claimed = new Set(b.matched);
  const agrees = claimed.size === mine.size && [...claimed].every((x) => mine.has(x));
  return Response.json({ genes: truth.genes, agrees }, { headers: { 'cache-control': 'no-store' } });
}
