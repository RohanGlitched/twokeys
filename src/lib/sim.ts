// A pedigree simulator: founders draw alleles at population frequency, children inherit one allele
// from each parent by Mendel's law, and couples are built with real family structures (first
// cousins share grandparents, and so on). It validates the closed-form risk engine and produces the
// synthetic population the demo uses. Seeded, so every run is reproducible.
import type { Relationship } from './risk';

export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A person's genotype: for each gene, two alleles (0 = typical, 1 = pathogenic). */
export type Genome = Uint8Array; // length 2 × genes

export class Pedigree {
  constructor(private qs: number[], private r: () => number) {}
  founder(): Genome {
    const g = new Uint8Array(this.qs.length * 2);
    for (let i = 0; i < this.qs.length; i++) {
      g[2 * i] = this.r() < this.qs[i] ? 1 : 0;
      g[2 * i + 1] = this.r() < this.qs[i] ? 1 : 0;
    }
    return g;
  }
  child(mum: Genome, dad: Genome): Genome {
    const g = new Uint8Array(this.qs.length * 2);
    for (let i = 0; i < this.qs.length; i++) {
      g[2 * i] = mum[2 * i + (this.r() < 0.5 ? 0 : 1)];
      g[2 * i + 1] = dad[2 * i + (this.r() < 0.5 ? 0 : 1)];
    }
    return g;
  }
  /** Two people related as `rel`, each born into a real family tree. */
  couple(rel: Relationship): [Genome, Genome] {
    const f = () => this.founder();
    switch (rel) {
      case 'unrelated':
        return [f(), f()];
      case 'first-cousins': {
        const [g1, g2] = [f(), f()];
        const s1 = this.child(g1, g2), s2 = this.child(g1, g2);
        return [this.child(s1, f()), this.child(s2, f())];
      }
      case 'double-first-cousins': {
        const [a1, a2, b1, b2] = [f(), f(), f(), f()];
        const s1 = this.child(a1, a2), s2 = this.child(a1, a2);
        const t1 = this.child(b1, b2), t2 = this.child(b1, b2);
        return [this.child(s1, t1), this.child(s2, t2)];
      }
      case 'second-cousins': {
        const [g1, g2] = [f(), f()];
        const s1 = this.child(g1, g2), s2 = this.child(g1, g2);
        const c1 = this.child(s1, f()), c2 = this.child(s2, f());
        return [this.child(c1, f()), this.child(c2, f())];
      }
      case 'first-cousins-once-removed': {
        const [g1, g2] = [f(), f()];
        const s1 = this.child(g1, g2), s2 = this.child(g1, g2);
        const c1 = this.child(s1, f()), c2 = this.child(s2, f());
        return [c1, this.child(c2, f())];
      }
    }
  }
}

export const carries = (g: Genome, i: number) => g[2 * i] + g[2 * i + 1] >= 1;
export const affected = (g: Genome, i: number) => g[2 * i] + g[2 * i + 1] === 2;

export interface CohortStats {
  couples: number;
  /** Share of couples who both carry at least one same gene on the panel. */
  atRiskCouples: number;
  /** Mean number of panel genes a person carries. */
  meanCarried: number;
  /** Share of simulated children affected by any panel gene. */
  childAffected: number;
}

/** Simulates `n` couples of one relationship over a panel and measures what screening would find. */
export function cohort(qs: number[], rel: Relationship, n: number, seed = 1): CohortStats {
  const r = rng(seed);
  const p = new Pedigree(qs, r);
  let atRisk = 0, carried = 0, kids = 0;
  for (let k = 0; k < n; k++) {
    const [a, b] = p.couple(rel);
    let shared = false;
    for (let i = 0; i < qs.length; i++) {
      const ca = carries(a, i), cb = carries(b, i);
      carried += (ca ? 1 : 0) + (cb ? 1 : 0);
      if (ca && cb) shared = true;
    }
    if (shared) atRisk++;
    const child = p.child(a, b);
    for (let i = 0; i < qs.length; i++) if (affected(child, i)) { kids++; break; }
  }
  return { couples: n, atRiskCouples: atRisk / n, meanCarried: carried / (2 * n), childAffected: kids / n };
}
