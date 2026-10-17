// The lab issues one person's opaque tokens for one pairing session. A session has exactly two
// seats; each seat is claimed atomically, can never change hands, and is remembered for 30 days so a
// session can't be reused. One person can't sit in both seats.
import { issue, personalFindings, type Role } from '@/lib/lab';
import { labKey } from '@/lib/labkey';
import { needIdentity, personFrom } from '@/lib/identity';
import { readJson } from '@/lib/http';
import { limited } from '@/lib/ratelimit';
import { store } from '@/lib/store';

const SEAT_TTL = 30 * 24 * 3600;

export async function POST(req: Request) {
  const p = personFrom(req);
  if (!p) return needIdentity();
  const body = await readJson<{ session?: string; role?: Role }>(req);
  if (body instanceof Response) return body;
  const { session, role } = body;
  if (role !== 'A' && role !== 'B') return Response.json({ error: 'Role must be A or B.' }, { status: 400 });
  if (!session || !/^[0-9a-f]{64}$/.test(session)) return Response.json({ error: 'Bad session id.' }, { status: 400 });
  // Limit before touching seats, so nobody can be locked out by someone else's requests.
  if (await limited(req, 'tokens', 40, p.id)) return Response.json({ error: 'Too many pairings this hour. Try again later.' }, { status: 429 });

  const db = store();
  const mine = `seat:${session}:${role}`;
  const other = `seat:${session}:${role === 'A' ? 'B' : 'A'}`;
  if (!(await db.putNew(mine, p.id, SEAT_TTL))) {
    const holder = await db.get<string>(mine);
    if (holder !== p.id) return Response.json({ error: 'This pairing already has someone in that seat.' }, { status: 409 });
  }
  if ((await db.get<string>(other)) === p.id) {
    await db.del(mine);
    return Response.json({ error: 'You can’t pair with yourself.' }, { status: 409 });
  }
  const tokens = issue(labKey(), session, role, p.findings);
  return Response.json({ tokens, personal: personalFindings(p.sex, p.findings).length }, { headers: { 'cache-control': 'no-store' } });
}
