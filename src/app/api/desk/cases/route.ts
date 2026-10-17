// A signed-in person books a counsellor. Only the items they ticked reach the desk; the consent text
// version is stored on the case and returned as a receipt.
// Against flooding: one open case per person (an atomic marker, cleared on close or withdrawal), with or
// without a pairing; the 'urgent' (same-day) priority only with the explainer's signed flag, or once a
// day per person without it; and cases booked by demo identities (shared by every visitor) last 2 hours.
import { audit, caseTtl, CONSENT_VERSION, dueFor, listCases, logQueueRead, openKey, pairingRef, queue, saveCase, verifyUrgent, type DeskCase } from '@/lib/desk';
import { untilYearEnd } from '@/lib/dp';
import { store } from '@/lib/store';
import { deskGate, deskUser } from '@/lib/deskauth';
import { fail, isDemoIdentity, needIdentity, personFrom, pseudonym } from '@/lib/identity';
import { readJson } from '@/lib/http';
import { coupleOf } from '@/lib/people';
import { limited } from '@/lib/ratelimit';
import { seats } from '@/lib/seats';
import { seedDesk } from '@/lib/seed';

interface Body {
  pairing?: string; role?: 'A' | 'B'; consent?: { ownResults?: boolean; relationship?: boolean };
  language?: string; readingLevel?: string; priority?: string; question?: string; pregnant?: boolean; weeks?: number;
  /** From /api/ask when the explainer offered a same-day call (desk.signUrgent). */
  urgentSig?: string;
}
type Released = string | { gene: string; strength: number; kind: string | null; chance?: string | null };

export async function POST(req: Request) {
  const p = personFrom(req);
  if (!p) return needIdentity();
  if (await limited(req, 'book', 20, p.id)) return fail('rate_limited', 'Too many bookings this hour.', 429);
  const b = await readJson<Body>(req);
  if (b instanceof Response) return b;
  // The shared genes are copied only from what the lab itself released for this pairing, after both
  // phones' comparisons agreed with its records (lab/reveal). Before that, or without it, none.
  let genes: string[] = [];
  let kinds: Record<string, string> = {};
  let chances: Record<string, string> = {};
  const session = typeof b.pairing === 'string' && /^[0-9a-f]{64}$/.test(b.pairing) ? b.pairing : null;
  if (session && (b.role === 'A' || b.role === 'B')) {
    const s = await seats(session);
    if ((b.role === 'A' ? s.A : s.B) === p.id && s.confirmed) {
      // Older releases hold names only; newer ones say what each match means.
      const rel = (await store().get<Released[]>(`revealed:${session}`)) ?? [];
      genes = rel.map((g) => (typeof g === 'string' ? g : g.gene));
      kinds = Object.fromEntries(rel.flatMap((g) => (typeof g === 'string' ? [] : [[g.gene, g.kind ?? (g.strength === 1 ? 'milder' : g.strength === 0 ? 'low' : 'full')]])));
      chances = Object.fromEntries(rel.flatMap((g) => (typeof g === 'string' || !g.chance ? [] : [[g.gene, g.chance]])));
    }
  }
  const now = Date.now();
  const demo = isDemoIdentity(p);
  const id = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
  // One open case per person, claimed atomically. The marker lives as long as the case would.
  const open = openKey(p.id);
  if (!(await store().putNew(open, id, caseTtl({ demo, createdAt: now })))) {
    const mine = await store().get<string>(open);
    return fail('open_case', 'You already have an open request. A counsellor will contact you; withdraw it first to book again.', 409, mine ? { id: mine } : {});
  }
  const pregnantAsked = b.priority === 'pregnant' || !!b.pregnant;
  // Same day only with the explainer's signed flag; without it, once a day per person (more falls back to the normal clock).
  let urgent = false;
  if (b.priority === 'urgent') {
    urgent = verifyUrgent(p.id, b.urgentSig)
      || (await store().incr(`urgentself:${pseudonym(p.id)}:${new Date(now).toISOString().slice(0, 10)}`, 2 * 86_400)) <= 1;
  }
  const priority: DeskCase['priority'] = urgent ? 'urgent' : pregnantAsked ? 'pregnant' : 'routine';
  const weeks = pregnantAsked && Number.isInteger(b.weeks) && b.weeks! >= 1 && b.weeks! <= 42 ? b.weeks! : null;
  // Kept until the year ends, keyed by a pseudonym that rotates yearly: the programme counts each person's first booking of the year, once.
  const firstEver = await store().putNew(`dp:book:${pseudonym(p.id)}`, true, untilYearEnd());
  const hydrops = Object.values(kinds).some((k) => k === 'bart' || k === 'hbh-severe');
  const c: DeskCase = {
    id,
    createdAt: now,
    pairing: session ? pairingRef(session) : null,
    person: { id: p.id, name: p.name.en, nameAr: p.name.ar, sex: p.sex },
    demo,
    language: b.language === 'ar' ? 'ar' : 'en',
    readingLevel: b.readingLevel === 'simple' || b.readingLevel === 'detailed' ? b.readingLevel : 'standard',
    consent: { sharedGenes: true, ownResults: !!b.consent?.ownResults, relationship: !!b.consent?.relationship, version: CONSENT_VERSION },
    sharedGenes: genes,
    sharedKinds: kinds,
    sharedChances: chances,
    ownFindings: b.consent?.ownResults ? p.findings : null,
    relationship: b.consent?.relationship ? coupleOf(p.id)?.relationship ?? null : null,
    priority,
    question: typeof b.question === 'string' && b.question.trim() ? b.question.trim().slice(0, 600) : null,
    status: 'new',
    pregnancyWeeks: weeks,
    // A possible Hb Bart's or severe HbH (a risk to the mother too) or an SMA match is never left two days;
    // Bart's or severe HbH in any pregnancy gets the same-day clock.
    dueBy: dueFor(priority, now, weeks, hydrops ? 'hydrops' : genes.includes('SMN1')),
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
  // The queue holds summaries only: an urgent/normal level, overdue / due today / later, counts and a name.
  // A case's details are read one at a time, and each read is logged on the case; each queue read goes on a chained log.
  const cases = queue(await listCases());
  await logQueueRead(deskUser(req)!, cases);
  return Response.json({ cases, user: deskUser(req) }, { headers: { 'cache-control': 'no-store' } });
}
