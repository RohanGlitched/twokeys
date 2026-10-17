// Family notes. The sender's phone writes and encrypts each letter; the key travels only in the
// link's #fragment, so the server stores ciphertext it can't read and never learns who sent it.
// Relatives can tap "opened" and "I booked a test": anonymous counts the sender can see.
import { sha256 } from '@noble/hashes/sha2.js';
import { store } from '@/lib/store';

const TTL = 60 * 60 * 24 * 30;
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

export interface Letter { c: string; manageHash: string; opened: number; booked: number; createdAt: number }

export async function POST(req: Request) {
  let b: { c?: string };
  try { b = await req.json(); } catch { return Response.json({ error: 'Send JSON.' }, { status: 400 }); }
  if (typeof b.c !== 'string' || b.c.length > 6000 || !/^[A-Za-z0-9_-]+$/.test(b.c)) return Response.json({ error: 'Bad letter.' }, { status: 400 });
  const id = hex(crypto.getRandomValues(new Uint8Array(9)));
  const manage = hex(crypto.getRandomValues(new Uint8Array(16)));
  const letter: Letter = { c: b.c, manageHash: hex(sha256(new TextEncoder().encode(manage))), opened: 0, booked: 0, createdAt: Date.now() };
  await store().put(`letter:${id}`, letter, TTL);
  return Response.json({ id, manage });
}
