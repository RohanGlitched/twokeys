// Attests a phone's first lock. The phone sends its tokens, each locked with its secret, in the order
// the lab issued them, with a proof that one secret locked them all. The lab rebuilds the tokens it
// issued to that seat, checks the proof, and signs the locked set with the phone's public key. The
// partner's phone checks that signature, so neither phone can quietly use a second secret.
import { issue, type Role } from '@/lib/lab';
import { labKey } from '@/lib/labkey';
import { labSign } from '@/lib/labsign';
import { needIdentity, personFrom } from '@/lib/identity';
import { readJson } from '@/lib/http';
import { attestMessage, SET_SIZE, verifyDleq, type Dleq } from '@/lib/psi';
import { limited } from '@/lib/ratelimit';
import { hex64, seats } from '@/lib/seats';

export async function POST(req: Request) {
  const p = personFrom(req);
  if (!p) return needIdentity();
  const b = await readJson<{ session?: string; role?: Role; locked?: string[]; y?: string; proof?: Dleq }>(req);
  if (b instanceof Response) return b;
  if (b.role !== 'A' && b.role !== 'B') return Response.json({ error: 'Role must be A or B.' }, { status: 400 });
  if (!b.session || !hex64.test(b.session)) return Response.json({ error: 'Bad session id.' }, { status: 400 });
  if (!Array.isArray(b.locked) || b.locked.length !== SET_SIZE || !b.locked.every((x) => typeof x === 'string' && hex64.test(x)) || !b.y || !hex64.test(b.y)) {
    return Response.json({ error: 'Bad locked list.' }, { status: 400 });
  }
  if (await limited(req, 'attest', 300, p.id)) return Response.json({ error: 'Too many requests.' }, { status: 429 });
  const s = await seats(b.session);
  if ((b.role === 'A' ? s.A : s.B) !== p.id) return Response.json({ error: 'You are not in this pairing.' }, { status: 403 });
  if (!s.confirmed) return Response.json({ error: 'Both of you need to confirm each other first.' }, { status: 409 });
  const issued = issue(labKey(), b.session, b.role, p.findings).map((t) => t.token);
  if (!b.proof || !verifyDleq(b.y, issued, b.locked, b.proof, 'first-lock')) return Response.json({ error: 'That lock doesn’t match the tokens the lab issued.' }, { status: 422 });
  return Response.json({ att: labSign(attestMessage(b.session, b.role, b.y, b.locked)) }, { headers: { 'cache-control': 'no-store' } });
}
