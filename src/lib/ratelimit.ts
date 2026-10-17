import 'server-only';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { subkey } from './labkey';
import { store } from './store';

/**
 * The client address. On Vercel the edge sets x-real-ip (and x-forwarded-for) itself to the address it
 * accepted the connection from, overwriting whatever the client sent, so only x-real-ip is read and no
 * client-supplied hop is ever trusted. Off Vercel (local development) every request counts as one client.
 */
const clientIp = (req: Request) => (process.env.VERCEL ? (req.headers.get('x-real-ip') ?? '').trim() || 'unknown' : 'local');

/**
 * HMAC (server key) of the day, the address and an optional subject: limits never store a raw address
 * or person id, and without the key nobody can tell which rows share an address or a person.
 */
function limitKey(req: Request, subject = ''): string {
  const day = new Date().toISOString().slice(0, 10);
  return Array.from(hmac(sha256, subkey('ratelimit'), new TextEncoder().encode(`${day}|${clientIp(req)}|${subject}`)).slice(0, 12), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Atomic fixed-window limit per client (and optional subject, folded into the same opaque key). True when over the limit. */
export async function limited(req: Request, bucket: string, perHour: number, subject = ''): Promise<boolean> {
  const window = Math.floor(Date.now() / 3_600_000);
  const n = await store().incr(`rl:${bucket}:${limitKey(req, subject)}:${window}`, 3600);
  return n > perHour;
}

/** Reads a limit's current count without adding to it. True when already over the limit. */
export async function over(req: Request | null, bucket: string, perHour: number): Promise<boolean> {
  const window = Math.floor(Date.now() / 3_600_000);
  const n = await store().get<{ n: number } | number>(`rl:${bucket}:${req ? limitKey(req) : 'all'}:${window}`);
  return (typeof n === 'number' ? n : n?.n ?? 0) >= perHour;
}
/** Counts one event against a limit shared by every client. */
export async function countAll(bucket: string): Promise<number> {
  return store().incr(`rl:${bucket}:all:${Math.floor(Date.now() / 3_600_000)}`, 3600);
}
