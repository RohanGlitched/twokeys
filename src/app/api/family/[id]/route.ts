import { sha256 } from '@noble/hashes/sha2.js';
import { store } from '@/lib/store';
import type { Letter } from '../route';

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const TTL = 60 * 60 * 24 * 30;

/** The relative fetches the ciphertext; the sender (with the manage secret) sees only the two counts. */
export async function GET(req: Request, ctx: RouteContext<'/api/family/[id]'>) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f]{18}$/.test(id)) return Response.json({ error: 'No such letter.' }, { status: 404 });
  const l = await store().get<Letter>(`letter:${id}`);
  if (!l) return Response.json({ error: 'This letter has expired or was removed.' }, { status: 404 });
  const manage = new URL(req.url).searchParams.get('manage');
  if (manage) {
    if (hex(sha256(new TextEncoder().encode(manage))) !== l.manageHash) return Response.json({ error: 'Not yours.' }, { status: 403 });
    return Response.json({ opened: l.opened, booked: l.booked }, { headers: { 'cache-control': 'no-store' } });
  }
  return Response.json({ c: l.c }, { headers: { 'cache-control': 'no-store' } });
}

/** The relative acknowledges: "opened" or "booked". No identity is recorded. */
export async function POST(req: Request, ctx: RouteContext<'/api/family/[id]'>) {
  const { id } = await ctx.params;
  let b: { kind?: string };
  try { b = await req.json(); } catch { return Response.json({ error: 'Send JSON.' }, { status: 400 }); }
  const l = await store().get<Letter>(`letter:${id}`);
  if (!l) return Response.json({ error: 'No such letter.' }, { status: 404 });
  if (b.kind === 'opened') l.opened = Math.min(l.opened + 1, 999);
  else if (b.kind === 'booked') l.booked = Math.min(l.booked + 1, 999);
  else return Response.json({ error: 'Unknown acknowledgement.' }, { status: 400 });
  await store().put(`letter:${id}`, l, TTL);
  return Response.json({ ok: true });
}

/** The sender removes a letter early. */
export async function DELETE(req: Request, ctx: RouteContext<'/api/family/[id]'>) {
  const { id } = await ctx.params;
  const manage = new URL(req.url).searchParams.get('manage') ?? '';
  const l = await store().get<Letter>(`letter:${id}`);
  if (!l || hex(sha256(new TextEncoder().encode(manage))) !== l.manageHash) return Response.json({ error: 'Not yours.' }, { status: 403 });
  await store().del(`letter:${id}`);
  return Response.json({ ok: true });
}
