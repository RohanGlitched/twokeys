// Authorised private set intersection over ristretto255.
//
// The lab turns each gene a person carries into a token only the lab can make:
//   token(gene) = H(gene) · k_lab
// A partner therefore can't invent tokens for genes they don't carry, and a token
// on its own reveals nothing (it is a random-looking group element).
//
// Two partners then run a Diffie–Hellman PSI on their tokens through a relay:
//   1. Initiator:  A  = shuffle(x·a)            → relay
//   2. Responder:  AB = A·b (same order), B = shuffle(y·b)  → relay
//   3. Initiator:  BA = B·a                      → relay; matches AB against BA
//   4. Responder:  matches BA against AB
// Each side learns which of ITS OWN genes the other also carries, nothing else.
// Both sets are padded with random points to a fixed size, so neither side learns
// how many genes the other carries. The relay sees only blinded points.
import { ristretto255, ristretto255_hasher } from '@noble/curves/ed25519.js';
import { bytesToNumberLE } from '@noble/curves/utils.js';

const Point = ristretto255.Point;
type Pt = InstanceType<typeof Point>;
const N = Point.Fn.ORDER;
const enc = new TextEncoder();

/** Every set is padded to this many elements: more than any panel's genes a person could carry. */
export const SET_SIZE = 48;
const DST = 'TWOKEYS-V1-GENE-TOKEN';

function rand(len: number): Uint8Array {
  const b = new Uint8Array(len);
  crypto.getRandomValues(b);
  return b;
}

/** Uniform non-zero scalar (64 random bytes reduced mod the group order). */
export function randomScalar(): bigint {
  for (;;) {
    const s = bytesToNumberLE(rand(64)) % N;
    if (s !== 0n) return s;
  }
}

const toHex = (p: Pt) => Array.from(p.toBytes(), (b) => b.toString(16).padStart(2, '0')).join('');
function fromHex(h: string): Pt {
  if (!/^[0-9a-f]{64}$/.test(h)) throw new Error('Not a group element.');
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 32; i++) bytes[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  const p = Point.fromBytes(bytes); // throws on non-canonical encodings
  if (p.is0()) throw new Error('Identity element is not allowed.');
  return p;
}

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

const hashGene = (gene: string) => ristretto255_hasher.hashToCurve(enc.encode(`gene:${gene.toUpperCase()}`), { DST });

// ---------------------------------------------------------------- the lab

export interface LabKey { k: bigint; id: string }
export const newLabKey = (id: string): LabKey => ({ k: randomScalar(), id });

/** What the lab hands a tested person: one token per carried gene, kept on their device. */
export interface CarrierCard { lab: string; tokens: { gene: string; token: string }[] }

export function issueCard(lab: LabKey, genes: string[]): CarrierCard {
  const uniq = [...new Set(genes.map((g) => g.toUpperCase()))];
  if (uniq.length > SET_SIZE) throw new Error(`A card holds at most ${SET_SIZE} genes.`);
  return { lab: lab.id, tokens: uniq.map((gene) => ({ gene, token: toHex(hashGene(gene).multiply(lab.k)) })) };
}

// ---------------------------------------------------------------- the partners

/** Pads a card's tokens with random group elements to SET_SIZE. Remembers which slots are real. */
function padded(card: CarrierCard): { pts: Pt[]; gene: (string | null)[] } {
  const pts = card.tokens.map((t) => fromHex(t.token));
  const gene: (string | null)[] = card.tokens.map((t) => t.gene);
  while (pts.length < SET_SIZE) {
    pts.push(Point.BASE.multiply(randomScalar()));
    gene.push(null);
  }
  return { pts, gene };
}

export interface Msg1 { a: string[] }
export interface Msg2 { ab: string[]; b: string[] }
export interface Msg3 { ba: string[] }

function checkLen(xs: string[]) {
  if (!Array.isArray(xs) || xs.length !== SET_SIZE) throw new Error(`Expected exactly ${SET_SIZE} elements.`);
}

export class Initiator {
  private a = randomScalar();
  private gene: (string | null)[];
  private pos: number[]; // pos[i] = where my element i sits in A
  private sent: string[];
  private mine: string[] = [];
  constructor(card: CarrierCard) {
    const { pts, gene } = padded(card);
    this.gene = gene;
    const { out, at } = shuffle(pts.map((p) => p.multiply(this.a)));
    this.pos = at;
    this.sent = out.map(toHex);
  }
  step1(): Msg1 { return { a: this.sent }; }
  /** Returns the message for the responder and this side's result. */
  step3(m: Msg2): { msg: Msg3; shared: string[] } {
    checkLen(m.ab); checkLen(m.b);
    const ba = m.b.map((h) => fromHex(h).multiply(this.a)).map(toHex);
    const theirs = new Set(ba);
    const shared: string[] = [];
    this.gene.forEach((g, i) => { if (g && theirs.has(m.ab[this.pos[i]])) shared.push(g); });
    this.mine = shared;
    return { msg: { ba }, shared };
  }
  get result() { return this.mine; }
}

export class Responder {
  private b = randomScalar();
  private gene: (string | null)[];
  private pos: number[];
  private ab: string[] = [];
  constructor(card: CarrierCard) {
    const { pts, gene } = padded(card);
    this.gene = gene;
    const { out, at } = shuffle(pts.map((p) => p.multiply(this.b)));
    this.pos = at;
    this.sentB = out.map(toHex);
  }
  private sentB: string[];
  step2(m: Msg1): Msg2 {
    checkLen(m.a);
    this.ab = m.a.map((h) => fromHex(h).multiply(this.b)).map(toHex);
    return { ab: this.ab, b: this.sentB };
  }
  step4(m: Msg3): string[] {
    checkLen(m.ba);
    const theirs = new Set(this.ab);
    const shared: string[] = [];
    this.gene.forEach((g, i) => { if (g && theirs.has(m.ba[this.pos[i]])) shared.push(g); });
    return shared;
  }
}

/** Runs the whole exchange locally and returns what each side, and the relay, saw. */
export function runLocally(alice: CarrierCard, bob: CarrierCard) {
  const i = new Initiator(alice);
  const r = new Responder(bob);
  const m1 = i.step1();
  const m2 = r.step2(m1);
  const { msg: m3, shared: aliceLearns } = i.step3(m2);
  const bobLearns = r.step4(m3);
  return { aliceLearns, bobLearns, relaySaw: { m1, m2, m3 } };
}
