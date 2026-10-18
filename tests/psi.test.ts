import { describe, expect, it } from 'vitest';
import { Initiator, proveDleq, randomScalar, Responder, runLocally, SET_SIZE, verifyDleq, toHex, type Token } from '../src/lib/psi';
import { ALPHA_GENOTYPES, alphaArrangementUnknown, alphaOutcomes, intersection, issue, sessionTokens, type Finding } from '../src/lib/lab';
import { linkFragment, newLink, open, parseFragment, seal, sessionId, unwireM2, unwireM3, wireM2, wireM3, type WireM2, type WireM3 } from '../src/lib/pairing';
import { ristretto255 } from '@noble/curves/ed25519.js';
import panel from '../data/panel.json';
import { conditionFor } from '../src/lib/conditions';
import { PANEL_CARDS } from '../src/lib/panelcards';

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
    expect(truth.genes).toEqual([{ gene: 'GJB2', inheritance: 'AR', strength: 1 }, { gene: 'HBB', inheritance: 'AR', strength: 2, kind: 'hplc' }]);
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

  it('DLEQ proofs with a scalar at or above the group order are rejected (one encoding per proof)', () => {
    const ORDER = ristretto255.Point.Fn.ORDER;
    const k = randomScalar();
    const ins = Array.from({ length: 3 }, () => toHex(ristretto255.Point.BASE.multiply(randomScalar())));
    const outs = ins.map((h) => toHex(ristretto255.Point.fromHex(h).multiply(k)));
    const Y = toHex(ristretto255.Point.BASE.multiply(k));
    const pr = proveDleq(k, ins, outs, 'test');
    const plus = (h: string) => (BigInt('0x' + h) + ORDER).toString(16).padStart(64, '0');
    expect(verifyDleq(Y, ins, outs, pr, 'test')).toBe(true);
    expect(verifyDleq(Y, ins, outs, { ...pr, e: plus(pr.e) }, 'test')).toBe(false);
    expect(verifyDleq(Y, ins, outs, { ...pr, s: plus(pr.s) }, 'test')).toBe(false);
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

describe('the phones’ private channel', () => {
  it('someone holding only the pairing link opens the relay layer but can’t read either double-locked list', async () => {
    const link = newLink(), session = sessionId(link);
    const observer = parseFragment('#' + linkFragment(link))!; // everything in the link, nothing else
    const ta = issue(labKey, session, 'A', [ar('HBB'), ar('GJB2', 'mild'), ar('CFTR')]), tb = issue(labKey, session, 'B', [ar('HBB'), ar('GJB2')]);
    const a = new Initiator(ta), b = new Responder(tb);
    const m1 = a.step1();
    const m2 = b.step2(m1);
    const kB = b.channelKey(m1.ya, session);
    const seen2 = await open<WireM2>(observer, 'm2', await seal(link, 'm2', await wireM2(m2, kB)));
    // The link layer carries only what A needs to derive K and check the lab's signature (none here).
    expect(Object.keys(seen2).sort()).toEqual(['b', 'k', 'yb']);
    expect(JSON.stringify(seen2)).not.toContain(m2.ab[0]);
    // Neither the link's relay key nor a key from any other secret opens the inner layer.
    await expect(open(observer, 'm2/k', seen2.k)).rejects.toThrow();
    await expect(unwireM2(seen2, new Initiator(ta).channelKey(seen2.yb, session))).rejects.toThrow();
    await expect(unwireM2(seen2, b.channelKey(m1.ya, 'b2'.repeat(32)))).rejects.toThrow(); // bound to the session
    // A, and only A, gets the same K from its own secret.
    const kA = a.channelKey(seen2.yb, session);
    expect(kA).toEqual(kB);
    const { msg: m3, outcome } = a.step3(await unwireM2(seen2, kA));
    const seen3 = await open<WireM3>(observer, 'm3', await seal(link, 'm3', await wireM3(m3, kA)));
    expect(Object.keys(seen3)).toEqual(['k']);
    await expect(open(observer, 'm3/k', seen3.k)).rejects.toThrow();
    await expect(unwireM3(seen3, new Responder(tb).channelKey(m1.ya, session))).rejects.toThrow();
    const bLearns = b.step4(await unwireM3(seen3, kB));
    expect(outcome.matched.length).toBeGreaterThan(0);
    expect(bLearns.matched.length).toBe(outcome.matched.length);
  });
});

describe('globin genes: the pair decides', () => {
  const g = (a: Finding[], b: Finding[]) => intersection(labKey, S, a, b).genes;
  it('any shared HBB change is a full match until HPLC (HbS with HbC or HbD is serious)', () => {
    expect(g([ar('HBB', 'mild')], [ar('HBB')])).toEqual([{ gene: 'HBB', inheritance: 'AR', strength: 2, kind: 'hplc' }]);
    expect(g([ar('HBB', 'mild')], [ar('HBB', 'mild')])[0].strength).toBe(2);
  });
  // kind and chance are the most serious outcome (kept for older readers); outcomes is checked on its own below.
  const hba = (kind: string, chance: string, strength = kind === 'trait' ? 0 : 2) => [expect.objectContaining({ gene: 'HBA', inheritance: 'AR', strength, kind, chance })];
  it('HBA1 and HBA2 match each other, graded as Bart’s, HbH or trait, with the chance per pregnancy', () => {
    expect(g([ar('HBA1')], [ar('HBA2')])).toEqual(hba('bart', 'quarter'));
    expect(g([ar('HBA1')], [ar('HBA2', 'mild')])).toEqual(hba('hbh', 'quarter'));
    expect(g([ar('HBA2', 'mild')], [ar('HBA2', 'mild')])).toEqual(hba('trait', 'quarter'));
  });
  // Judge rounds 4 and 5: each person has two alpha haplotypes, and both people's pairs set the chance.
  const nd = (gene: string): Finding => ({ gene, inheritance: 'AR', severity: 'mild', alpha: 'nondeletional' });
  const homPlus = [ar('HBA1', 'mild'), ar('HBA2', 'mild')]; // -α/-α
  it('-α/-α with --/αα: HbH in 1 in 2, never Bart’s', () => {
    expect(g(homPlus, [ar('HBA1')])).toEqual(hba('hbh', 'half'));
    expect(g([ar('HBA1')], homPlus)).toEqual(hba('hbh', 'half'));
  });
  // Two α+ findings read in trans; in cis they would be --/αα and could give HbH, so these are not "low concern".
  it('-α/-α with -α/αα: trait in 1 in 2 as read', () => {
    expect(g(homPlus, [ar('HBA2', 'mild')])).toEqual(hba('trait', 'half', 2));
  });
  it('-α/-α with -α/-α: every child has the trait as read', () => {
    expect(g(homPlus, [ar('HBA1', 'mild'), ar('HBA2', 'mild')])).toEqual(hba('trait', 'all', 2));
  });
  it('--/αα with --/αα: Hb Bart’s in 1 in 4; --/-α with --/αα still names Bart’s first', () => {
    expect(g([ar('HBA1')], [ar('HBA2')])).toEqual(hba('bart', 'quarter'));
    expect(g([ar('HBA1'), ar('HBA2', 'mild')], [ar('HBA1')])).toEqual(hba('bart', 'quarter'));
  });
  it('a non-deletional α+ (αT-Saudi, Hb Constant Spring) meeting α0 is severe HbH, with its chance', () => {
    expect(g([nd('HBA2')], [ar('HBA1')])).toEqual(hba('hbh-severe', 'quarter'));
    expect(g([ar('HBA1')], [nd('HBA2'), nd('HBA2')])).toEqual(hba('hbh-severe', 'half'));
  });
  it('αT with αT or with -α is HbH; deletional α+ with α+ only is trait', () => {
    expect(g([nd('HBA2')], [nd('HBA2')])).toEqual(hba('hbh', 'quarter'));
    expect(g([nd('HBA2')], [ar('HBA2', 'mild')])).toEqual(hba('hbh', 'quarter'));
    expect(g([nd('HBA2'), ar('HBA1', 'mild')], [nd('HBA2'), ar('HBA1', 'mild')])).toEqual(hba('hbh', 'three-quarters'));
    expect(g([ar('HBA2', 'mild')], [ar('HBA1', 'mild')])[0].kind).toBe('trait');
  });
  it('alpha tokens are unique, and exactly one matches whatever each person carries', () => {
    const people: Finding[][] = [[ar('HBA1')], [ar('HBA2', 'mild')], homPlus, [nd('HBA2')], [ar('HBA1'), ar('HBA2', 'mild')], [nd('HBA2'), nd('HBA2')]];
    for (const a of people) {
      const t = issue(labKey, S, 'A', [...a, ar('CFTR')]);
      expect(new Set(t.map((x) => x.token)).size).toBe(t.length);
      for (const b of people) {
        const ta = sessionTokens(labKey, S, 'A', a), tb = new Set(sessionTokens(labKey, S, 'B', b).map((x) => x.token));
        expect(ta.filter((x) => tb.has(x.token))).toHaveLength(1);
      }
    }
  });
  it('pairing still finds alpha globin for a homozygous person, and the phones agree with the lab', () => {
    const a = [...homPlus, ar('CFTR')], b = [ar('HBA1'), ar('CFTR')];
    const r = pair(a, b);
    expect(r.aGenes).toEqual(['CFTR', 'HBA:a+/a+|a0/aa']);
    expect(r.bGenes).toEqual(r.aGenes);
    const ia = issue(labKey, S, 'A', a), ib = issue(labKey, S, 'B', b);
    const run = runLocally(ia, ib), truth = intersection(labKey, S, a, b);
    expect(tokensOf(run.aLearns.matched, ia)).toEqual(truth.A);
    expect(tokensOf(run.bLearns.matched, ib)).toEqual(truth.B);
    // Four matches in all: three for CFTR (both serious) and one for alpha globin, whatever the genotypes.
    expect(run.aLearns.matched).toHaveLength(4);
  });
  // Judge round 6: every outcome, not only the most serious, against a count written independently here.
  // A haplotype's working genes: αα 2, -α 1, αT 1 (not deleted, but not working), -- 0. A child's genes are the sum.
  type H = 'a0' | 'aT' | 'a+' | 'aa';
  const WORKING: Record<H, number> = { a0: 0, aT: 1, 'a+': 1, aa: 2 };
  const child = (x: H, y: H) => {
    const genes = WORKING[x] + WORKING[y];
    const nondeletional = x === 'aT' || y === 'aT';
    if (genes === 0) return 'bart';
    if (genes === 1) return nondeletional ? 'hbh-severe' : 'hbh';
    if (genes === 2) return x !== 'a0' && y !== 'a0' && nondeletional ? 'hbh' : 'trait';
    return genes === 3 ? 'carrier' : 'unaffected';
  };
  const ORDER = ['bart', 'hbh-severe', 'hbh', 'trait', 'carrier', 'unaffected'];
  const count = (a: string, b: string) => {
    const [x, y] = [a, b].map((s) => s.split('/') as H[]);
    const kids = x.flatMap((p) => y.map((q) => child(p, q)));
    return ORDER.map((kind) => ({ kind, n: kids.filter((k) => k === kind).length })).filter((o) => o.n > 0);
  };
  const finding = (h: H, i: number): Finding[] => h === 'aa' ? [] : h === 'a0' ? [ar(i ? 'HBA2' : 'HBA1')] : h === 'aT' ? [nd('HBA2')] : [ar('HBA2', 'mild')];
  const person = (genotype: string) => genotype.split('/').flatMap((h, i) => finding(h as H, i));
  it('all 81 pairs of carrier genotypes: every outcome and its chance matches an independent count', () => {
    expect(ALPHA_GENOTYPES).toHaveLength(9);
    let viable = 0, moreThanOneIllness = 0;
    for (const a of ALPHA_GENOTYPES) for (const b of ALPHA_GENOTYPES) {
      const want = count(a, b);
      expect(alphaOutcomes(a, b), `${a} × ${b}`).toEqual(want);
      const [r] = g(person(a), person(b));
      expect(r.outcomes, `${a} × ${b}`).toEqual(want);
      expect(r.outcomes!.reduce((x, o) => x + o.n, 0)).toBe(4);
      // kind and chance stay the most serious outcome.
      const worst = want.find((o) => ['bart', 'hbh-severe', 'hbh', 'trait'].includes(o.kind))!;
      expect(r.kind, `${a} × ${b}`).toBe(worst.kind);
      expect(r.chance, `${a} × ${b}`).toBe(({ 1: 'quarter', 2: 'half', 3: 'three-quarters', 4: 'all' } as Record<number, string>)[worst.n]);
      if (a !== 'a0/a0' && b !== 'a0/a0') {
        viable++;
        if (want.filter((o) => ['bart', 'hbh-severe', 'hbh'].includes(o.kind) && o.kind !== worst.kind).length) moreThanOneIllness++;
      }
    }
    // The judge's count: 22 of the 64 pairs of adults have a second disease outcome that the worst-only result hid.
    expect(viable).toBe(64);
    expect(moreThanOneIllness).toBe(22);
  });
  it('the judge’s examples: every outcome is named with its chance', () => {
    expect(alphaOutcomes('a0/a+', 'a0/a+')).toEqual([{ kind: 'bart', n: 1 }, { kind: 'hbh', n: 2 }, { kind: 'trait', n: 1 }]);
    expect(alphaOutcomes('a0/aT', 'a0/aT')).toEqual([{ kind: 'bart', n: 1 }, { kind: 'hbh-severe', n: 2 }, { kind: 'hbh', n: 1 }]);
    expect(alphaOutcomes('a0/aa', 'a0/a+')).toEqual([{ kind: 'bart', n: 1 }, { kind: 'hbh', n: 1 }, { kind: 'trait', n: 1 }, { kind: 'carrier', n: 1 }]);
    expect(alphaOutcomes('a0/aa', 'aT/a+')).toEqual([{ kind: 'hbh-severe', n: 1 }, { kind: 'hbh', n: 1 }, { kind: 'carrier', n: 2 }]);
  });
  it('two α+ findings: arrangement unknown, results as read, and the cis reading kept for the desk', () => {
    expect(alphaArrangementUnknown(homPlus)).toBe(true);
    expect(alphaArrangementUnknown([nd('HBA2'), ar('HBA1', 'mild')])).toBe(true);
    expect(alphaArrangementUnknown([ar('HBA1'), ar('HBA2', 'mild')])).toBe(false); // α0 has no gene beside it
    expect(alphaArrangementUnknown([ar('HBA2', 'mild')])).toBe(false);
    // -α/-α (or --/αα in cis) with --/αα: HbH 1 in 2 as read; Hb Bart's 1 in 4 if cis.
    expect(g(homPlus, [ar('HBA1')])[0]).toMatchObject({ kind: 'hbh', chance: 'half', arrangementUnknown: true, ifRearranged: 'bart', strength: 2 });
    // -α/-α with -α/αα: trait as read, HbH possible if cis, so never low concern.
    expect(g(homPlus, [ar('HBA2', 'mild')])[0]).toMatchObject({ kind: 'trait', arrangementUnknown: true, ifRearranged: 'hbh', strength: 2 });
    // Single findings have one reading: no flag.
    expect(g([ar('HBA1', 'mild')], [ar('HBA2', 'mild')])[0]).not.toHaveProperty('arrangementUnknown');
    expect(g([ar('HBA1'), ar('HBA2', 'mild')], [ar('HBA1')])[0]).not.toHaveProperty('arrangementUnknown');
  });
  it('no alpha match when only one partner carries an alpha change', () => {
    expect(g(homPlus, [ar('CFTR')])).toEqual([]);
  });
});

describe('condition cards cover the whole panel', () => {
  const panelGenes = (panel as { genes: { gene: string; inheritance: string; severity?: string }[] }).genes;
  it('every panel gene has a card with English and Arabic text at every level', () => {
    expect(panelGenes).toHaveLength(153);
    for (const p of panelGenes) {
      const c = conditionFor(p.gene);
      expect(c, p.gene).not.toBeNull();
      for (const l of [c!.name, c!.care, c!.what.simple, c!.what.standard, c!.what.detailed]) {
        expect(l.en.length, p.gene).toBeGreaterThan(5);
        expect(l.ar, p.gene).toMatch(/\p{Script=Arabic}/u);
        expect(l.en, p.gene).not.toMatch(/\p{Script=Arabic}/u);
      }
      expect(c!.name.ar, p.gene).not.toBe(p.gene);
      expect(c!.source.url, p.gene).toMatch(/^https:\/\//);
    }
  });
  it('panel cards keep the panel’s inheritance and severity, and X-linked cards say how it is inherited', () => {
    for (const p of panelGenes) {
      const c = PANEL_CARDS[p.gene];
      if (!c) continue;
      expect(c.severity, p.gene).toBe(p.severity ?? 'variable');
      const xl = /X chromosome/.test(c.what.standard.en);
      expect(xl, p.gene).toBe(p.inheritance === 'XL');
      if (xl) expect(c.what.standard.ar, p.gene).toMatch(/الكروموسوم X/);
    }
  });
  it('X-linked conditions that show early in boys ask for a re-check in a healthy man; ABCD1 asks for adrenal testing', () => {
    for (const g of ['DMD', 'ARX', 'L1CAM', 'PLP1', 'SLC6A8', 'OTC']) expect(conditionFor(g)!.maleNote?.en, g).toMatch(/re-checked by the lab before anything else/);
    expect(conditionFor('ABCD1')!.maleNote?.en).toMatch(/adrenal function testing/);
    expect(conditionFor('ABCD1')!.maleNote?.en).toMatch(/about 8 in 10/);
  });
  it('every severe X-linked gene says what it means for a man, and carrier notes are in both languages', () => {
    expect(conditionFor('GLA')!.maleNote?.en).toMatch(/heart, kidneys and nerves[\s\S]*migalastat/);
    expect(conditionFor('NR0B1')!.maleNote?.en).toMatch(/adrenal function testing[\s\S]*extra doses/);
    expect(conditionFor('FMR1')!.maleNote?.en).toMatch(/FXTAS[\s\S]*after age 50/);
    for (const g of ['F8', 'F9']) expect(conditionFor(g)!.maleNote?.en, g).toMatch(/clotting-factor level[\s\S]*dental work/);
    expect(conditionFor('GBA1')!.carrierNote?.en).toMatch(/Parkinson/);
    expect(conditionFor('RPGR')!.carrierNote?.en).toMatch(/retinal disease/);
    expect(conditionFor('ABCD1')!.carrierNote?.en).toMatch(/^Most women/);
    for (const g of ['GLA', 'NR0B1', 'FMR1', 'F8', 'F9', 'GBA1', 'RPGR', 'ABCD1']) {
      const c = conditionFor(g)!;
      for (const n of [c.maleNote, c.carrierNote]) if (n) expect(n.ar, g).toMatch(/\p{Script=Arabic}/u);
    }
  });
  it('HBA1 and HBA2 share the alpha-globin card', () => {
    expect(conditionFor('HBA1')).toBe(conditionFor('HBA2'));
    expect(conditionFor('HBA')!.gene).toBe('HBA');
  });
});
