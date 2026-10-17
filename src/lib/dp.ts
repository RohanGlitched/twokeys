import 'server-only';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';

/**
 * Exact discrete Laplace noise for integer counts (Canonne, Kamath and Steinke, "The Discrete Gaussian
 * for Differential Privacy", 2020, Algorithm 2), with scale t/s given as integers. Every step is an
 * exact integer or rational Bernoulli trial drawn from the platform's cryptographic random source, so
 * there is no floating-point rounding to attack and the guarantee is pure ε-DP with ε = s/t per unit
 * of sensitivity.
 *
 * Programme releases draw from a keyed PRF instead of the platform source (see prf), so computing the
 * same release twice gives the same numbers rather than a second, independent sample to average (the
 * guarantee then also rests on the PRF key staying secret).
 */

/** A source of uniform 32-bit integers. */
export type Rand = () => number;
const cryptoRand: Rand = () => crypto.getRandomValues(new Uint32Array(1))[0];

/** A deterministic stream of 32-bit words: HMAC-SHA-256(key, label | block). Same key and label, same noise. */
export function prf(key: Uint8Array, label: string): Rand {
  const enc = new TextEncoder();
  let block = 0, at = 32, h = new Uint8Array(32);
  return () => {
    if (at === 32) { h = hmac(sha256, key, enc.encode(`${label}|${block++}`)); at = 0; }
    const x = new DataView(h.buffer, h.byteOffset).getUint32(at);
    at += 4;
    return x;
  };
}

/** Uniform integer in [0, n), without modulo bias. */
function uniform(n: number, rand: Rand): number {
  if (n <= 1) return 0;
  const limit = Math.floor(0x1_0000_0000 / n) * n;
  for (;;) {
    const x = rand();
    if (x < limit) return x % n;
  }
}
/** Bernoulli(p/q) for integers 0 ≤ p ≤ q. */
const bern = (p: number, q: number, rand: Rand) => uniform(q, rand) < p;

/** Bernoulli(exp(-p/q)) for integers p, q > 0 (CKS Algorithm 1). */
function bernExp(p: number, q: number, rand: Rand): boolean {
  // exp(-γ) for γ > 1 is the product of exp(-1) trials and one exp(-(γ mod 1)) trial.
  while (p > q) {
    if (!bernExpUnit(1, 1, rand)) return false;
    p -= q;
  }
  return bernExpUnit(p, q, rand);
}
/** Bernoulli(exp(-p/q)) for 0 ≤ p/q ≤ 1. */
function bernExpUnit(p: number, q: number, rand: Rand): boolean {
  let k = 1;
  while (bern(p, q * k, rand)) k++;
  return k % 2 === 1;
}

/** Discrete Laplace with scale t/s: P(x) ∝ exp(-|x|·s/t). */
export function discreteLaplace(t: number, s = 1, rand: Rand = cryptoRand): number {
  for (;;) {
    const u = uniform(t, rand);
    if (!bernExp(u, t, rand)) continue;
    let v = 0;
    while (bernExp(1, 1, rand)) v++;
    const y = Math.floor((u + t * v) / s);
    const negative = bern(1, 2, rand);
    if (negative && y === 0) continue;
    return negative ? -y : y;
  }
}

/**
 * A noisy count, clamped at zero. `scale` is the integer t in ε = 1/t per unit of sensitivity; a
 * count where one person can add up to `sensitivity` gets scale t·sensitivity.
 */
export const noisyCount = (n: number, scale: number, sensitivity = 1, rand: Rand = cryptoRand) => Math.max(0, n + discreteLaplace(scale * sensitivity, 1, rand));

/** Per-person markers that must outlive every release ("for life"): kept 100 years. */
export const FOREVER = 100 * 365 * 86_400;
/** A TTL (seconds) stretched to end at a UTC midnight, so an expiry doesn't record the second something was written. */
export function dayAligned(ttl: number): number {
  const now = Math.floor(Date.now() / 1000);
  return Math.ceil((now + ttl) / 86_400) * 86_400 - now;
}
/** The UTC midnight a time falls in. */
export const dayStart = (t = Date.now()) => Math.floor(t / 86_400_000) * 86_400_000;
