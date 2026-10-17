import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { discreteLaplace, noisyCount } from '../src/lib/dp';

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
  it('cannot be predicted: two releases of the same data differ', () => {
    const a = Array.from({ length: 50 }, () => noisyCount(40, 5));
    const b = Array.from({ length: 50 }, () => noisyCount(40, 5));
    expect(a).not.toEqual(b);
    expect(Number.isInteger(a[0])).toBe(true);
  });
});
