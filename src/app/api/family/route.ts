// Family notes. The sender's phone writes and encrypts each letter; the key travels only in the
// link's #fragment, so the server stores ciphertext it can't read and keeps no sender identity (it sees
// the signed-in sender's x-person while handling the request, and keeps only the pseudonymous counters below).
// The relative decides whether the sender may know that the note was read or that a test was booked;
// that acknowledgement needs a token made from the letter key (see family/[id]).
// Sending needs a signed-in person for two per-person counters, both keyed by a pseudonym (a sending
// cap, and a yearly count so that only a person's first LETTER_CAP notes of the year enter the
// programme's counts, which bounds what one person adds to them), and for the lab's check below.
//
// The lab's check, so a relative can trust what a note says. Beside the sealed body the phone sends the
// note's gene and relation in the clear, and the nonce it sealed inside the body. The lab accepts the
// note only if the gene is among the sender's own findings (people.ts), or among the genes it released
// to them for a confirmed pairing they sat in (revealed:{session}, read only). It then signs
// H(version | gene | relation | inheritance | nonce | day) with its Ed25519 key (letters.noteDigest,
// labsign.labSignTagged) and keeps the signature with the note; the relative's page rebuilds the digest
// from the facts it opens in the sealed body and checks the signature (LetterView).
// WHAT THE SERVER LEARNS: the gene and relation of each note (and its nonce), at creation time only,
// while handling that one request, beside the signed-in sender. It keeps none of them: the note's
// record holds the ciphertext, two hashes, the counters, the day and the signature, and the signature
// can't be tested against a guessed gene without the nonce sealed in the body. The record names no sender.
import { sha256 } from '@noble/hashes/sha2.js';
import { dayAligned, dayStart, untilYearEnd } from '@/lib/dp';
import { fail, needIdentity, personFrom, pseudonym } from '@/lib/identity';
import { readJson } from '@/lib/http';
import { matchGene } from '@/lib/lab';
import { labSignTagged } from '@/lib/labsign';
import { NONCE, noteDigest, PANEL_INHERITANCE, RELATIONS, type Relation } from '@/lib/letters';
import type { Person } from '@/lib/people';
import { limited } from '@/lib/ratelimit';
import { hex64, seats } from '@/lib/seats';
import { store } from '@/lib/store';

const TTL = 60 * 60 * 24 * 30;
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

/**
 * createdAt is the UTC day it was sent (the day the lab signed); `counted` = among the sender's first
 * LETTER_CAP notes of the year; ackHash = SHA-256 of the ack token; sig = the lab's signature on the
 * note's checked facts (absent on notes made before the check); reported = times a relative flagged it.
 */
export interface Letter { c: string; manageHash: string; ackHash?: string; read: number; booked: number; createdAt: number; counted?: boolean; sig?: string; reported?: number }

/** Notes per person that the programme counts, for life. */
const LETTER_CAP = 5;
/**
 * Notes one person can send in a day. In the demo a person is one visitor of a synthetic person (a tag
 * per tab, people.ts), so the cap is per visitor; it stays per day so a judge who comes back tomorrow can
 * send again. Production (UAE PASS, one person per identity) caps per year.
 */
const LETTER_DAY = 5;

// Every new letter registers an ack hash; only letters made before ACK_REQUIRED_FROM take untokened acks (family/[id]).
const NO_STORE = { 'cache-control': 'no-store' };

type Released = string | { gene: string };
/** True if the lab found this gene in the sender, or released it to them for a confirmed pairing they sat in. */
async function carries(p: Person, gene: string, session: unknown, role: unknown): Promise<boolean> {
  if (p.findings.some((f) => matchGene(f.gene) === gene || f.gene.toUpperCase() === gene)) return true;
  if (typeof session !== 'string' || !hex64.test(session) || (role !== 'A' && role !== 'B')) return false;
  const s = await seats(session);
  if ((role === 'A' ? s.A : s.B) !== p.id || !s.confirmed) return false;
  const rel = (await store().get<Released[]>(`revealed:${session}`)) ?? [];
  return rel.some((g) => (typeof g === 'string' ? g : g.gene).toUpperCase() === gene);
}

export async function POST(req: Request) {
  const p = personFrom(req);
  if (!p) return needIdentity();
  if (await limited(req, 'letter', 30)) return fail('rate_limited', 'Too many notes this hour.', 429, {}, NO_STORE);
  const b = await readJson<{ c?: string; ack?: string; gene?: string; relation?: string; nonce?: string; session?: string; role?: string }>(req);
  if (b instanceof Response) return b;
  if (typeof b.c !== 'string' || b.c.length > 6000 || !/^[A-Za-z0-9_-]+$/.test(b.c)) return fail('bad_request', 'Bad letter.', 400, {}, NO_STORE);
  if (typeof b.ack !== 'string' || !/^[0-9a-f]{64}$/.test(b.ack)) return fail('bad_request', 'A new note needs its acknowledgement hash.', 400, {}, NO_STORE);
  const gene = typeof b.gene === 'string' ? b.gene.toUpperCase() : '';
  const inheritance = PANEL_INHERITANCE[gene];
  const relation = b.relation as Relation;
  if (!inheritance || !RELATIONS.includes(relation) || typeof b.nonce !== 'string' || !NONCE.test(b.nonce)) {
    return fail('bad_request', 'A new note needs its gene, relation and nonce, for the lab to check.', 400, {}, NO_STORE);
  }
  // Checked before anything is counted, so a refused note costs nothing. Gene and relation are used here, never stored.
  if (!(await carries(p, gene, b.session, b.role))) {
    return fail('bad_request', 'A note can only be about a gene the lab found in you.', 403, { reason: 'not_your_gene' }, NO_STORE);
  }
  const who = pseudonym(p.id);
  if ((await store().incr(`lettercap:${who}:${new Date().toISOString().slice(0, 10)}`, dayAligned(86_400))) > LETTER_DAY) {
    return fail('letter_cap', `You have sent the most notes one person can today (${LETTER_DAY}). A counsellor can help tell more relatives.`, 429, { cap: LETTER_DAY }, NO_STORE);
  }
  // Per person per year (the pseudonym rotates yearly and the counter ends with the year).
  const counted = (await store().incr(`dp:letters:${who}`, untilYearEnd())) <= LETTER_CAP;
  const id = hex(crypto.getRandomValues(new Uint8Array(9)));
  const manage = hex(crypto.getRandomValues(new Uint8Array(16)));
  const day = dayStart();
  const sig = labSignTagged('family-note', noteDigest({ gene, relation, inheritance, nonce: b.nonce, day }));
  const letter: Letter = { c: b.c, manageHash: hex(sha256(new TextEncoder().encode(manage))), ackHash: b.ack, read: 0, booked: 0, createdAt: day, counted, sig };
  await store().put(`letter:${id}`, letter, dayAligned(TTL));
  return Response.json({ id, manage }, { headers: NO_STORE });
}
