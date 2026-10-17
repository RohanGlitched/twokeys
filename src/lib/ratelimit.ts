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

/** Reads a limit's current count without adding to it. True when already over the limit. */
export async function over(req: Request | null, bucket: string, perHour: number): Promise<boolean> {
  const window = Math.floor(Date.now() / 3_600_000);
  const n = await store().get<{ n: number } | number>(`rl:${bucket}:${req ? clientKey(req) : 'all'}:${window}`);
  return (typeof n === 'number' ? n : n?.n ?? 0) >= perHour;
}
/** Counts one event against a limit shared by every client. */
export async function countAll(bucket: string): Promise<number> {
  return store().incr(`rl:${bucket}:all:${Math.floor(Date.now() / 3_600_000)}`, 3600);
}
