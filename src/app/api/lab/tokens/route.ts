// Takes a seat in a pairing session, and hands out the lab's tokens only once both seated people have
// confirmed each other by name. A session has exactly two seats; each is claimed atomically and can
// never change hands, and one person can't sit in both. Before both confirm, a seat gets nothing.
import { issue, personalFindings, type Role } from '@/lib/lab';
import { needIdentity, personFrom } from '@/lib/identity';
import { readJson } from '@/lib/http';
import { limited } from '@/lib/ratelimit';
import { expired, hex64, newNonce, PAIR_TTL, seats, sessionKey, USED_TTL } from '@/lib/seats';
import { store } from '@/lib/store';

export async function POST(req: Request) {
  const p = personFrom(req);
  if (!p) return needIdentity();
  const body = await readJson<{ session?: string; role?: Role }>(req);
  if (body instanceof Response) return body;
  const { session, role } = body;
  if (role !== 'A' && role !== 'B') return Response.json({ error: 'Role must be A or B.' }, { status: 400 });
  if (!session || !hex64.test(session)) return Response.json({ error: 'Bad session id.' }, { status: 400 });
  // Limit before touching seats, so nobody can be locked out by someone else's requests.
  if (await limited(req, 'tokens', 600, p.id)) return Response.json({ error: 'Too many pairings this hour. Try again later.' }, { status: 429 });

  const db = store();
  const mine = `seat:${session}:${role}`;
  const other = `seat:${session}:${role === 'A' ? 'B' : 'A'}`;
  const holder = await db.get<string>(mine);
  if (holder !== p.id) {
    if (holder) return Response.json({ error: 'This pairing already has someone in that seat.' }, { status: 409 });
    const [used, otherHolder] = await Promise.all([db.get<boolean>(`used:${session}`), db.get<string>(other)]);
    if (used && !otherHolder) return Response.json({ error: 'This pairing link has expired. Start a new one.' }, { status: 410 });
    if (otherHolder === p.id) return Response.json({ error: 'You can’t pair with yourself.' }, { status: 409 });
    await newNonce(session);
    if (!(await db.putNew(mine, p.id, PAIR_TTL))) return Response.json({ error: 'This pairing already has someone in that seat.' }, { status: 409 });
    await db.putNew(`used:${session}`, true, USED_TTL);
    if ((await db.get<string>(other)) === p.id) { await db.del(mine); return Response.json({ error: 'You can’t pair with yourself.' }, { status: 409 }); }
  }
  const s = await seats(session);
  if (!s.confirmed) return Response.json({ waiting: true }, { headers: { 'cache-control': 'no-store' } });
  const key = await sessionKey(session);
  if (!key) return expired();
  const tokens = issue(key, session, role, p.findings);
  return Response.json({ waiting: false, tokens, personal: personalFindings(p.sex, p.findings).length }, { headers: { 'cache-control': 'no-store' } });
}
