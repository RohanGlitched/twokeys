// Attests a phone's first lock. The phone sends its tokens, each locked with its secret, in the order
// the lab issued them, with a proof that one secret locked them all. The lab rebuilds the tokens it
// issued to that seat, checks the proof, and signs the locked set with the phone's public key. The
// partner's phone checks that signature, so neither phone can quietly use a second secret.
import { issue, type Role } from '@/lib/lab';
import { labSign } from '@/lib/labsign';
import { fail, needIdentity, personFrom } from '@/lib/identity';
import { readJson } from '@/lib/http';
import { attestMessage, SET_SIZE, verifyDleq, type Dleq } from '@/lib/psi';
import { limited } from '@/lib/ratelimit';
import { badRole, badSession, expired, hex64, notConfirmed, notInPairing, seats, sessionKey, stoppedRes, tooMany } from '@/lib/seats';

export async function POST(req: Request) {
  const p = personFrom(req);
  if (!p) return needIdentity();
  const b = await readJson<{ session?: string; role?: Role; locked?: string[]; y?: string; proof?: Dleq }>(req);
  if (b instanceof Response) return b;
  if (b.role !== 'A' && b.role !== 'B') return badRole();
  if (!b.session || !hex64.test(b.session)) return badSession();
  if (!Array.isArray(b.locked) || b.locked.length !== SET_SIZE || !b.locked.every((x) => typeof x === 'string' && hex64.test(x)) || !b.y || !hex64.test(b.y)) {
    return fail('bad_request', 'Bad locked list.', 400);
  }
  if (await limited(req, 'attest', 300, p.id)) return tooMany();
  const s = await seats(b.session);
  if ((b.role === 'A' ? s.A : s.B) !== p.id) return notInPairing();
  if (s.stopped) return stoppedRes();
  if (!s.confirmed) return notConfirmed();
  const key = await sessionKey(b.session);
  if (!key) return expired();
  const issued = issue(key, b.session, b.role, p.findings).map((t) => t.token);
  if (!b.proof || !verifyDleq(b.y, issued, b.locked, b.proof, 'first-lock')) return fail('lock_mismatch', 'That lock doesn’t match the tokens the lab issued.', 422);
  return Response.json({ att: labSign(attestMessage(b.session, b.role, b.y, b.locked)) }, { headers: { 'cache-control': 'no-store' } });
}
