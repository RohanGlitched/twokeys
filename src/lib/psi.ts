// Authorised, session-bound private set intersection over ristretto255, with proofs.
//
// 1. Tokens. For one pairing session S, the lab turns each finding into tokens only it can make
//      t(S, tag, gene) = H2C( HMAC(k_lab, S | tag | gene) )
//    and hands them to the phone as opaque, indexed values: the phone does not get gene names, so
//    "couple-only" really is couple-only. Names are released afterwards, by the lab, only for the
//    indices the lab itself confirms are in the intersection (see lab.ts / api/lab/reveal).
// 2. Blinding. The partners compare tokens by Diffie–Hellman PSI through a relay:
//      A → relay:  shuffle(t·a), Ya = G·a
//      B → relay:  (t·a)·b in A's order, shuffle(u·b), Yb = G·b, proof that the first list = A's list · b
//      A → relay:  (u·b)·a, proof that it = B's list · a
//    The proofs are batched Chaum–Pedersen DLEQ proofs (as in RFC 9497's VOPRF), so a modified
//    phone cannot, for example, echo the other side's list back and make every gene look shared.
// 3. Padding. Every list is padded to SET_SIZE with random elements, so nobody learns how many
//    findings the other person has. The relay sees only random-looking group elements.
import { ristretto255, ristretto255_hasher } from '@noble/curves/ed25519.js';
import { bytesToNumberLE } from '@noble/curves/utils.js';

const Point = ristretto255.Point;
type Pt = InstanceType<typeof Point>;
const ORDER = Point.Fn.ORDER;
const enc = new TextEncoder();

/** Every list is padded to this many elements (two tags per finding, so up to 32 findings). */
export const SET_SIZE = 64;
export const TOKEN_DST = 'TWOKEYS-V1-SESSION-TOKEN';
const PROOF_DST = 'TWOKEYS-V1-DLEQ';

/** A token the lab issued for one session: opaque, identified only by its index. */
export interface Token { i: number; token: string }

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
const hashScalar = (msg: string) => ristretto255_hasher.hashToScalar(enc.encode(msg), { DST: PROOF_DST });

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

function padded(tokens: Token[]): { pts: Pt[]; index: (number | null)[] } {
  if (tokens.length > SET_SIZE) throw new Error(`At most ${SET_SIZE} tokens per session.`);
  const pts = tokens.map((t) => fromHex(t.token));
  const index: (number | null)[] = tokens.map((t) => t.i);
  while (pts.length < SET_SIZE) {
    pts.push(Point.BASE.multiply(randomScalar()));
    index.push(null);
  }
  return { pts, index };
}

// ---------------------------------------------------------------- DLEQ proofs

/** Proof that `outs[i] = ins[i]·k` for every i, where Y = G·k (batched with transcript weights). */
export interface Dleq { e: string; s: string }
const sHex = (x: bigint) => x.toString(16).padStart(64, '0');

function combine(ins: string[], outs: string[], Y: string, label: string) {
  const seed = `${label}|${Y}|${ins.join('')}|${outs.join('')}`;
  let M = Point.ZERO, Z = Point.ZERO;
  for (let i = 0; i < ins.length; i++) {
    const c = hashScalar(`${seed}|${i}`);
    M = M.add(fromHex(ins[i]).multiplyUnsafe(c));
    Z = Z.add(fromHex(outs[i]).multiplyUnsafe(c));
  }
  return { M, Z };
}

export function proveDleq(k: bigint, ins: string[], outs: string[], label: string): Dleq {
  const Y = toHex(Point.BASE.multiply(k));
  const { M, Z } = combine(ins, outs, Y, label);
  const r = randomScalar();
  const T1 = Point.BASE.multiply(r), T2 = M.multiply(r);
  const e = hashScalar(`${label}|${Y}|${toHex(M)}|${toHex(Z)}|${toHex(T1)}|${toHex(T2)}`);
  const s = ((r - e * k) % ORDER + ORDER) % ORDER;
  return { e: sHex(e), s: sHex(s) };
}

export function verifyDleq(Yhex: string, ins: string[], outs: string[], proof: Dleq, label: string): boolean {
  try {
    if (!/^[0-9a-f]{64}$/.test(proof?.e ?? '') || !/^[0-9a-f]{64}$/.test(proof?.s ?? '')) return false;
    const Y = fromHex(Yhex);
    const { M, Z } = combine(ins, outs, Yhex, label);
    const e = BigInt('0x' + proof.e) % ORDER, s = BigInt('0x' + proof.s) % ORDER;
    // Public values only, so variable-time multiplication is fine (and it accepts zero).
    const T1 = Point.BASE.multiplyUnsafe(s).add(Y.multiplyUnsafe(e));
    const T2 = M.multiplyUnsafe(s).add(Z.multiplyUnsafe(e));
    const e2 = hashScalar(`${label}|${Yhex}|${toHex(M)}|${toHex(Z)}|${toHex(T1)}|${toHex(T2)}`);
    return e2 === e;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------- the two phones

export interface Msg1 { a: string[]; ya: string }
export interface Msg2 { ab: string[]; b: string[]; yb: string; proof: Dleq }
export interface Msg3 { ba: string[]; proof: Dleq }
/** Indices (as issued by the lab) of this phone's tokens that the other phone also holds. */
export interface Outcome { matched: number[] }

function checkList(xs: unknown): asserts xs is string[] {
  if (!Array.isArray(xs) || xs.length !== SET_SIZE) throw new Error(`Expected exactly ${SET_SIZE} elements.`);
  if (new Set(xs).size !== xs.length) throw new Error('Duplicate elements are not allowed.');
}

export class Initiator {
  private a = randomScalar();
  private index: (number | null)[];
  private pos: number[];
  private sent: string[];
  constructor(tokens: Token[]) {
    const { pts, index } = padded(tokens);
    this.index = index;
    const { out, at } = shuffle(pts.map((p) => p.multiply(this.a)));
    this.pos = at;
    this.sent = out.map(toHex);
  }
  step1(): Msg1 { return { a: this.sent, ya: toHex(Point.BASE.multiply(this.a)) }; }
  step3(m: Msg2): { msg: Msg3; outcome: Outcome } {
    checkList(m.ab); checkList(m.b);
    if (!verifyDleq(m.yb, this.sent, m.ab, m.proof, 'B-locks-A')) throw new Error('Your partner’s phone sent a list that fails its proof. Nothing was revealed.');
    const ba = m.b.map((h) => toHex(fromHex(h).multiply(this.a)));
    const proof = proveDleq(this.a, m.b, ba, 'A-locks-B');
    const theirs = new Set(ba);
    const matched: number[] = [];
    this.index.forEach((ix, i) => { if (ix !== null && theirs.has(m.ab[this.pos[i]])) matched.push(ix); });
    return { msg: { ba, proof }, outcome: { matched } };
  }
}

export class Responder {
  private b = randomScalar();
  private index: (number | null)[];
  private pos: number[];
  private sentB: string[];
  private ab: string[] = [];
  private ya = '';
  constructor(tokens: Token[]) {
    const { pts, index } = padded(tokens);
    this.index = index;
    const { out, at } = shuffle(pts.map((p) => p.multiply(this.b)));
    this.pos = at;
    this.sentB = out.map(toHex);
  }
  step2(m: Msg1): Msg2 {
    checkList(m.a);
    fromHex(m.ya);
    this.ya = m.ya;
    this.ab = m.a.map((h) => toHex(fromHex(h).multiply(this.b)));
    return { ab: this.ab, b: this.sentB, yb: toHex(Point.BASE.multiply(this.b)), proof: proveDleq(this.b, m.a, this.ab, 'B-locks-A') };
  }
  step4(m: Msg3): Outcome {
    checkList(m.ba);
    if (!verifyDleq(this.ya, this.sentB, m.ba, m.proof, 'A-locks-B')) throw new Error('Your partner’s phone sent a list that fails its proof. Nothing was revealed.');
    const theirs = new Set(this.ab);
    const matched: number[] = [];
    this.index.forEach((ix, i) => { if (ix !== null && theirs.has(m.ba[this.pos[i]])) matched.push(ix); });
    return { matched };
  }
}

/** Runs the whole exchange in one process and returns what each side, and the relay, saw. */
export function runLocally(a: Token[], b: Token[]) {
  const i = new Initiator(a);
  const r = new Responder(b);
  const m1 = i.step1();
  const m2 = r.step2(m1);
  const { msg: m3, outcome: aLearns } = i.step3(m2);
  const bLearns = r.step4(m3);
  return { aLearns, bLearns, relaySaw: { m1, m2, m3 } };
}
