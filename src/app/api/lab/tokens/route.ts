// The lab issues one person's tokens for one pairing session. A session has exactly two seats
// (A and B); once taken, a seat can't be given to anyone else, and one person can't sit in both.
import { issue, type Role } from '@/lib/lab';
import { labKey } from '@/lib/labkey';
import { personById } from '@/lib/people';
import { store } from '@/lib/store';

const SESSION_TTL = 15 * 60;

interface Seats { A?: string; B?: string; at: number }

export async function POST(req: Request) {
  let body: { person?: string; session?: string; role?: Role };
  try { body = await req.json(); } catch { return Response.json({ error: 'Send JSON.' }, { status: 400 }); }
  const { person, session, role } = body;
  const p = person ? personById(person) : null;
  if (!p) return Response.json({ error: 'Unknown person.' }, { status: 404 });
  if (role !== 'A' && role !== 'B') return Response.json({ error: 'Role must be A or B.' }, { status: 400 });
  if (!session || !/^[0-9a-f]{64}$/.test(session)) return Response.json({ error: 'Bad session id.' }, { status: 400 });

  const db = store();
  const key = `seat:${session}`;
  const seats = (await db.get<Seats>(key)) ?? { at: Date.now() };
  const other = role === 'A' ? 'B' : 'A';
  if (seats[role] && seats[role] !== p.id) return Response.json({ error: 'This pairing already has someone in that seat.' }, { status: 409 });
  if (seats[other] === p.id) return Response.json({ error: 'You can’t pair with yourself.' }, { status: 409 });
  seats[role] = p.id;
  await db.put(key, seats, SESSION_TTL);

  // Rate limit: a person can open a handful of pairings an hour, so tokens can't be farmed.
  const rl = `rl:tokens:${p.id}:${Math.floor(Date.now() / 3_600_000)}`;
  const used = (await db.get<number>(rl)) ?? 0;
  if (used >= 30) return Response.json({ error: 'Too many pairings this hour. Try again later.' }, { status: 429 });
  await db.put(rl, used + 1, 3600);

  const tokens = issue(labKey(), session, role, p.sex, p.findings);
  return Response.json({ tokens }, { headers: { 'cache-control': 'no-store' } });
}
