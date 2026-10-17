// The demo's stand-in for signing in: choose a synthetic person, get a signed identity token.
import { fail, mintIdentity } from '@/lib/identity';
import { personalFindings } from '@/lib/lab';
import { readJson } from '@/lib/http';
import { personById, publicPerson } from '@/lib/people';
import { limited } from '@/lib/ratelimit';

/**
 * Per address and person, per hour. The identities are synthetic and each demo load signs in two of
 * them (phones reuse a token for the tab), so the limit only stops a script hammering the route.
 */
const PER_HOUR = 600;
const RETRY_S = 20;

export async function POST(req: Request) {
  const b = await readJson<{ person?: string }>(req);
  if (b instanceof Response) return b;
  const p = b.person ? personById(b.person) : null;
  if (!p) return fail('unknown_person', 'Unknown person.', 404);
  if (await limited(req, 'session', PER_HOUR, p.id)) {
    return fail('rate_limited', 'The demo is busy.', 429, { retryAfter: RETRY_S }, { 'retry-after': String(RETRY_S) });
  }
  return Response.json({ ...mintIdentity(p.id), person: publicPerson(p), personal: personalFindings(p.sex, p.findings).length }, { headers: { 'cache-control': 'no-store' } });
}
