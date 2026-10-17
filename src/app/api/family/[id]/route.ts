import { sha256 } from '@noble/hashes/sha2.js';
import { readJson } from '@/lib/http';
import { limited } from '@/lib/ratelimit';
import { store } from '@/lib/store';
import type { Letter } from '../route';

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const TTL = 60 * 60 * 24 * 30;
const owns = (l: Letter, manage: string) => manage.length === 32 && hex(sha256(new TextEncoder().encode(manage))) === l.manageHash;

/** The relative fetches the ciphertext. The sender (x-manage header) sees only what relatives chose to share. */
export async function GET(req: Request, ctx: RouteContext<'/api/family/[id]'>) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f]{18}$/.test(id)) return Response.json({ error: 'No such letter.' }, { status: 404 });
  const l = await store().get<Letter>(`letter:${id}`);
  if (!l) return Response.json({ error: 'This letter has expired or was removed.' }, { status: 404 });
  const manage = req.headers.get('x-manage');
  if (manage) {
    if (!owns(l, manage)) return Response.json({ error: 'Not yours.' }, { status: 403 });
    return Response.json({ read: l.read, booked: l.booked }, { headers: { 'cache-control': 'no-store' } });
  }
  return Response.json({ c: l.c }, { headers: { 'cache-control': 'no-store' } });
}

/** The relative chooses to let the sender know: "read" or "booked". Nothing identifies the relative. */
export async function POST(req: Request, ctx: RouteContext<'/api/family/[id]'>) {
  const { id } = await ctx.params;
  if (await limited(req, 'letter-ack', 20, id)) return Response.json({ error: 'Already noted.' }, { status: 429 });
  const b = await readJson<{ kind?: string }>(req);
  if (b instanceof Response) return b;
  const l = await store().get<Letter>(`letter:${id}`);
  if (!l) return Response.json({ error: 'No such letter.' }, { status: 404 });
  if (b.kind === 'read') l.read = Math.min(l.read + 1, 99);
  else if (b.kind === 'booked') l.booked = Math.min(l.booked + 1, 99);
  else return Response.json({ error: 'Unknown acknowledgement.' }, { status: 400 });
  await store().put(`letter:${id}`, l, TTL);
  return Response.json({ ok: true });
}

/** The sender takes a letter back. */
export async function DELETE(req: Request, ctx: RouteContext<'/api/family/[id]'>) {
  const { id } = await ctx.params;
  const l = await store().get<Letter>(`letter:${id}`);
  if (!l || !owns(l, req.headers.get('x-manage') ?? '')) return Response.json({ error: 'Not yours.' }, { status: 403 });
  await store().del(`letter:${id}`);
  return Response.json({ ok: true });
}
