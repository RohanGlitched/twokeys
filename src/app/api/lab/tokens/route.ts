// Takes a seat in a pairing session, and hands out the lab's tokens only once both seated people have
// confirmed each other by name. A session has exactly two seats; each is claimed atomically and can
// never change hands (except that the creator can reject a joiner they don't recognise), and one person
// can't sit in both. Before both confirm, a seat gets nothing.
import { issue, personalFindings, type Role } from '@/lib/lab';
import { fail, needIdentity, personFrom } from '@/lib/identity';
import { readJson } from '@/lib/http';
import { limited } from '@/lib/ratelimit';
import { badRole, badSession, expired, hex64, newNonce, PAIR_TTL, seats, sessionKey, stoppedRes, tooMany, USED_TTL, wasRejected } from '@/lib/seats';
import { store } from '@/lib/store';

const seatTaken = () => fail('seat_taken', 'This pairing already has someone in that seat.', 409);
const selfPair = () => fail('self_pair', 'You can’t pair with yourself.', 409);

export async function POST(req: Request) {
  const p = personFrom(req);
  if (!p) return needIdentity();
  const body = await readJson<{ session?: string; role?: Role }>(req);
  if (body instanceof Response) return body;
  const { session, role } = body;
  if (role !== 'A' && role !== 'B') return badRole();
  if (!session || !hex64.test(session)) return badSession();
  // Limit before touching seats, so nobody can be locked out by someone else's requests.
  if (await limited(req, 'tokens', 600, p.id)) return tooMany('Too many pairings this hour. Try again later.');

  const db = store();
  const mine = `seat:${session}:${role}`;
  const other = `seat:${session}:${role === 'A' ? 'B' : 'A'}`;
  const holder = await db.get<string>(mine);
  if (holder !== p.id) {
    if (holder) return seatTaken();
    if (await wasRejected(session, p.id)) return stoppedRes();
    const [used, otherHolder] = await Promise.all([db.get<boolean>(`used:${session}`), db.get<string>(other)]);
    if (used && !otherHolder) return fail('link_expired', 'This pairing link has expired. Start a new one.', 410);
    if (otherHolder === p.id) return selfPair();
    await newNonce(session);
    if (!(await db.putNew(mine, p.id, PAIR_TTL))) return seatTaken();
    await db.putNew(`used:${session}`, true, USED_TTL);
    if ((await db.get<string>(other)) === p.id) { await db.del(mine); return selfPair(); }
  }
  const s = await seats(session);
  if (s.stopped) return stoppedRes();
  if (!s.confirmed) return Response.json({ waiting: true }, { headers: { 'cache-control': 'no-store' } });
  const key = await sessionKey(session);
  if (!key) return expired();
  const tokens = issue(key, session, role, p.findings);
  return Response.json({ waiting: false, tokens, personal: personalFindings(p.sex, p.findings).length }, { headers: { 'cache-control': 'no-store' } });
}
