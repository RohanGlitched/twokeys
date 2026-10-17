import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { discreteLaplace, noisyCount } from '../src/lib/dp';

describe('privacy noise', () => {
  it('is centred on zero with the expected spread', () => {
    const eps = 0.5, xs = Array.from({ length: 20000 }, () => discreteLaplace(eps));
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const variance = xs.reduce((a, b) => a + b * b, 0) / xs.length;
    const p = Math.exp(-eps), expected = (2 * p) / (1 - p) ** 2;
    expect(Math.abs(mean)).toBeLessThan(0.2);
    expect(Math.abs(variance - expected) / expected).toBeLessThan(0.1);
  });
  it('cannot be predicted: two releases of the same data differ', () => {
    const a = Array.from({ length: 50 }, () => noisyCount(40, 0.2));
    const b = Array.from({ length: 50 }, () => noisyCount(40, 0.2));
    expect(a).not.toEqual(b);
    expect(Number.isInteger(a[0])).toBe(true);
  });
});
