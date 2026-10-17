// Family notes. The sender's phone writes and encrypts each letter; the key travels only in the
// link's #fragment, so the server stores ciphertext it can't read and records no sender identity.
// The relative decides whether the sender may know that the note was read or that a test was booked;
// that acknowledgement needs a token made from the letter key (see family/[id]).
// Sending needs a signed-in person only for two per-person counters, both keyed by a pseudonym: a
// sending cap, and a lifetime count so that only a person's first LETTER_CAP notes ever enter the
// programme's counts (which bounds what one person adds to them). The note itself stores no sender.
import { sha256 } from '@noble/hashes/sha2.js';
import { dayAligned, dayStart, FOREVER } from '@/lib/dp';
import { needIdentity, personFrom, pseudonym } from '@/lib/identity';
import { readJson } from '@/lib/http';
import { limited } from '@/lib/ratelimit';
import { store } from '@/lib/store';

const TTL = 60 * 60 * 24 * 30;
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

/** createdAt is the UTC day it was sent; `counted` = among the sender's first LETTER_CAP notes ever; ackHash = SHA-256 of the ack token. */
export interface Letter { c: string; manageHash: string; ackHash?: string; read: number; booked: number; createdAt: number; counted?: boolean }

/** Notes per person that the programme counts, for life. */
const LETTER_CAP = 5;
/**
 * Notes one person can send in a day. Demo identities are shared by every visitor, so a yearly cap would
 * let anyone switch notes off for that person for a year; the demo caps per day. Production (UAE PASS, one
 * person per identity) caps per year.
 */
const LETTER_DAY = 5;

export async function POST(req: Request) {
  const p = personFrom(req);
  if (!p) return needIdentity();
  if (await limited(req, 'letter', 30)) return Response.json({ error: 'Too many notes this hour.' }, { status: 429 });
  const b = await readJson<{ c?: string; ack?: string }>(req);
  if (b instanceof Response) return b;
  if (typeof b.c !== 'string' || b.c.length > 6000 || !/^[A-Za-z0-9_-]+$/.test(b.c)) return Response.json({ error: 'Bad letter.' }, { status: 400 });
  if (b.ack !== undefined && (typeof b.ack !== 'string' || !/^[0-9a-f]{64}$/.test(b.ack))) return Response.json({ error: 'Bad letter.' }, { status: 400 });
  const who = pseudonym(p.id);
  if ((await store().incr(`lettercap:${who}:${new Date().toISOString().slice(0, 10)}`, dayAligned(86_400))) > LETTER_DAY) {
    return Response.json({ error: `You have sent the most notes one person can today (${LETTER_DAY}). A counsellor can help tell more relatives.` }, { status: 429 });
  }
  const counted = (await store().incr(`dp:letters:${who}`, dayAligned(FOREVER))) <= LETTER_CAP;
  const id = hex(crypto.getRandomValues(new Uint8Array(9)));
  const manage = hex(crypto.getRandomValues(new Uint8Array(16)));
  const letter: Letter = { c: b.c, manageHash: hex(sha256(new TextEncoder().encode(manage))), ackHash: b.ack, read: 0, booked: 0, createdAt: dayStart(), counted };
  await store().put(`letter:${id}`, letter, dayAligned(TTL));
  return Response.json({ id, manage });
}
