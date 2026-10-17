// Authorised, session-bound private set intersection over ristretto255.
//
// 1. Tokens. For one pairing session S, the lab turns each finding into tokens only it can make:
//      t(S, tag, gene) = H2C( HMAC(k_lab, S | tag | gene) )
//    A token is useless outside session S and impossible to forge without k_lab, so a partner can
//    neither invent genes nor reuse a friend's card to probe. (Baldi et al. 2011 left this open.)
//    Role tags stop mild alleles from raising alarms: the initiator (role A) gets r1 for severe
//    findings and r2 for any finding; the responder (role B) gets the reverse. Severe×any matches,
//    mild×mild never does. X-linked findings use their own tag (see lab.ts).
// 2. Blinding. The partners compare tokens by Diffie–Hellman PSI through a relay:
//      A → relay:  shuffle(t·a)
//      B → relay:  (t·a)·b in A's order, shuffle(u·b)
//      A → relay:  (u·b)·a
//    Each side matches doubly-blinded values. The relay (and the lab, even if it read the relay)
//    sees only random-looking group elements: it never learns the result.
// 3. Padding. Every list is padded to SET_SIZE with random elements, so nobody learns how many
//    findings the other person has.
// Modes: 'reveal' — each side learns which of its own labels matched.
//        'count'  — the responder shuffles the doubly-blinded list, so the initiator learns only
//                   how many matched (the couple-level-only mode, like Dor Yeshorim).
import { ristretto255, ristretto255_hasher } from '@noble/curves/ed25519.js';
import { bytesToNumberLE } from '@noble/curves/utils.js';

const Point = ristretto255.Point;
type Pt = InstanceType<typeof Point>;
const ORDER = Point.Fn.ORDER;

/** Every list is padded to this many elements (two tags per finding, so up to 32 findings). */
export const SET_SIZE = 64;
export const TOKEN_DST = 'TWOKEYS-V1-SESSION-TOKEN';

export type Mode = 'reveal' | 'count';
/** A token the lab issued for one session. `label` stays on the holder's device. */
export interface Token { label: string; token: string }

function rand(len: number): Uint8Array {
  const b = new Uint8Array(len);
  crypto.getRandomValues(b);
  return b;
}

/** Uniform non-zero scalar (64 random bytes reduced mod the group order). */
export function randomScalar(): bigint {
  for (;;) {
    const s = bytesToNumberLE(rand(64)) % ORDER;
    if (s !== 0n) return s;
  }
}

export const toHex = (p: Pt) => Array.from(p.toBytes(), (b) => b.toString(16).padStart(2, '0')).join('');
export function fromHex(h: string): Pt {
  if (typeof h !== 'string' || !/^[0-9a-f]{64}$/.test(h)) throw new Error('Not a group element.');
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) bytes[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  const p = Point.fromBytes(bytes); // throws on non-canonical encodings
  if (p.is0()) throw new Error('Identity element is not allowed.');
  return p;
}

/** Maps a lab MAC onto the group. */
export const macToPoint = (mac: Uint8Array) => ristretto255_hasher.hashToCurve(mac, { DST: TOKEN_DST });
export const randomPointHex = () => toHex(Point.BASE.multiply(randomScalar()));

/** Fisher–Yates with a CSPRNG. Returns the shuffled copy and where each input went. */
function shuffle<T>(xs: T[]): { out: T[]; at: number[] } {
  const idx = xs.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const r = new Uint32Array(1);
    crypto.getRandomValues(r);
    const j = r[0] % (i + 1);
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  const at = new Array<number>(xs.length);
  idx.forEach((src, pos) => (at[src] = pos));
  return { out: idx.map((i) => xs[i]), at };
}

function padded(tokens: Token[]): { pts: Pt[]; label: (string | null)[] } {
  if (tokens.length > SET_SIZE) throw new Error(`At most ${SET_SIZE} tokens per session.`);
  const pts = tokens.map((t) => fromHex(t.token));
  const label: (string | null)[] = tokens.map((t) => t.label);
  while (pts.length < SET_SIZE) {
    pts.push(Point.BASE.multiply(randomScalar()));
    label.push(null);
  }
  return { pts, label };
}

export interface Msg1 { mode: Mode; a: string[] }
export interface Msg2 { ab: string[]; b: string[] }
export interface Msg3 { ba: string[] }
export type Outcome = { mode: 'reveal'; labels: string[] } | { mode: 'count'; count: number };

function checkList(xs: unknown): asserts xs is string[] {
  if (!Array.isArray(xs) || xs.length !== SET_SIZE) throw new Error(`Expected exactly ${SET_SIZE} elements.`);
  if (new Set(xs).size !== xs.length) throw new Error('Duplicate elements are not allowed.');
}

export class Initiator {
  private a = randomScalar();
  private label: (string | null)[];
  private pos: number[];
  private sent: string[];
  constructor(tokens: Token[], private mode: Mode = 'reveal') {
    const { pts, label } = padded(tokens);
    this.label = label;
    const { out, at } = shuffle(pts.map((p) => p.multiply(this.a)));
    this.pos = at;
    this.sent = out.map(toHex);
  }
  step1(): Msg1 { return { mode: this.mode, a: this.sent }; }
  step3(m: Msg2): { msg: Msg3; outcome: Outcome } {
    checkList(m.ab); checkList(m.b);
    const ba = m.b.map((h) => toHex(fromHex(h).multiply(this.a)));
    const theirs = new Set(ba);
    if (this.mode === 'count') return { msg: { ba }, outcome: { mode: 'count', count: m.ab.filter((x) => theirs.has(x)).length } };
    const labels: string[] = [];
    this.label.forEach((l, i) => { if (l && theirs.has(m.ab[this.pos[i]])) labels.push(l); });
    return { msg: { ba }, outcome: { mode: 'reveal', labels } };
  }
}

export class Responder {
  private b = randomScalar();
  private label: (string | null)[];
  private pos: number[];
  private sentB: string[];
  private ab: string[] = [];
  private mode: Mode = 'reveal';
  constructor(tokens: Token[]) {
    const { pts, label } = padded(tokens);
    this.label = label;
    const { out, at } = shuffle(pts.map((p) => p.multiply(this.b)));
    this.pos = at;
    this.sentB = out.map(toHex);
  }
  step2(m: Msg1): Msg2 {
    if (m.mode !== 'reveal' && m.mode !== 'count') throw new Error('Unknown mode.');
    checkList(m.a);
    this.mode = m.mode;
    const ab = m.a.map((h) => toHex(fromHex(h).multiply(this.b)));
    this.ab = ab;
    // In count mode the initiator must not learn WHICH of its elements matched.
    return { ab: this.mode === 'count' ? shuffle(ab).out : ab, b: this.sentB };
  }
  step4(m: Msg3): Outcome {
    checkList(m.ba);
    const theirs = new Set(this.ab);
    if (this.mode === 'count') return { mode: 'count', count: m.ba.filter((x) => theirs.has(x)).length };
    const labels: string[] = [];
    this.label.forEach((l, i) => { if (l && theirs.has(m.ba[this.pos[i]])) labels.push(l); });
    return { mode: 'reveal', labels };
  }
}

/** Runs the whole exchange in one process and returns what each side, and the relay, saw. */
export function runLocally(a: Token[], b: Token[], mode: Mode = 'reveal') {
  const i = new Initiator(a, mode);
  const r = new Responder(b);
  const m1 = i.step1();
  const m2 = r.step2(m1);
  const { msg: m3, outcome: aLearns } = i.step3(m2);
  const bLearns = r.step4(m3);
  return { aLearns, bLearns, relaySaw: { m1, m2, m3 } };
}
