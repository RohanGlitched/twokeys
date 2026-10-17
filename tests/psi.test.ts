import { describe, expect, it } from 'vitest';
import { issueCard, newLabKey, runLocally, SET_SIZE, Initiator, Responder } from '../src/lib/psi';

const lab = newLabKey('lab-a');

describe('authorised PSI', () => {
  it('each partner learns exactly the genes both carry', () => {
    const alice = issueCard(lab, ['HBB', 'CFTR', 'SMN1', 'PAH']);
    const bob = issueCard(lab, ['HBB', 'GJB2', 'PAH']);
    const { aliceLearns, bobLearns } = runLocally(alice, bob);
    expect(aliceLearns.sort()).toEqual(['HBB', 'PAH']);
    expect(bobLearns.sort()).toEqual(['HBB', 'PAH']);
  });

  it('finds nothing when nothing is shared, and handles empty cards', () => {
    expect(runLocally(issueCard(lab, ['HBB']), issueCard(lab, ['CFTR'])).aliceLearns).toEqual([]);
    expect(runLocally(issueCard(lab, []), issueCard(lab, ['CFTR'])).bobLearns).toEqual([]);
  });

  it('every message has the same fixed size, so card sizes stay hidden', () => {
    const small = runLocally(issueCard(lab, ['HBB']), issueCard(lab, []));
    const big = runLocally(issueCard(lab, Array.from({ length: 30 }, (_, i) => `G${i}`)), issueCard(lab, ['HBB']));
    for (const r of [small, big]) {
      expect(r.relaySaw.m1.a).toHaveLength(SET_SIZE);
      expect(r.relaySaw.m2.ab).toHaveLength(SET_SIZE);
      expect(r.relaySaw.m2.b).toHaveLength(SET_SIZE);
      expect(r.relaySaw.m3.ba).toHaveLength(SET_SIZE);
    }
  });

  it('the relay never sees a token or a gene name', () => {
    const alice = issueCard(lab, ['HBB', 'CFTR']);
    const bob = issueCard(lab, ['HBB']);
    const { relaySaw } = runLocally(alice, bob);
    const wire = JSON.stringify(relaySaw);
    for (const t of [...alice.tokens, ...bob.tokens]) {
      expect(wire).not.toContain(t.token);
      expect(wire).not.toContain(t.gene);
    }
  });

  it('a card from another lab key cannot match (no forged tokens)', () => {
    const forger = newLabKey('forger');
    const alice = issueCard(lab, ['HBB']);
    const fake = issueCard(forger, ['HBB']);
    expect(runLocally(alice, fake).aliceLearns).toEqual([]);
  });

  it('rejects malformed or wrongly sized messages', () => {
    const i = new Initiator(issueCard(lab, ['HBB']));
    const r = new Responder(issueCard(lab, ['HBB']));
    expect(() => r.step2({ a: i.step1().a.slice(1) })).toThrow();
    const bad = i.step1().a.slice();
    bad[0] = '00'.repeat(32); // identity
    expect(() => r.step2({ a: bad })).toThrow();
    bad[0] = 'zz'.repeat(32);
    expect(() => r.step2({ a: bad })).toThrow();
  });

  it('two runs of the same cards look unrelated on the wire', () => {
    const alice = issueCard(lab, ['HBB']);
    const bob = issueCard(lab, ['HBB']);
    const r1 = runLocally(alice, bob).relaySaw.m1.a;
    const r2 = runLocally(alice, bob).relaySaw.m1.a;
    expect(r1.filter((x) => r2.includes(x))).toEqual([]);
  });
});
