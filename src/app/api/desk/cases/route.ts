// A person books a counsellor. Only the items they ticked reach the desk.
import { audit, listCases, saveCase, twoWorkingDaysFrom, type DeskCase } from '@/lib/desk';
import { coupleOf, personById } from '@/lib/people';
import { deskAuthorised } from '@/lib/deskauth';
import { seedDesk } from '@/lib/seed';

export async function POST(req: Request) {
  let b: { person?: string; pairing?: string; sharedGenes?: string[]; consent?: { ownResults?: boolean; relationship?: boolean }; language?: string; readingLevel?: string };
  try { b = await req.json(); } catch { return Response.json({ error: 'Send JSON.' }, { status: 400 }); }
  const p = b.person ? personById(b.person) : null;
  if (!p) return Response.json({ error: 'Unknown person.' }, { status: 404 });
  const genes = Array.isArray(b.sharedGenes) ? b.sharedGenes.filter((g) => typeof g === 'string' && /^[A-Z0-9-]{2,12}$/.test(g)).slice(0, 32) : [];
  const now = Date.now();
  const c: DeskCase = {
    id: crypto.randomUUID().slice(0, 8),
    createdAt: now,
    pairing: typeof b.pairing === 'string' && /^[0-9a-f]{64}$/.test(b.pairing) ? b.pairing.slice(0, 16) : null,
    person: { id: p.id, name: p.name.en, sex: p.sex },
    language: b.language === 'ar' ? 'ar' : 'en',
    readingLevel: b.readingLevel === 'simple' || b.readingLevel === 'detailed' ? b.readingLevel : 'standard',
    consent: { sharedGenes: true, ownResults: !!b.consent?.ownResults, relationship: !!b.consent?.relationship },
    sharedGenes: genes,
    ownFindings: b.consent?.ownResults ? p.findings : null,
    relationship: b.consent?.relationship ? coupleOf(p.id)?.relationship ?? null : null,
    status: 'new',
    dueBy: twoWorkingDaysFrom(now),
    firstContactAt: null,
    referral: null,
    notes: [],
    audit: [],
  };
  audit(c, `person:${p.id}`, `booked; consented to ${['shared genes', c.consent.ownResults && 'own results', c.consent.relationship && 'relationship'].filter(Boolean).join(', ')}`);
  await saveCase(c);
  return Response.json({ id: c.id, dueBy: c.dueBy });
}

export async function GET(req: Request) {
  if (!deskAuthorised(req)) return Response.json({ error: 'Counsellors only.' }, { status: 401 });
  await seedDesk();
  return Response.json({ cases: await listCases() }, { headers: { 'cache-control': 'no-store' } });
}
