// A signed-in person books a counsellor. Only the items they ticked reach the desk; the consent text
// version is stored on the case and returned as a receipt.
import { audit, CONSENT_VERSION, dueFor, listCases, logQueueRead, queueItem, saveCase, type DeskCase } from '@/lib/desk';
import { FOREVER } from '@/lib/dp';
import { store } from '@/lib/store';
import { deskGate, deskUser } from '@/lib/deskauth';
import { needIdentity, personFrom, pseudonym } from '@/lib/identity';
import { readJson } from '@/lib/http';
import { coupleOf } from '@/lib/people';
import { limited } from '@/lib/ratelimit';
import { seats } from '@/lib/seats';
import { seedDesk } from '@/lib/seed';

interface Body {
  pairing?: string; role?: 'A' | 'B'; consent?: { ownResults?: boolean; relationship?: boolean };
  language?: string; readingLevel?: string; priority?: string; question?: string; pregnant?: boolean; weeks?: number;
}

export async function POST(req: Request) {
  const p = personFrom(req);
  if (!p) return needIdentity();
  if (await limited(req, 'book', 20, p.id)) return Response.json({ error: 'Too many bookings this hour.' }, { status: 429 });
  const b = await readJson<Body>(req);
  if (b instanceof Response) return b;
  // The shared genes are copied only from what the lab itself released for this pairing, after both
  // phones' comparisons agreed with its records (lab/reveal). Before that, or without it, none.
  let genes: string[] = [];
  let kinds: Record<string, string> = {};
  const session = typeof b.pairing === 'string' && /^[0-9a-f]{64}$/.test(b.pairing) ? b.pairing : null;
  if (session && (b.role === 'A' || b.role === 'B')) {
    const s = await seats(session);
    if ((b.role === 'A' ? s.A : s.B) === p.id && s.confirmed) {
      // Older releases hold names only; newer ones say what each match means.
      const rel = (await store().get<(string | { gene: string; strength: number; kind: string | null })[]>(`revealed:${session}`)) ?? [];
      genes = rel.map((g) => (typeof g === 'string' ? g : g.gene));
      kinds = Object.fromEntries(rel.flatMap((g) => (typeof g === 'string' ? [] : [[g.gene, g.kind ?? (g.strength === 1 ? 'milder' : g.strength === 0 ? 'low' : 'full')]])));
    }
  }
  const pairing = session ? session.slice(0, 16) : null;
  // One open case per person per pairing.
  if (pairing && (await listCases()).some((c) => c.person.id === p.id && c.pairing === pairing && c.status !== 'withdrawn' && c.status !== 'closed')) {
    return Response.json({ error: 'You already have an open request for this pairing. A counsellor will contact you.' }, { status: 409 });
  }
  const priority = b.priority === 'urgent' || b.priority === 'pregnant' ? b.priority : b.pregnant ? 'pregnant' : 'routine';
  const weeks = (b.pregnant || priority === 'pregnant') && Number.isInteger(b.weeks) && b.weeks! >= 1 && b.weeks! <= 42 ? b.weeks! : null;
  const now = Date.now();
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
  // Permanent and keyed by a pseudonym: the programme counts each person's first booking ever, once.
  const firstEver = await store().putNew(`dp:book:${pseudonym(p.id)}`, true, FOREVER);
  const c: DeskCase = {
    id,
    createdAt: now,
    pairing,
    person: { id: p.id, name: p.name.en, sex: p.sex },
    language: b.language === 'ar' ? 'ar' : 'en',
    readingLevel: b.readingLevel === 'simple' || b.readingLevel === 'detailed' ? b.readingLevel : 'standard',
    consent: { sharedGenes: true, ownResults: !!b.consent?.ownResults, relationship: !!b.consent?.relationship, version: CONSENT_VERSION },
    sharedGenes: genes,
    sharedKinds: kinds,
    ownFindings: b.consent?.ownResults ? p.findings : null,
    relationship: b.consent?.relationship ? coupleOf(p.id)?.relationship ?? null : null,
    priority,
    question: typeof b.question === 'string' && b.question.trim() ? b.question.trim().slice(0, 600) : null,
    status: 'new',
    pregnancyWeeks: weeks,
    // A possible Hb Bart's pregnancy (a risk to the mother too) or an SMA match is never left two days.
    dueBy: dueFor(priority, now, weeks, Object.values(kinds).includes('bart') || genes.includes('SMN1')),
    firstContactAt: null,
    referral: null,
    notes: [],
    sealed: false,
    firstEver,
    audit: [],
  };
  // The audit line says only that a booking happened under a consent version: it outlives withdrawal.
  audit(c, `person:${p.id}`, `booked; consent ${CONSENT_VERSION}`);
  await saveCase(c);
  // The receipt names no genes: the phone already shows what the lab released to it.
  return Response.json({ id: c.id, dueBy: c.dueBy, priority, consentVersion: CONSENT_VERSION }, { headers: { 'cache-control': 'no-store' } });
}

export async function GET(req: Request) {
  const gate = await deskGate(req);
  if (gate) return gate;
  await seedDesk();
  // The queue holds summaries only: the clock, an urgent/normal level, counts and a name. A case's details
  // are read one at a time, and each read is logged on the case; each queue read goes on a chained log.
  const cases = (await listCases()).map(queueItem);
  await logQueueRead(deskUser(req)!, cases);
  return Response.json({ cases, user: deskUser(req) }, { headers: { 'cache-control': 'no-store' } });
}
