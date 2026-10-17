// One case. Counsellors (named accounts) view and act on it, and every view is logged; the signed-in
// person who booked it can withdraw consent. Every change is a compare-and-swap, so concurrent views
// keep all their audit entries and nothing can write erased data back after a withdrawal.
import { audit, clearOpen, deskView, partnerBooked, updateCase, verifyAudit, withdraw, type CaseStatus, type DeskCase } from '@/lib/desk';
import { deskGate, deskUser } from '@/lib/deskauth';
import { fail, needIdentity, personFrom } from '@/lib/identity';
import { readJson } from '@/lib/http';

const NEXT: Record<string, CaseStatus> = { contact: 'contacted', counsel: 'counselled', refer: 'referred', close: 'closed' };
const none = () => fail('not_found', 'No such case.', 404);
const NO_STORE = { 'cache-control': 'no-store' };
/** The opened case; the only place the desk learns that the partner booked too (never the pairing itself). */
const shown = async (c: DeskCase) => Response.json({ case: deskView(c, await partnerBooked(c)), auditIntact: verifyAudit(c) }, { headers: NO_STORE });

export async function GET(req: Request, ctx: RouteContext<'/api/desk/cases/[id]'>) {
  const gate = await deskGate(req);
  if (gate) return gate;
  const { id } = await ctx.params;
  const c = await updateCase(id, (c) => { audit(c, `counsellor:${deskUser(req)}`, 'viewed the case'); });
  if (!c) return none();
  if (c instanceof Response) return c;
  return shown(c);
}

export async function PATCH(req: Request, ctx: RouteContext<'/api/desk/cases/[id]'>) {
  const gate = await deskGate(req);
  if (gate) return gate;
  const by = deskUser(req)!;
  const { id } = await ctx.params;
  const b = await readJson<{ action?: string; note?: string; service?: string }>(req);
  if (b instanceof Response) return b;
  if (!(b.action === 'note' && b.note) && !(b.action && NEXT[b.action])) return Response.json({ error: 'Unknown action.' }, { status: 400 });
  const c = await updateCase(id, (c) => {
    if (c.status === 'withdrawn') return Response.json({ error: 'The person withdrew consent.' }, { status: 409 });
    if (b.action === 'note' && b.note) {
      c.notes.push({ at: Date.now(), by, text: String(b.note).slice(0, 2000) });
      audit(c, `counsellor:${by}`, 'added a note');
      return;
    }
    if (b.action === 'close' && !c.firstContactAt) return Response.json({ error: 'Record contact before closing.' }, { status: 409 });
    c.status = NEXT[b.action!];
    if (b.action === 'contact' && !c.firstContactAt) c.firstContactAt = Date.now();
    if (b.action === 'refer') c.referral = { service: String(b.service ?? 'Reproductive genetics clinic').slice(0, 120), at: Date.now() };
    audit(c, `counsellor:${by}`, b.action === 'refer' ? 'referral recorded' : `marked ${c.status}`);
  });
  if (!c) return none();
  if (c instanceof Response) return c;
  // A closed case frees the person to book again.
  if (c.status === 'closed') await clearOpen(c);
  return shown(c);
}

/** The signed-in person withdraws consent: what they shared is erased; the clinical record is sealed. */
export async function DELETE(req: Request, ctx: RouteContext<'/api/desk/cases/[id]'>) {
  const p = personFrom(req);
  if (!p) return needIdentity();
  const { id } = await ctx.params;
  const c = await updateCase(id, (c) => {
    if (c.person.id !== p.id) return none();
    if (c.status !== 'withdrawn') withdraw(c, `person:${p.id}`);
  });
  if (!c) return none();
  if (c instanceof Response) return c;
  await clearOpen(c);
  return Response.json({ ok: true, sealedNotes: c.sealed }, { headers: NO_STORE });
}
