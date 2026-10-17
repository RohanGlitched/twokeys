// Family notes. The sender's phone writes and encrypts each letter; the key travels only in the
// link's #fragment, so the server stores ciphertext it can't read and records no sender identity.
// The relative decides whether the sender may know that the note was read or that a test was booked.
import { sha256 } from '@noble/hashes/sha2.js';
import { readJson } from '@/lib/http';
import { limited } from '@/lib/ratelimit';
import { store } from '@/lib/store';

const TTL = 60 * 60 * 24 * 30;
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

export interface Letter { c: string; manageHash: string; read: number; booked: number; createdAt: number }

export async function POST(req: Request) {
  if (await limited(req, 'letter', 30)) return Response.json({ error: 'Too many notes this hour.' }, { status: 429 });
  const b = await readJson<{ c?: string }>(req);
  if (b instanceof Response) return b;
  if (typeof b.c !== 'string' || b.c.length > 6000 || !/^[A-Za-z0-9_-]+$/.test(b.c)) return Response.json({ error: 'Bad letter.' }, { status: 400 });
  const id = hex(crypto.getRandomValues(new Uint8Array(9)));
  const manage = hex(crypto.getRandomValues(new Uint8Array(16)));
  const letter: Letter = { c: b.c, manageHash: hex(sha256(new TextEncoder().encode(manage))), read: 0, booked: 0, createdAt: Date.now() };
  await store().put(`letter:${id}`, letter, TTL);
  return Response.json({ id, manage });
}
