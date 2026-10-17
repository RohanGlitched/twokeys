// Who joined? The person who made the link sees the joiner's name first (UAE PASS in production) and
// confirms it; only then does the joiner see whose link it was, and confirm in turn. So someone who
// photographed a link learns nobody's name, and no tokens exist until both have said yes.
// `ok: false` is a no: from the creator, before confirming, it rejects the joiner (their seat is freed
// and they can't sit again); otherwise it stops the session for both (seats.stopSession).
import type { Role } from '@/lib/lab';
import { needIdentity, personFrom } from '@/lib/identity';
import { readJson } from '@/lib/http';
import { personById } from '@/lib/people';
import { limited } from '@/lib/ratelimit';
import { badRole, badSession, hex64, notInPairing, PAIR_TTL, seats, stoppedRes, stopSession, tooMany, wasRejected } from '@/lib/seats';
import { store } from '@/lib/store';

const NO_STORE = { 'cache-control': 'no-store' };

export async function POST(req: Request) {
  const p = personFrom(req);
  if (!p) return needIdentity();
  const b = await readJson<{ session?: string; role?: Role; ok?: boolean }>(req);
  if (b instanceof Response) return b;
  if (b.role !== 'A' && b.role !== 'B') return badRole();
  if (!b.session || !hex64.test(b.session)) return badSession();
  if (await limited(req, 'confirm', 600, p.id)) return tooMany();
  const s = await seats(b.session);
  const mine = b.role === 'A' ? s.A : s.B, theirs = b.role === 'A' ? s.B : s.A;
  if (mine !== p.id) return (await wasRejected(b.session, p.id)) ? stoppedRes() : notInPairing();
  if (b.ok === false) {
    await stopSession(b.session, b.role, s);
    return Response.json({ ok: true }, { headers: NO_STORE });
  }
  if (s.stopped) return stoppedRes();
  if (!theirs) return Response.json({ waiting: true }, { headers: NO_STORE });
  // The joiner sees nothing until the link's creator has confirmed them.
  if (b.role === 'B' && s.okA !== p.id) return Response.json({ waiting: true }, { headers: NO_STORE });
  if (b.ok === true) await store().putNew(`ok:${b.session}:${b.role}`, theirs, PAIR_TTL);
  const partner = personById(theirs);
  return Response.json({ waiting: false, partner: partner ? { name: partner.name, sex: partner.sex } : null }, { headers: NO_STORE });
}
