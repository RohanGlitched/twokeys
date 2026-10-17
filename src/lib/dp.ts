import 'server-only';

/**
 * Exact discrete Laplace noise for integer counts (Canonne, Kamath and Steinke, "The Discrete Gaussian
 * for Differential Privacy", 2020, Algorithm 2), with scale t/s given as integers. Every step is an
 * exact integer or rational Bernoulli trial drawn from the platform's cryptographic random source, so
 * there is no floating-point rounding to attack and the guarantee is pure ε-DP with ε = s/t per unit
 * of sensitivity.
 */

/** Uniform integer in [0, n), without modulo bias. */
function uniform(n: number): number {
  if (n <= 1) return 0;
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  for (;;) {
    const x = crypto.getRandomValues(new Uint32Array(1))[0];
    if (x < limit) return x % n;
  }
}
/** Bernoulli(p/q) for integers 0 ≤ p ≤ q. */
const bern = (p: number, q: number) => uniform(q) < p;

/** Bernoulli(exp(-p/q)) for integers p, q > 0 (CKS Algorithm 1). */
function bernExp(p: number, q: number): boolean {
  // exp(-γ) for γ > 1 is the product of exp(-1) trials and one exp(-(γ mod 1)) trial.
  while (p > q) {
    if (!bernExpUnit(1, 1)) return false;
    p -= q;
  }
  return bernExpUnit(p, q);
}
/** Bernoulli(exp(-p/q)) for 0 ≤ p/q ≤ 1. */
function bernExpUnit(p: number, q: number): boolean {
  let k = 1;
  while (bern(p, q * k)) k++;
  return k % 2 === 1;
}

/** Discrete Laplace with scale t/s: P(x) ∝ exp(-|x|·s/t). */
export function discreteLaplace(t: number, s = 1): number {
  for (;;) {
    const u = uniform(t);
    if (!bernExp(u, t)) continue;
    let v = 0;
    while (bernExp(1, 1)) v++;
    const y = Math.floor((u + t * v) / s);
    const negative = bern(1, 2);
    if (negative && y === 0) continue;
    return negative ? -y : y;
  }
}

/**
 * A noisy count, clamped at zero. `scale` is the integer t in ε = 1/t per unit of sensitivity; a
 * count where one person can add up to `sensitivity` gets scale t·sensitivity.
 */
export const noisyCount = (n: number, scale: number, sensitivity = 1) => Math.max(0, n + discreteLaplace(scale * sensitivity));
