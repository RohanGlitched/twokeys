// One case: the person can withdraw; a counsellor can record contact, notes, referral and closure.
import { audit, getCase, saveCase, verifyAudit, type CaseStatus } from '@/lib/desk';
import { deskAuthorised } from '@/lib/deskauth';

const NEXT: Record<string, CaseStatus> = { contact: 'contacted', counsel: 'counselled', refer: 'referred', close: 'closed' };

export async function GET(req: Request, ctx: RouteContext<'/api/desk/cases/[id]'>) {
  if (!deskAuthorised(req)) return Response.json({ error: 'Counsellors only.' }, { status: 401 });
  const { id } = await ctx.params;
  const c = await getCase(id);
  if (!c) return Response.json({ error: 'No such case.' }, { status: 404 });
  return Response.json({ case: c, auditIntact: verifyAudit(c) });
}

export async function PATCH(req: Request, ctx: RouteContext<'/api/desk/cases/[id]'>) {
  if (!deskAuthorised(req)) return Response.json({ error: 'Counsellors only.' }, { status: 401 });
  const { id } = await ctx.params;
  const c = await getCase(id);
  if (!c) return Response.json({ error: 'No such case.' }, { status: 404 });
  if (c.status === 'withdrawn') return Response.json({ error: 'The person withdrew consent.' }, { status: 409 });
  let b: { action?: string; note?: string; service?: string; by?: string };
  try { b = await req.json(); } catch { return Response.json({ error: 'Send JSON.' }, { status: 400 }); }
  const by = typeof b.by === 'string' && b.by.length < 60 ? b.by : 'counsellor';
  if (b.action === 'note' && b.note) {
    c.notes.push({ at: Date.now(), by, text: String(b.note).slice(0, 2000) });
    audit(c, by, 'added a note');
  } else if (b.action && NEXT[b.action]) {
    if (b.action === 'close' && !c.firstContactAt) return Response.json({ error: 'Record contact before closing.' }, { status: 409 });
    c.status = NEXT[b.action];
    if (b.action === 'contact' && !c.firstContactAt) c.firstContactAt = Date.now();
    if (b.action === 'refer') c.referral = { service: String(b.service ?? 'Reproductive genetics clinic').slice(0, 120), at: Date.now() };
    audit(c, by, b.action === 'refer' ? `referred to ${c.referral!.service}` : `marked ${c.status}`);
  } else {
    return Response.json({ error: 'Unknown action.' }, { status: 400 });
  }
  await saveCase(c);
  return Response.json({ case: c, auditIntact: verifyAudit(c) });
}

/** The person withdraws consent: everything they shared is removed, the audit line stays. */
export async function DELETE(req: Request, ctx: RouteContext<'/api/desk/cases/[id]'>) {
  const { id } = await ctx.params;
  const person = new URL(req.url).searchParams.get('person');
  const c = await getCase(id);
  if (!c || c.person.id !== person) return Response.json({ error: 'No such case.' }, { status: 404 });
  c.status = 'withdrawn';
  c.sharedGenes = [];
  c.ownFindings = null;
  c.relationship = null;
  c.notes = [];
  audit(c, `person:${c.person.id}`, 'withdrew consent; shared data erased');
  await saveCase(c);
  return Response.json({ ok: true });
}
