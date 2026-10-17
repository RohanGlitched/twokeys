import 'server-only';
import { hkdf } from '@noble/hashes/hkdf.js';
import { sha256 } from '@noble/hashes/sha2.js';

let cached: Uint8Array | null = null;

/** The root key. Production reads LAB_KEY (64 hex chars); local development uses a fixed key. Use subkey() for any purpose. */
export function labKey(): Uint8Array {
  if (cached) return cached;
  const hex = process.env.LAB_KEY ?? '';
  if (/^[0-9a-f]{64}$/i.test(hex)) {
    cached = Uint8Array.from(hex.match(/../g)!.map((b) => parseInt(b, 16)));
  } else {
    // Fail closed on every deployment (production and previews); only local development gets a fixed key.
    if (process.env.VERCEL_ENV || process.env.NODE_ENV === 'production') throw new Error('LAB_KEY is not set.');
    cached = new TextEncoder().encode('twokeys-development-lab-key-32b!').slice(0, 32);
  }
  return cached;
}

/**
 * One independent 32-byte key per purpose, HKDF-SHA-256 over the root key with info `twokeys/v2/<label>`,
 * so a leak or misuse in one place never hands over another. Labels in use: 'tokens' (session tokens and
 * their order), 'identity', 'audit', 'lab-signing' (Ed25519), 'dp' (noise), 'ratelimit', 'desk-passcode',
 * 'person' (pseudonyms for per-person markers), 'ask-history' (explainer history signatures).
 */
const subs = new Map<string, Uint8Array>();
export function subkey(label: string): Uint8Array {
  let k = subs.get(label);
  if (!k) subs.set(label, (k = hkdf(sha256, labKey(), undefined, new TextEncoder().encode(`twokeys/v2/${label}`), 32)));
  return k;
}
