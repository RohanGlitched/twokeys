// The demo's stand-in for signing in: choose a synthetic person, get a signed identity token.
import { mintIdentity } from '@/lib/identity';
import { personalFindings } from '@/lib/lab';
import { readJson } from '@/lib/http';
import { personById, publicPerson } from '@/lib/people';
import { limited } from '@/lib/ratelimit';

export async function POST(req: Request) {
  if (await limited(req, 'session', 60)) return Response.json({ error: 'Too many sign-ins. Wait a minute.' }, { status: 429 });
  const b = await readJson<{ person?: string }>(req);
  if (b instanceof Response) return b;
  const p = b.person ? personById(b.person) : null;
  if (!p) return Response.json({ error: 'Unknown person.' }, { status: 404 });
  return Response.json({ ...mintIdentity(p.id), person: publicPerson(p), personal: personalFindings(p.sex, p.findings).length }, { headers: { 'cache-control': 'no-store' } });
}
