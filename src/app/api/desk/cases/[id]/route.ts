// One case. Counsellors (named accounts) view and act on it, and every view is logged; the signed-in
// person who booked it can withdraw consent.
import { audit, deskView, getCase, saveCase, verifyAudit, withdraw, type CaseStatus } from '@/lib/desk';
import { deskAuthorised, deskUser } from '@/lib/deskauth';
import { needIdentity, personFrom } from '@/lib/identity';
import { readJson } from '@/lib/http';

const NEXT: Record<string, CaseStatus> = { contact: 'contacted', counsel: 'counselled', refer: 'referred', close: 'closed' };

export async function GET(req: Request, ctx: RouteContext<'/api/desk/cases/[id]'>) {
  if (!deskAuthorised(req)) return Response.json({ error: 'Counsellors only.' }, { status: 401 });
  const { id } = await ctx.params;
  const c = await getCase(id);
  if (!c) return Response.json({ error: 'No such case.' }, { status: 404 });
  audit(c, `counsellor:${deskUser(req)}`, 'viewed the case');
  await saveCase(c);
  return Response.json({ case: deskView(c), auditIntact: verifyAudit(c) });
}

export async function PATCH(req: Request, ctx: RouteContext<'/api/desk/cases/[id]'>) {
  if (!deskAuthorised(req)) return Response.json({ error: 'Counsellors only.' }, { status: 401 });
  const by = deskUser(req)!;
  const { id } = await ctx.params;
  const c = await getCase(id);
  if (!c) return Response.json({ error: 'No such case.' }, { status: 404 });
  if (c.status === 'withdrawn') return Response.json({ error: 'The person withdrew consent.' }, { status: 409 });
  const b = await readJson<{ action?: string; note?: string; service?: string }>(req);
  if (b instanceof Response) return b;
  if (b.action === 'note' && b.note) {
    c.notes.push({ at: Date.now(), by, text: String(b.note).slice(0, 2000) });
    audit(c, `counsellor:${by}`, 'added a note');
  } else if (b.action && NEXT[b.action]) {
    if (b.action === 'close' && !c.firstContactAt) return Response.json({ error: 'Record contact before closing.' }, { status: 409 });
    c.status = NEXT[b.action];
    if (b.action === 'contact' && !c.firstContactAt) c.firstContactAt = Date.now();
    if (b.action === 'refer') c.referral = { service: String(b.service ?? 'Reproductive genetics clinic').slice(0, 120), at: Date.now() };
    audit(c, `counsellor:${by}`, b.action === 'refer' ? `referred to ${c.referral!.service}` : `marked ${c.status}`);
  } else {
    return Response.json({ error: 'Unknown action.' }, { status: 400 });
  }
  await saveCase(c);
  return Response.json({ case: deskView(c), auditIntact: verifyAudit(c) });
}

/** The signed-in person withdraws consent: what they shared is erased; the clinical record is sealed. */
export async function DELETE(req: Request, ctx: RouteContext<'/api/desk/cases/[id]'>) {
  const p = personFrom(req);
  if (!p) return needIdentity();
  const { id } = await ctx.params;
  const c = await getCase(id);
  if (!c || c.person.id !== p.id) return Response.json({ error: 'No such case.' }, { status: 404 });
  if (c.status !== 'withdrawn') withdraw(c, `person:${p.id}`);
  await saveCase(c);
  return Response.json({ ok: true, sealedNotes: c.sealed });
}
