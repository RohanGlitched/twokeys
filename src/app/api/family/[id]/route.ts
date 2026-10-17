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

/**
 * The relative chooses to let the sender know: "read" or "booked". Nothing identifies the relative. It
 * takes the ack token, HMAC(letter key, 'ack'), which only someone holding the link's #fragment can make;
 * the server keeps only its hash. Letters sent before senders registered one accept untokened acks.
 * Counts change by compare-and-swap, so two acks at once both count.
 */
export async function POST(req: Request, ctx: RouteContext<'/api/family/[id]'>) {
  const { id } = await ctx.params;
  if (await limited(req, 'letter-ack', 20, id)) return Response.json({ error: 'Already noted.' }, { status: 429 });
  const b = await readJson<{ kind?: string; token?: string }>(req);
  if (b instanceof Response) return b;
  if (b.kind !== 'read' && b.kind !== 'booked') return Response.json({ error: 'Unknown acknowledgement.' }, { status: 400 });
  const kind = b.kind;
  for (let attempt = 0; attempt < 6; attempt++) {
    const l = await store().get<Letter>(`letter:${id}`);
    if (!l) return Response.json({ error: 'No such letter.' }, { status: 404 });
    if (l.ackHash && !(typeof b.token === 'string' && /^[0-9a-f]{64}$/.test(b.token) && hex(sha256(new TextEncoder().encode(b.token))) === l.ackHash)) {
      return Response.json({ error: 'This link is incomplete.' }, { status: 403 });
    }
    const left = Math.max(60, Math.ceil(l.createdAt / 1000 + TTL - Date.now() / 1000)); // keep the letter's own expiry
    if (await store().replace(`letter:${id}`, l, { ...l, [kind]: Math.min(l[kind] + 1, 99) }, left)) return Response.json({ ok: true });
  }
  return Response.json({ error: 'Busy. Try again.' }, { status: 409 });
}

/** The sender takes a letter back. */
export async function DELETE(req: Request, ctx: RouteContext<'/api/family/[id]'>) {
  const { id } = await ctx.params;
  const l = await store().get<Letter>(`letter:${id}`);
  if (!l || !owns(l, req.headers.get('x-manage') ?? '')) return Response.json({ error: 'Not yours.' }, { status: 403 });
  await store().del(`letter:${id}`);
  return Response.json({ ok: true });
}
