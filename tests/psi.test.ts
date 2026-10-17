import { describe, expect, it } from 'vitest';
import { Initiator, Responder, runLocally, SET_SIZE, type Token } from '../src/lib/psi';
import { issue, matchedGenes, type Finding } from '../src/lib/lab';

const labKey = new Uint8Array(32).fill(7);
const otherLab = new Uint8Array(32).fill(9);
const S = 'a1'.repeat(16);
const ar = (gene: string, severity: 'severe' | 'mild' = 'severe'): Finding => ({ gene, inheritance: 'AR', severity });
const xl = (gene: string): Finding => ({ gene, inheritance: 'XL', severity: 'severe' });

function pair(a: Finding[], b: Finding[], opts: { mode?: 'reveal' | 'count'; session?: string; keyB?: Uint8Array; aSex?: 'F' | 'M'; bSex?: 'F' | 'M' } = {}) {
  const ta = issue(labKey, opts.session ?? S, 'A', opts.aSex ?? 'F', a);
  const tb = issue(opts.keyB ?? labKey, S, 'B', opts.bSex ?? 'M', b);
  return runLocally(ta, tb, opts.mode ?? 'reveal');
}
const genes = (o: { mode: string; labels?: string[] }) => matchedGenes((o as { labels: string[] }).labels);

describe('session-bound authorised PSI', () => {
  it('both partners learn exactly the genes both carry', () => {
    const r = pair([ar('HBB'), ar('CFTR'), ar('CYP21A2')], [ar('HBB'), ar('GJB2'), ar('CYP21A2')]);
    expect(genes(r.aLearns).ar).toEqual(['CYP21A2', 'HBB']);
    expect(genes(r.bLearns).ar).toEqual(['CYP21A2', 'HBB']);
  });

  it('severe × mild matches, mild × mild does not', () => {
    expect(genes(pair([ar('GJB2', 'severe')], [ar('GJB2', 'mild')]).aLearns).ar).toEqual(['GJB2']);
    expect(genes(pair([ar('GJB2', 'mild')], [ar('GJB2', 'severe')]).bLearns).ar).toEqual(['GJB2']);
    expect(genes(pair([ar('GJB2', 'mild')], [ar('GJB2', 'mild')]).aLearns).ar).toEqual([]);
  });

  it('X-linked genes match only when she carries and he is affected', () => {
    expect(genes(pair([xl('G6PD')], [xl('G6PD')]).aLearns).xl).toEqual(['G6PD']);
    expect(genes(pair([xl('G6PD')], []).aLearns).xl).toEqual([]);
  });

  it('tokens from another session or another key never match', () => {
    expect(genes(pair([ar('HBB')], [ar('HBB')], { session: 'b2'.repeat(16) }).aLearns).ar).toEqual([]);
    expect(genes(pair([ar('HBB')], [ar('HBB')], { keyB: otherLab }).aLearns).ar).toEqual([]);
  });

  it('count mode tells the initiator how many, not which', () => {
    const r = pair([ar('HBB', 'mild'), ar('PAH', 'mild')], [ar('HBB'), ar('PAH')], { mode: 'count' });
    expect(r.aLearns).toEqual({ mode: 'count', count: 2 });
    expect(r.bLearns).toEqual({ mode: 'count', count: 2 });
  });

  it('every message has a fixed size, so the number of findings stays hidden', () => {
    for (const r of [pair([], []), pair(Array.from({ length: 30 }, (_, i) => ar(`G${i}`)), [ar('HBB')])]) {
      expect(r.relaySaw.m1.a).toHaveLength(SET_SIZE);
      expect(r.relaySaw.m2.ab).toHaveLength(SET_SIZE);
      expect(r.relaySaw.m2.b).toHaveLength(SET_SIZE);
      expect(r.relaySaw.m3.ba).toHaveLength(SET_SIZE);
    }
  });

  it('the relay never sees a lab token or a gene name', () => {
    const ta = issue(labKey, S, 'A', 'F', [ar('HBB'), ar('CFTR')]);
    const tb = issue(labKey, S, 'B', 'M', [ar('HBB')]);
    const wire = JSON.stringify(runLocally(ta, tb).relaySaw);
    for (const t of [...ta, ...tb]) {
      expect(wire).not.toContain(t.token);
      expect(wire).not.toContain(t.label);
    }
  });

  it('rejects wrong sizes, duplicates, the identity and non-canonical points', () => {
    const tok: Token[] = issue(labKey, S, 'A', 'F', [ar('HBB')]);
    const i = new Initiator(tok);
    const good = i.step1();
    expect(() => new Responder(tok).step2({ ...good, a: good.a.slice(1) })).toThrow();
    expect(() => new Responder(tok).step2({ ...good, a: [good.a[0], ...good.a.slice(0, -1)] })).toThrow();
    for (const bad of ['00'.repeat(32), 'ff'.repeat(32), 'zz'.repeat(32)]) {
      const a = good.a.slice();
      a[0] = bad;
      expect(() => new Responder(tok).step2({ ...good, a })).toThrow();
    }
  });
});
