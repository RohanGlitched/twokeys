import { sha256 } from '@noble/hashes/sha2.js';
import { fail } from '@/lib/identity';
import { readJson } from '@/lib/http';
import { ACK_REQUIRED_FROM } from '@/lib/letters';
import { limited } from '@/lib/ratelimit';
import { store } from '@/lib/store';
import type { Letter } from '../route';

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const TTL = 60 * 60 * 24 * 30;
const NO_STORE = { 'cache-control': 'no-store' };
const owns = (l: Letter, manage: string) => manage.length === 32 && hex(sha256(new TextEncoder().encode(manage))) === l.manageHash;

/** The relative fetches the ciphertext. The sender (x-manage header) sees only what relatives chose to share. */
export async function GET(req: Request, ctx: RouteContext<'/api/family/[id]'>) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f]{18}$/.test(id)) return fail('not_found', 'No such letter.', 404, {}, NO_STORE);
  const l = await store().get<Letter>(`letter:${id}`);
  if (!l) return fail('not_found', 'This letter has expired or was removed.', 404, {}, NO_STORE);
  const manage = req.headers.get('x-manage');
  if (manage) {
    if (!owns(l, manage)) return fail('not_found', 'Not yours.', 403, {}, NO_STORE);
    return Response.json({ read: l.read, booked: l.booked }, { headers: NO_STORE });
  }
  return Response.json({ c: l.c }, { headers: NO_STORE });
}

/**
 * The relative chooses to let the sender know: "read" or "booked". Nothing identifies the relative. It
 * takes the ack token, HMAC(letter key, 'ack'), which only someone holding the link's #fragment can make;
 * the server keeps only its hash. Every letter made from ACK_REQUIRED_FROM on has one; only older letters
 * sent before senders registered a hash accept untokened acks. Counts change by compare-and-swap, so two
 * acks at once both count.
 */
export async function POST(req: Request, ctx: RouteContext<'/api/family/[id]'>) {
  const { id } = await ctx.params;
  if (await limited(req, 'letter-ack', 20, id)) return fail('rate_limited', 'Already noted.', 429, {}, NO_STORE);
  const b = await readJson<{ kind?: string; token?: string }>(req);
  if (b instanceof Response) return b;
  if (b.kind !== 'read' && b.kind !== 'booked') return fail('bad_request', 'Unknown acknowledgement.', 400, {}, NO_STORE);
  const kind = b.kind;
  for (let attempt = 0; attempt < 6; attempt++) {
    const l = await store().get<Letter>(`letter:${id}`);
    if (!l) return fail('not_found', 'No such letter.', 404, {}, NO_STORE);
    const tokenOk = !!l.ackHash && typeof b.token === 'string' && /^[0-9a-f]{64}$/.test(b.token) && hex(sha256(new TextEncoder().encode(b.token))) === l.ackHash;
    if (!tokenOk && (l.ackHash || l.createdAt >= ACK_REQUIRED_FROM)) return fail('link_incomplete', 'This link is incomplete.', 403, {}, NO_STORE);
    const left = Math.max(60, Math.ceil(l.createdAt / 1000 + TTL - Date.now() / 1000)); // keep the letter's own expiry
    if (await store().replace(`letter:${id}`, l, { ...l, [kind]: Math.min(l[kind] + 1, 99) }, left)) return Response.json({ ok: true }, { headers: NO_STORE });
  }
  return fail('busy', 'Busy. Try again.', 409, {}, NO_STORE);
}

/** The sender takes a letter back. */
export async function DELETE(req: Request, ctx: RouteContext<'/api/family/[id]'>) {
  const { id } = await ctx.params;
  const l = await store().get<Letter>(`letter:${id}`);
  if (!l || !owns(l, req.headers.get('x-manage') ?? '')) return fail('not_found', 'Not yours.', 403, {}, NO_STORE);
  await store().del(`letter:${id}`);
  return Response.json({ ok: true }, { headers: NO_STORE });
}
