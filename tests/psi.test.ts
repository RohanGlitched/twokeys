import { describe, expect, it } from 'vitest';
import { Initiator, proveDleq, randomScalar, Responder, runLocally, SET_SIZE, verifyDleq, toHex, type Token } from '../src/lib/psi';
import { intersection, issue, sessionTokens, type Finding } from '../src/lib/lab';
import { ristretto255 } from '@noble/curves/ed25519.js';

const labKey = new Uint8Array(32).fill(7);
const otherLab = new Uint8Array(32).fill(9);
const S = 'a1'.repeat(32);
const ar = (gene: string, severity: 'severe' | 'mild' = 'severe'): Finding => ({ gene, inheritance: 'AR', severity });
const xl = (gene: string): Finding => ({ gene, inheritance: 'XL', severity: 'severe' });

/** Runs a pairing and maps each side's matched tokens back to genes through the lab's labels. */
function pair(a: Finding[], b: Finding[], opts: { session?: string; keyB?: Uint8Array } = {}) {
  const la = new Map(sessionTokens(labKey, opts.session ?? S, 'A', a).map((t) => [t.token, t.label]));
  const lb = new Map(sessionTokens(opts.keyB ?? labKey, S, 'B', b).map((t) => [t.token, t.label]));
  const ia = issue(labKey, opts.session ?? S, 'A', a), ib = issue(opts.keyB ?? labKey, S, 'B', b);
  const r = runLocally(ia, ib);
  const names = (idx: number[], issued: Token[], l: Map<string, string>) => [...new Set(idx.map((i) => l.get(issued.find((t) => t.i === i)!.token)!))].sort();
  return { ...r, aGenes: names(r.aLearns.matched, ia, la), bGenes: names(r.bLearns.matched, ib, lb) };
}
const tokensOf = (idx: number[], issued: Token[]) => new Set(idx.map((i) => issued.find((t) => t.i === i)!.token));

describe('session-bound authorised PSI with proofs', () => {
  it('both partners find exactly the genes both carry', () => {
    const r = pair([ar('HBB'), ar('CFTR'), ar('CYP21A2')], [ar('HBB'), ar('GJB2'), ar('CYP21A2')]);
    expect(r.aGenes).toEqual(['CYP21A2', 'HBB']);
    expect(r.bGenes).toEqual(['CYP21A2', 'HBB']);
  });

  it('the lab’s own intersection agrees with the phones, and grades severity', () => {
    const a = [ar('HBB'), ar('GJB2', 'mild')];
    const b = [ar('HBB'), ar('GJB2')];
    const ia = issue(labKey, S, 'A', a), ib = issue(labKey, S, 'B', b);
    const r = runLocally(ia, ib);
    const truth = intersection(labKey, S, a, b);
    expect(tokensOf(r.aLearns.matched, ia)).toEqual(truth.A);
    expect(tokensOf(r.bLearns.matched, ib)).toEqual(truth.B);
    expect(truth.genes).toEqual([{ gene: 'GJB2', inheritance: 'AR', strength: 1 }, { gene: 'HBB', inheritance: 'AR', strength: 2 }]);
  });

  it('severity is graded: full, milder and low-concern matches', () => {
    expect(pair([ar('GJB2', 'severe')], [ar('GJB2', 'mild')]).aGenes).toEqual(['GJB2']);
    expect(pair([ar('GJB2', 'mild')], [ar('GJB2', 'severe')]).bGenes).toEqual(['GJB2']);
    expect(pair([ar('GJB2', 'mild')], [ar('GJB2', 'mild')]).aGenes).toEqual(['GJB2']);
    const g = (a: Finding[], b: Finding[]) => intersection(labKey, S, a, b).genes.map((x) => x.strength);
    expect(g([ar('GJB2')], [ar('GJB2')])).toEqual([2]);
    expect(g([ar('GJB2')], [ar('GJB2', 'mild')])).toEqual([1]);
    expect(g([ar('GJB2', 'mild')], [ar('GJB2', 'mild')])).toEqual([0]);
  });

  it('phones always receive exactly SET_SIZE tokens, real ones hidden among decoys', () => {
    expect(issue(labKey, S, 'A', []).length).toBe(SET_SIZE);
    expect(issue(labKey, S, 'A', [ar('HBB'), ar('CFTR', 'mild')]).length).toBe(SET_SIZE);
  });

  it('X-linked genes match only when she carries and he is affected', () => {
    expect(pair([xl('G6PD')], [xl('G6PD')]).aGenes).toEqual(['X:G6PD']);
    expect(pair([xl('G6PD')], []).aGenes).toEqual([]);
  });

  it('tokens from another session or another key never match', () => {
    expect(pair([ar('HBB')], [ar('HBB')], { session: 'b2'.repeat(32) }).aGenes).toEqual([]);
    expect(pair([ar('HBB')], [ar('HBB')], { keyB: otherLab }).aGenes).toEqual([]);
  });

  it('phones receive no gene names', () => {
    const t = issue(labKey, S, 'A', [ar('HBB'), xl('DMD')]);
    expect(JSON.stringify(t)).not.toMatch(/HBB|DMD|label/);
  });

  it('every message has a fixed size, so the number of findings stays hidden', () => {
    for (const r of [pair([], []), pair(Array.from({ length: 20 }, (_, i) => ar(`G${i}`)), [ar('HBB')])]) {
      expect(r.relaySaw.m1.a).toHaveLength(SET_SIZE);
      expect(r.relaySaw.m2.ab).toHaveLength(SET_SIZE);
      expect(r.relaySaw.m2.b).toHaveLength(SET_SIZE);
      expect(r.relaySaw.m3.ba).toHaveLength(SET_SIZE);
    }
  });

  it('the relay never sees a lab token', () => {
    const ta = issue(labKey, S, 'A', [ar('HBB'), ar('CFTR')]);
    const tb = issue(labKey, S, 'B', [ar('HBB')]);
    const wire = JSON.stringify(runLocally(ta, tb).relaySaw);
    for (const t of [...ta, ...tb]) expect(wire).not.toContain(t.token);
  });

  it('a phone that echoes the other list back (to fake "everything matches") fails the proof', () => {
    const i = new Initiator(issue(labKey, S, 'A', []));
    const r = new Responder(issue(labKey, S, 'B', [ar('CYP21A2'), ar('MEFV'), ar('SMN1')]));
    const m2 = r.step2(i.step1());
    const { msg } = i.step3(m2);
    expect(() => r.step4({ ...msg, ba: m2.ab })).toThrow(/proof/);
  });

  it('a responder that locks with a different secret than it proves fails the proof', () => {
    const i = new Initiator(issue(labKey, S, 'A', [ar('HBB')]));
    const r = new Responder(issue(labKey, S, 'B', [ar('HBB')]));
    const m1 = i.step1();
    const m2 = r.step2(m1);
    const k = randomScalar();
    const forged = m1.a.map((h) => toHex(ristretto255.Point.fromHex(h).multiply(k)));
    expect(() => i.step3({ ...m2, ab: forged })).toThrow(/proof/);
  });

  it('DLEQ proofs verify and reject the wrong statement', () => {
    const k = randomScalar();
    const ins = Array.from({ length: 4 }, () => toHex(ristretto255.Point.BASE.multiply(randomScalar())));
    const outs = ins.map((h) => toHex(ristretto255.Point.fromHex(h).multiply(k)));
    const Y = toHex(ristretto255.Point.BASE.multiply(k));
    const pr = proveDleq(k, ins, outs, 'test');
    expect(verifyDleq(Y, ins, outs, pr, 'test')).toBe(true);
    expect(verifyDleq(Y, ins, [...outs.slice(1), outs[0]], pr, 'test')).toBe(false);
    expect(verifyDleq(Y, ins, outs, pr, 'other-label')).toBe(false);
  });

  it('rejects wrong sizes, duplicates, the identity and non-canonical points', () => {
    const tok: Token[] = issue(labKey, S, 'A', [ar('HBB')]);
    const good = new Initiator(tok).step1();
    expect(() => new Responder(tok).step2({ ...good, a: good.a.slice(1) })).toThrow();
    expect(() => new Responder(tok).step2({ ...good, a: [good.a[0], ...good.a.slice(0, -1)] })).toThrow();
    for (const bad of ['00'.repeat(32), 'ff'.repeat(32), 'zz'.repeat(32)]) {
      const a = good.a.slice();
      a[0] = bad;
      expect(() => new Responder(tok).step2({ ...good, a })).toThrow();
    }
  });
});

describe('round-3 protocol hardening', () => {
  it('asking the lab twice returns the identical list, so diffing reveals nothing', () => {
    const f = [ar('HBB'), ar('GJB2', 'mild'), xl('G6PD')];
    expect(issue(labKey, S, 'B', f)).toEqual(issue(labKey, S, 'B', f));
  });

  it('a token’s index says nothing about which finding it is', () => {
    const f = [ar('HBB'), ar('CFTR'), ar('CYP21A2')];
    const real = new Set(sessionTokens(labKey, S, 'A', f).map((t) => t.token));
    const at = issue(labKey, S, 'A', f).filter((t) => real.has(t.token)).map((t) => t.i);
    expect(at).not.toEqual([...at.keys()]); // not simply the first positions in findings order
  });

  it('the first lock is proved against the issued tokens, and a second secret is caught', () => {
    const ia = issue(labKey, S, 'A', [ar('HBB')]);
    const me = new Initiator(ia);
    const issued = ia.map((t) => t.token);
    expect(verifyDleq(me.firstLock.y, issued, me.firstLock.locked, me.firstLock.proof, 'first-lock')).toBe(true);
    // A phone that locks its list with one secret but claims another key fails the lab's check.
    const other = new Initiator(ia);
    expect(verifyDleq(other.firstLock.y, issued, me.firstLock.locked, me.firstLock.proof, 'first-lock')).toBe(false);
  });

  it('a phone without a valid lab attestation is refused by its partner', () => {
    const ia = issue(labKey, S, 'A', [ar('HBB')]), ib = issue(labKey, S, 'B', [ar('HBB')]);
    const a = new Initiator(ia), b = new Responder(ib);
    const reject = () => false;
    expect(() => b.step2(a.step1('00'), undefined, reject)).toThrow(/didn’t attest/);
  });
});
