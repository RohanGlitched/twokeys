// The relay: a mailbox with one slot per protocol message and a 'stop' slot. It holds only AES-GCM
// ciphertext whose key lives in the URL fragment the two phones share, so the relay can't read
// even the blinded points; the double-locked lists inside are sealed again under a key only the two
// phones can compute, so even someone holding the link can't count matches. Everything expires after
// ten minutes.
// Writes carry the link's write key (`w`, derived from the secret in the fragment; see lib/pairing). The
// box id is the first 16 bytes of SHA-256(w), so the relay checks a write against the box id alone and
// stores nothing extra; someone who only saw the box id (in a URL or a log) can't fill or block a slot.
// Reads need no key and never see it.
import { sha256 } from '@noble/hashes/sha2.js';
import { fail } from '@/lib/identity';
import { store } from '@/lib/store';
import { readJson } from '@/lib/http';
import { limited } from '@/lib/ratelimit';

const TTL = 10 * 60;
const SLOTS = ['m1', 'm2', 'm3', 'stop'] as const;
type Slot = (typeof SLOTS)[number];
const MAX = 20_000; // bytes of base64 per slot (m2, the largest, is about 14,000: two lists, one sealed twice)

const okBox = (b: string) => /^[0-9a-f]{32}$/.test(b);
const okSlot = (s: string | null): s is Slot => !!s && (SLOTS as readonly string[]).includes(s);
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const unhex = (h: string) => Uint8Array.from(h.match(/../g)!.map((x) => parseInt(x, 16)));
const badBox = () => fail('bad_request', 'Bad mailbox.', 400);

export async function GET(req: Request, ctx: RouteContext<'/api/relay/[box]'>) {
  const { box } = await ctx.params;
  const slot = new URL(req.url).searchParams.get('slot');
  if (!okBox(box) || !okSlot(slot)) return badBox();
  // Each read also carries the box's sealed stop message, so a waiting phone learns at once that the other stopped.
  const [v, stop] = await Promise.all([
    store().get<{ c: string; at: number }>(`relay:${box}:${slot}`),
    slot === 'stop' ? null : store().get<{ c: string }>(`relay:${box}:stop`),
  ]);
  return Response.json(v || stop ? { ...(v ?? {}), ...(stop ? { stop: stop.c } : {}) } : null, { headers: { 'cache-control': 'no-store' } });
}

export async function PUT(req: Request, ctx: RouteContext<'/api/relay/[box]'>) {
  const { box } = await ctx.params;
  if (await limited(req, 'relay', 300)) return fail('rate_limited', 'Too many messages.', 429);
  const body = await readJson<{ slot?: string; c?: string; w?: string }>(req);
  if (body instanceof Response) return body;
  if (!okBox(box) || !okSlot(body.slot ?? null)) return badBox();
  if (typeof body.w !== 'string' || !/^[0-9a-f]{64}$/.test(body.w) || hex(sha256(unhex(body.w)).slice(0, 16)) !== box) {
    return fail('write_denied', 'This phone can’t write to that mailbox.', 403);
  }
  if (typeof body.c !== 'string' || body.c.length > MAX || !/^[A-Za-z0-9+/=_-]+$/.test(body.c)) {
    return fail('bad_request', 'Bad message.', 400);
  }
  // Each slot is written once: nobody can overwrite a message after it is sent.
  const ok = await store().putNew(`relay:${box}:${body.slot}`, { c: body.c, at: Date.now() }, TTL);
  if (!ok) return fail('already_sent', 'That message was already sent.', 409);
  return Response.json({ ok: true });
}
