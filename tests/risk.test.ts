import { describe, expect, it } from 'vitest';
import { carrierFreq, childAffectedPrior, F, oneIn, partnerCarrierGiven, RELATIONSHIPS, residualAfterNegative } from '../src/lib/risk';
import { carries, cohort, Pedigree, rng, affected } from '../src/lib/sim';

// Monte Carlo checks of the closed forms. Tolerances are ~4 standard errors.
const within = (got: number, want: number, n: number) => {
  const se = Math.sqrt(Math.max(want * (1 - want), 1e-9) / n);
  expect(Math.abs(got - want)).toBeLessThan(4 * se + 1e-6);
};

describe('risk engine against simulated pedigrees', () => {
  it('child affected: q²(1−F) + qF for every relationship', () => {
    const q = 0.05;
    const n = 200_000;
    for (const rel of RELATIONSHIPS) {
      const p = new Pedigree([q], rng(11 + rel.length));
      let hits = 0;
      for (let k = 0; k < n; k++) {
        const [a, b] = p.couple(rel);
        if (affected(p.child(a, b), 0)) hits++;
      }
      within(hits / n, childAffectedPrior(q, rel), n);
    }
  });

  it('partner is a carrier given a known carrier: 2φ + (1 − 2φ)·cf', () => {
    const q = 0.02;
    for (const rel of ['unrelated', 'first-cousins', 'double-first-cousins'] as const) {
      const p = new Pedigree([q], rng(29));
      let given = 0, both = 0;
      for (let k = 0; k < 400_000; k++) {
        const [a, b] = p.couple(rel);
        if (carries(a, 0)) { given++; if (carries(b, 0)) both++; }
      }
      // The closed form ignores the (small) chance the known carrier is homozygous or carries two
      // different founder alleles, so allow 6% relative slack on top of sampling error.
      const want = partnerCarrierGiven(q, rel);
      expect(Math.abs(both / given - want)).toBeLessThan(4 * Math.sqrt(want * (1 - want) / given) + 0.06 * want);
    }
  });

  it('first cousins raise the at-risk couple rate several-fold at a single gene', () => {
    const q = 0.01;
    const un = cohort([q], 'unrelated', 400_000, 3).atRiskCouples;
    const fc = cohort([q], 'first-cousins', 400_000, 4).atRiskCouples;
    within(un, carrierFreq(q) ** 2, 400_000);
    expect(fc / un).toBeGreaterThan(4);
  });

  it('Bayes residual risk after a negative test', () => {
    expect(residualAfterNegative(1 / 25, 0.95)).toBeCloseTo((0.04 * 0.05) / (1 - 0.04 * 0.95), 10);
    expect(residualAfterNegative(0.5, 1)).toBe(0);
  });

  it('inbreeding coefficients are the textbook values', () => {
    expect(F['first-cousins']).toBe(1 / 16);
    expect(F['double-first-cousins']).toBe(1 / 8);
    expect(F['second-cousins']).toBe(1 / 64);
  });

  it('formats chances for people', () => {
    expect(oneIn(0.25)).toBe('1 in 4');
    expect(oneIn(1 / 25)).toBe('1 in 25');
    expect(oneIn(0.5)).toBe('50 in 100');
    expect(oneIn(0)).toBe('less than 1 in 1,000,000');
  });
});
