// Demo identity: picking a synthetic person mints a short-lived signed token (HMAC-SHA-256) that the
// phone keeps in memory and sends as `x-person`. Every person-scoped route derives the person from
// it and ignores ids in the body. Production replaces this with UAE PASS.
import 'server-only';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { subkey } from './labkey';
import { personById, type Person } from './people';
import type { ErrorCode } from './pairing';

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

/**
 * A pseudonym for a person (HMAC under its own key), for markers that must never hold the raw id. The key
 * rotates every UTC calendar year (subkey 'person:<year>'), so one year's markers share nothing with the
 * next year's, and the per-person markers themselves expire when their year ends (dp.untilYearEnd): after
 * that nothing is left to link to a person, even by someone holding the root key. The per-person privacy
 * budget is therefore stated per year (see api/metrics).
 */
export const pseudonym = (id: string, year = new Date().getUTCFullYear()) => Array.from(hmac(sha256, subkey(`person:${year}`), enc.encode(id)).slice(0, 16), (b) => b.toString(16).padStart(2, '0')).join('');

/** Every identity minted here is a demo identity, shared by every visitor (UAE PASS replaces this in production). */
export const isDemoIdentity = (p: Person) => !!personById(p.id);

/** An error response with a stable code (ErrorCode in lib/pairing) beside the English text, so the app can word it in either language. */
export const fail = (code: ErrorCode, error: string, status: number, extra: Record<string, unknown> = {}, headers?: HeadersInit) =>
  Response.json({ error, code, ...extra }, { status, headers });

export const needIdentity = () => fail('sign_in', 'Sign in first.', 401);
