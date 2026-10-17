// The relay: a mailbox with three slots, one per protocol message. It holds only AES-GCM
// ciphertext whose key lives in the URL fragment the two phones share, so the relay can't read
// even the blinded points; the double-locked lists inside are sealed again under a key only the two
// phones can compute, so even someone holding the link can't count matches. Everything expires after
// ten minutes.
import { store } from '@/lib/store';
import { readJson } from '@/lib/http';
import { limited } from '@/lib/ratelimit';

const TTL = 10 * 60;
const SLOTS = ['m1', 'm2', 'm3', 'hello'] as const;
type Slot = (typeof SLOTS)[number];
const MAX = 20_000; // bytes of base64 per slot (m2, the largest, is about 14,000: two lists, one sealed twice)

const okBox = (b: string) => /^[0-9a-f]{32}$/.test(b);
const okSlot = (s: string | null): s is Slot => !!s && (SLOTS as readonly string[]).includes(s);

export async function GET(req: Request, ctx: RouteContext<'/api/relay/[box]'>) {
  const { box } = await ctx.params;
  const slot = new URL(req.url).searchParams.get('slot');
  if (!okBox(box) || !okSlot(slot)) return Response.json({ error: 'Bad mailbox.' }, { status: 400 });
  const v = await store().get<{ c: string; at: number }>(`relay:${box}:${slot}`);
  return Response.json(v ?? null, { headers: { 'cache-control': 'no-store' } });
}

export async function PUT(req: Request, ctx: RouteContext<'/api/relay/[box]'>) {
  const { box } = await ctx.params;
  if (await limited(req, 'relay', 300)) return Response.json({ error: 'Too many messages.' }, { status: 429 });
  const body = await readJson<{ slot?: string; c?: string }>(req);
  if (body instanceof Response) return body;
  if (!okBox(box) || !okSlot(body.slot ?? null)) return Response.json({ error: 'Bad mailbox.' }, { status: 400 });
  if (typeof body.c !== 'string' || body.c.length > MAX || !/^[A-Za-z0-9+/=_-]+$/.test(body.c)) {
    return Response.json({ error: 'Bad message.' }, { status: 400 });
  }
  // Each slot is written once: nobody can overwrite a message after it is sent.
  const ok = await store().putNew(`relay:${box}:${body.slot}`, { c: body.c, at: Date.now() }, TTL);
  if (!ok) return Response.json({ error: 'That message was already sent.' }, { status: 409 });
  return Response.json({ ok: true });
}
