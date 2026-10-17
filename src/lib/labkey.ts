import 'server-only';

let cached: Uint8Array | null = null;

/** The lab's token key. Production reads LAB_KEY (64 hex chars); local development uses a fixed key. */
export function labKey(): Uint8Array {
  if (cached) return cached;
  const hex = process.env.LAB_KEY ?? '';
  if (/^[0-9a-f]{64}$/i.test(hex)) {
    cached = Uint8Array.from(hex.match(/../g)!.map((b) => parseInt(b, 16)));
  } else {
    if (process.env.VERCEL_ENV === 'production') throw new Error('LAB_KEY is not set.');
    cached = new TextEncoder().encode('twokeys-development-lab-key-32b!').slice(0, 32);
  }
  return cached;
}
