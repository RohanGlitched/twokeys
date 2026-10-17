import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { discreteLaplace, noisyCount, prf } from '../src/lib/dp';

describe('privacy noise (exact discrete Laplace)', () => {
  it('is centred on zero with the expected spread', () => {
    const t = 2, xs = Array.from({ length: 20000 }, () => discreteLaplace(t));
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const variance = xs.reduce((a, b) => a + b * b, 0) / xs.length;
    const p = Math.exp(-1 / t), expected = (2 * p) / (1 - p) ** 2;
    expect(Math.abs(mean)).toBeLessThan(0.2);
    expect(Math.abs(variance - expected) / expected).toBeLessThan(0.1);
  });
  it('has the right shape: P(0) and P(1) match exp(-ε|x|)', () => {
    const t = 3, n = 40000, xs = Array.from({ length: n }, () => discreteLaplace(t));
    const p = Math.exp(-1 / t), p0 = (1 - p) / (1 + p);
    const f0 = xs.filter((x) => x === 0).length / n, f1 = xs.filter((x) => x === 1).length / n;
    expect(Math.abs(f0 - p0)).toBeLessThan(0.01);
    expect(Math.abs(f1 - p0 * p)).toBeLessThan(0.01);
  });
  it('has no hard cut-off in its tails', () => {
    const xs = Array.from({ length: 4000 }, () => discreteLaplace(40));
    expect(Math.max(...xs.map(Math.abs))).toBeGreaterThan(120);
  });
  it('without a key it cannot be predicted: two draws on the same data differ', () => {
    const a = Array.from({ length: 50 }, () => noisyCount(40, 5));
    const b = Array.from({ length: 50 }, () => noisyCount(40, 5));
    expect(a).not.toEqual(b);
    expect(Number.isInteger(a[0])).toBe(true);
  });
});

describe('release noise from a keyed PRF', () => {
  const key = new Uint8Array(32).fill(3), other = new Uint8Array(32).fill(4);
  const draws = (k: Uint8Array, label: string) => Array.from({ length: 50 }, (_, i) => noisyCount(40, 7, 1, prf(k, `${label}|${i}`)));
  it('recomputing a release gives exactly the same numbers, so there is no second sample to average', () => {
    expect(draws(key, 'w2900|live|booked')).toEqual(draws(key, 'w2900|live|booked'));
  });
  it('another count, week or key gets independent-looking noise', () => {
    expect(draws(key, 'w2900|live|booked')).not.toEqual(draws(key, 'w2900|live|contacted'));
    expect(draws(key, 'w2900|live|booked')).not.toEqual(draws(key, 'w2901|live|booked'));
    expect(draws(key, 'w2900|live|booked')).not.toEqual(draws(other, 'w2900|live|booked'));
  });
  it('keeps the discrete Laplace shape', () => {
    const t = 3, n = 20000, xs = Array.from({ length: n }, (_, i) => discreteLaplace(t, 1, prf(key, `shape|${i}`)));
    const p = Math.exp(-1 / t), p0 = (1 - p) / (1 + p);
    expect(Math.abs(xs.filter((x) => x === 0).length / n - p0)).toBeLessThan(0.015);
    expect(Math.abs(xs.reduce((a, b) => a + b, 0) / n)).toBeLessThan(0.2);
  });
});
