// Demo identity: picking a synthetic person mints a short-lived signed token (HMAC-SHA-256) that the
// phone keeps in memory and sends as `x-person`. Every person-scoped route derives the person from
// it and ignores ids in the body. Production replaces this with UAE PASS.
import 'server-only';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { subkey } from './labkey';
import { personById, type Person } from './people';

const enc = new TextEncoder();
const TTL_MS = 8 * 60 * 60 * 1000;
const b64u = (b: Uint8Array) => Buffer.from(b).toString('base64url');

const key = () => subkey('identity');

export function mintIdentity(personId: string): { token: string; expires: number } {
  const expires = Date.now() + TTL_MS;
  const body = `${personId}.${expires}`;
  return { token: `${body}.${b64u(hmac(sha256, key(), enc.encode(body)))}`, expires };
}

/** The person a request acts as, or null. */
export function personFrom(req: Request): Person | null {
  const t = req.headers.get('x-person') ?? '';
  const m = /^([a-z0-9-]{2,40})\.(\d{13})\.([A-Za-z0-9_-]{43})$/.exec(t);
  if (!m) return null;
  const [, id, exp, sig] = m;
  if (Number(exp) < Date.now()) return null;
  const want = b64u(hmac(sha256, key(), enc.encode(`${id}.${exp}`)));
  if (want.length !== sig.length) return null;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0 ? personById(id) : null;
}

/** A stable pseudonym for a person (HMAC under its own key), for markers that must never hold the raw id. */
export const pseudonym = (id: string) => Array.from(hmac(sha256, subkey('person'), enc.encode(id)).slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');

export const needIdentity = () => Response.json({ error: 'Sign in first.' }, { status: 401 });
