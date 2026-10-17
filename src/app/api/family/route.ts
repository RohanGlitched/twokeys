// Family notes. The sender's phone writes and encrypts each letter; the key travels only in the
// link's #fragment, so the server stores ciphertext it can't read and keeps no sender identity (it sees
// the signed-in sender's x-person while handling the request, and keeps only the pseudonymous counters below).
// The relative decides whether the sender may know that the note was read or that a test was booked;
// that acknowledgement needs a token made from the letter key (see family/[id]).
// Sending needs a signed-in person only for two per-person counters, both keyed by a pseudonym: a
// sending cap, and a yearly count so that only a person's first LETTER_CAP notes of the year enter the
// programme's counts (which bounds what one person adds to them). The note itself stores no sender.
import { sha256 } from '@noble/hashes/sha2.js';
import { dayAligned, dayStart, untilYearEnd } from '@/lib/dp';
import { fail, needIdentity, personFrom, pseudonym } from '@/lib/identity';
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

// Every new letter registers an ack hash; only letters made before ACK_REQUIRED_FROM take untokened acks (family/[id]).
const NO_STORE = { 'cache-control': 'no-store' };

export async function POST(req: Request) {
  const p = personFrom(req);
  if (!p) return needIdentity();
  if (await limited(req, 'letter', 30)) return fail('rate_limited', 'Too many notes this hour.', 429, {}, NO_STORE);
  const b = await readJson<{ c?: string; ack?: string }>(req);
  if (b instanceof Response) return b;
  if (typeof b.c !== 'string' || b.c.length > 6000 || !/^[A-Za-z0-9_-]+$/.test(b.c)) return fail('bad_request', 'Bad letter.', 400, {}, NO_STORE);
  if (typeof b.ack !== 'string' || !/^[0-9a-f]{64}$/.test(b.ack)) return fail('bad_request', 'A new note needs its acknowledgement hash.', 400, {}, NO_STORE);
  const who = pseudonym(p.id);
  if ((await store().incr(`lettercap:${who}:${new Date().toISOString().slice(0, 10)}`, dayAligned(86_400))) > LETTER_DAY) {
    return fail('letter_cap', `You have sent the most notes one person can today (${LETTER_DAY}). A counsellor can help tell more relatives.`, 429, { cap: LETTER_DAY }, NO_STORE);
  }
  // Per person per year (the pseudonym rotates yearly and the counter ends with the year).
  const counted = (await store().incr(`dp:letters:${who}`, untilYearEnd())) <= LETTER_CAP;
  const id = hex(crypto.getRandomValues(new Uint8Array(9)));
  const manage = hex(crypto.getRandomValues(new Uint8Array(16)));
  const letter: Letter = { c: b.c, manageHash: hex(sha256(new TextEncoder().encode(manage))), ackHash: b.ack, read: 0, booked: 0, createdAt: dayStart(), counted };
  await store().put(`letter:${id}`, letter, dayAligned(TTL));
  return Response.json({ id, manage }, { headers: NO_STORE });
}
