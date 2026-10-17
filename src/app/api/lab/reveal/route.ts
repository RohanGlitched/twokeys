// After the phones compare, each reports which of its tokens matched. The lab names a gene only when
// both phones' comparisons found it and its own records for those two people agree. If either phone's
// report differs from the truth (a broken or tampered comparison), the lab names nothing at all, so
// the result depends on the private comparison, not on the lab alone.
// When both agree, the lab records the names it released for this session: a counsellor booking copies
// shared genes from that record only. A mismatch is counted and logged once, without genes.
import { dayAligned, dayStart } from '@/lib/dp';
import { intersection, type Role } from '@/lib/lab';
import { needIdentity, personFrom, pseudonym } from '@/lib/identity';
import { readJson } from '@/lib/http';
import { personById } from '@/lib/people';
import { limited } from '@/lib/ratelimit';
import { expired, hex64, otherRole, PAIR_TTL, seats, sessionKey } from '@/lib/seats';
import { store } from '@/lib/store';

export async function POST(req: Request) {
  const p = personFrom(req);
  if (!p) return needIdentity();
  const b = await readJson<{ session?: string; role?: Role; matched?: string[] }>(req);
  if (b instanceof Response) return b;
  if (b.role !== 'A' && b.role !== 'B') return Response.json({ error: 'Role must be A or B.' }, { status: 400 });
  if (!b.session || !hex64.test(b.session)) return Response.json({ error: 'Bad session id.' }, { status: 400 });
  if (!Array.isArray(b.matched) || b.matched.length > 64 || !b.matched.every((x) => typeof x === 'string' && hex64.test(x)) || new Set(b.matched).size !== b.matched.length) {
    return Response.json({ error: 'Bad match list.' }, { status: 400 });
  }
  if (await limited(req, 'reveal', 300, p.id)) return Response.json({ error: 'Too many requests.' }, { status: 429 });
  const db = store();
  const s = await seats(b.session);
  if ((b.role === 'A' ? s.A : s.B) !== p.id) return Response.json({ error: 'You are not in this pairing.' }, { status: 403 });
  if (!s.confirmed) return Response.json({ error: 'Both of you need to confirm each other first.' }, { status: 409 });
  // Record this phone's claim once; it can't be changed after seeing anything.
  await db.putNew(`claim:${b.session}:${b.role}`, b.matched, PAIR_TTL);
  const [claimA, claimB] = await Promise.all([db.get<string[]>(`claim:${b.session}:A`), db.get<string[]>(`claim:${b.session}:B`)]);
  if (!claimA || !claimB) return Response.json({ waiting: true }, { headers: { 'cache-control': 'no-store' } });
  const pa = s.A ? personById(s.A) : null, pb = s.B ? personById(s.B) : null;
  if (!pa || !pb) return Response.json({ error: 'This pairing is incomplete.' }, { status: 409 });
  const key = await sessionKey(b.session);
  if (!key) return expired();
  const truth = intersection(key, b.session, pa.findings, pb.findings);
  const same = (claim: string[], real: Set<string>) => claim.length === real.size && claim.every((x) => real.has(x));
  const agrees = same(claimA, truth.A) && same(claimB, truth.B);
  if (!agrees) {
    const who = same(b.role === 'A' ? claimA : claimB, truth[b.role]) ? otherRole(b.role) : b.role;
    // Once per session: the day, the seat and a pseudonym of the person whose report was wrong (so repeated
    // failures by one person can be looked into), never genes.
    const year = dayAligned(365 * 86_400);
    if (await db.putNew(`labaudit:mismatch:${b.session}`, { at: dayStart(), seat: who, person: pseudonym((who === 'A' ? s.A : s.B)!) }, year)) {
      await db.incr(`mon:${new Date().toISOString().slice(0, 10)}:reveal-mismatch`, year);
    }
    return Response.json({ waiting: false, genes: [], agrees: false, failed: who === b.role ? 'yours' : 'theirs' }, { headers: { 'cache-control': 'no-store' } });
  }
  await db.putNew(`revealed:${b.session}`, truth.genes.map((g) => ({ gene: g.gene, strength: g.strength, kind: g.kind ?? null })), PAIR_TTL);
  return Response.json({ waiting: false, genes: truth.genes, agrees: true }, { headers: { 'cache-control': 'no-store' } });
}
