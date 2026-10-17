import 'server-only';
import { sha256 } from '@noble/hashes/sha2.js';
import { store } from './store';

/** A daily-salted hash of the client address, so limits never store raw IPs. */
export function clientKey(req: Request): string {
  const ip = (req.headers.get('x-forwarded-for') ?? 'local').split(',')[0].trim();
  const day = new Date().toISOString().slice(0, 10);
  return Array.from(sha256(new TextEncoder().encode(`${day}|${ip}|twokeys`)).slice(0, 10), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Atomic fixed-window limit per client (and optional subject). True when over the limit. */
export async function limited(req: Request, bucket: string, perHour: number, subject = ''): Promise<boolean> {
  const window = Math.floor(Date.now() / 3_600_000);
  const n = await store().incr(`rl:${bucket}:${clientKey(req)}${subject ? ':' + subject : ''}:${window}`, 3600);
  return n > perHour;
}
