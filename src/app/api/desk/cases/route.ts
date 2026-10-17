// A signed-in person books a counsellor. Only the items they ticked reach the desk; the consent text
// version is stored on the case and returned as a receipt.
import { audit, CONSENT_VERSION, deskView, dueFor, listCases, saveCase, type DeskCase } from '@/lib/desk';
import { deskAuthorised, deskUser } from '@/lib/deskauth';
import { needIdentity, personFrom } from '@/lib/identity';
import { readJson } from '@/lib/http';
import { coupleOf } from '@/lib/people';
import { limited } from '@/lib/ratelimit';
import { seedDesk } from '@/lib/seed';

interface Body {
  pairing?: string; sharedGenes?: string[]; consent?: { ownResults?: boolean; relationship?: boolean };
  language?: string; readingLevel?: string; priority?: string; question?: string;
}

export async function POST(req: Request) {
  const p = personFrom(req);
  if (!p) return needIdentity();
  if (await limited(req, 'book', 20, p.id)) return Response.json({ error: 'Too many bookings this hour.' }, { status: 429 });
  const b = await readJson<Body>(req);
  if (b instanceof Response) return b;
  const genes = Array.isArray(b.sharedGenes) ? b.sharedGenes.filter((g) => typeof g === 'string' && /^[A-Z0-9-]{2,12}$/.test(g)).slice(0, 32) : [];
  const priority = b.priority === 'urgent' || b.priority === 'pregnant' ? b.priority : 'routine';
  const now = Date.now();
  const c: DeskCase = {
    id: crypto.randomUUID().replace(/-/g, '').slice(0, 10),
    createdAt: now,
    pairing: typeof b.pairing === 'string' && /^[0-9a-f]{64}$/.test(b.pairing) ? b.pairing.slice(0, 16) : null,
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
  audit(c, `person:${p.id}`, `booked (${priority}); consent ${CONSENT_VERSION}: shared genes${c.consent.ownResults ? ', own results' : ''}${c.consent.relationship ? ', relationship' : ''}`);
  await saveCase(c);
  return Response.json({ id: c.id, dueBy: c.dueBy, priority, consentVersion: CONSENT_VERSION });
}

export async function GET(req: Request) {
  if (!deskAuthorised(req)) return Response.json({ error: 'Counsellors only.' }, { status: 401 });
  await seedDesk();
  const cases = (await listCases()).map(deskView);
  return Response.json({ cases, user: deskUser(req) }, { headers: { 'cache-control': 'no-store' } });
}
