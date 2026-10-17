import 'server-only';

/**
 * Discrete Laplace (two-sided geometric) noise for integer counts, drawn from the platform's
 * cryptographic random source, so nobody can recompute or subtract it. With sensitivity 1 it gives
 * ε-differential privacy per count, and integer arithmetic avoids floating-point attacks.
 */
export function discreteLaplace(epsilon: number): number {
  const p = Math.exp(-epsilon);
  const geometric = () => {
    // Number of failures before the first success with success probability 1 - p.
    const u = (crypto.getRandomValues(new Uint32Array(1))[0] + 1) / 4294967297; // (0, 1)
    return Math.floor(Math.log(u) / Math.log(p));
  };
  return geometric() - geometric();
}

/** A noisy count, clamped at zero. */
export const noisyCount = (n: number, epsilon: number) => Math.max(0, n + discreteLaplace(epsilon));
