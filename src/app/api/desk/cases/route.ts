// A signed-in person books a counsellor. Only the items they ticked reach the desk; the consent text
// version is stored on the case and returned as a receipt.
import { audit, CONSENT_VERSION, deskView, dueFor, listCases, saveCase, type DeskCase } from '@/lib/desk';
import { intersection } from '@/lib/lab';
import { labKey } from '@/lib/labkey';
import { store } from '@/lib/store';
import { deskGate, deskUser } from '@/lib/deskauth';
import { needIdentity, personFrom } from '@/lib/identity';
import { readJson } from '@/lib/http';
import { coupleOf, personById } from '@/lib/people';
import { limited } from '@/lib/ratelimit';
import { seats } from '@/lib/seats';
import { seedDesk } from '@/lib/seed';

interface Body {
  pairing?: string; role?: 'A' | 'B'; consent?: { ownResults?: boolean; relationship?: boolean };
  language?: string; readingLevel?: string; priority?: string; question?: string;
}

export async function POST(req: Request) {
  const p = personFrom(req);
  if (!p) return needIdentity();
  if (await limited(req, 'book', 20, p.id)) return Response.json({ error: 'Too many bookings this hour.' }, { status: 429 });
  const b = await readJson<Body>(req);
  if (b instanceof Response) return b;
  // The shared genes come from the lab's own records for this pairing, never from the phone.
  let genes: string[] = [];
  const session = typeof b.pairing === 'string' && /^[0-9a-f]{64}$/.test(b.pairing) ? b.pairing : null;
  if (session && (b.role === 'A' || b.role === 'B')) {
    const s = await seats(session);
    const pa = s.A ? personById(s.A) : null, pb = s.B ? personById(s.B) : null;
    if ((b.role === 'A' ? s.A : s.B) === p.id && s.confirmed && pa && pb) genes = intersection(labKey(), session, pa.findings, pb.findings).genes.map((g) => g.gene);
  }
  const priority = b.priority === 'urgent' || b.priority === 'pregnant' ? b.priority : 'routine';
  const now = Date.now();
  const c: DeskCase = {
    id: crypto.randomUUID().replace(/-/g, '').slice(0, 10),
    createdAt: now,
    pairing: session ? session.slice(0, 16) : null,
    person: { id: p.id, name: p.name.en, sex: p.sex },
    language: b.language === 'ar' ? 'ar' : 'en',
    readingLevel: b.readingLevel === 'simple' || b.readingLevel === 'detailed' ? b.readingLevel : 'standard',
    consent: { sharedGenes: true, ownResults: !!b.consent?.ownResults, relationship: !!b.consent?.relationship, version: CONSENT_VERSION },
    sharedGenes: genes,
    ownFindings: b.consent?.ownResults ? p.findings : null,
    relationship: b.consent?.relationship ? coupleOf(p.id)?.relationship ?? null : null,
    priority,
    question: typeof b.question === 'string' && b.question.trim() ? b.question.trim().slice(0, 600) : null,
    status: 'new',
    dueBy: dueFor(priority, now),
    firstContactAt: null,
    referral: null,
    notes: [],
    sealed: false,
    audit: [],
  };
  // The audit line says only that a booking happened under a consent version: it outlives withdrawal.
  audit(c, `person:${p.id}`, `booked; consent ${CONSENT_VERSION}`);
  await saveCase(c);
  return Response.json({ id: c.id, dueBy: c.dueBy, priority, consentVersion: CONSENT_VERSION, sharedGenes: genes });
}

export async function GET(req: Request) {
  const gate = await deskGate(req);
  if (gate) return gate;
  await seedDesk();
  // The queue holds summaries only: no gene names, relationship, results or question. A case's details
  // are read one at a time, and each read is logged on the case; each queue read is logged here.
  const cases = (await listCases()).map(deskView).map(({ ownFindings, question, notes, audit: trail, sharedGenes, relationship, ...summary }) => ({
    ...summary, sharedGenes: [], relationship: null, ownFindings: null, question: null, notes: [], audit: [],
    sharedCount: sharedGenes.length, hasRelationship: !!relationship, hasOwnResults: !!ownFindings, hasQuestion: !!question, notesCount: notes.length, auditCount: trail.length,
  }));
  await store().put(`deskaudit:${new Date().toISOString().slice(0, 10)}:${crypto.randomUUID()}`, { at: Date.now(), actor: deskUser(req), action: `read the queue (${cases.length} summaries)` }, 60 * 60 * 24 * 60);
  return Response.json({ cases, user: deskUser(req) }, { headers: { 'cache-control': 'no-store' } });
}
