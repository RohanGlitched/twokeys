import 'server-only';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { subkey } from './labkey';
import { countAll, limited, over } from './ratelimit';

const enc = new TextEncoder();

/**
 * Role check for the counsellor desk. The demo has named counsellor accounts (x-desk-user) behind
 * one passcode (DESK_PASSCODE, "counsellor" in local development only, sent as x-desk); production
 * uses the health authority's identity provider with per-clinician sign-in.
 */
export const COUNSELLORS = ['Dr. Fatima Al Hammadi (synthetic)', 'Dr. Yousef Al Marzouqi (synthetic)', 'Judge (demo)'] as const;
/** The challenge judges' account opens without a passcode: the desk holds only synthetic people, and every
 * view it makes is written to the audit trail under this name. The counsellor accounts keep the passcode. */
export const JUDGE = 'Judge (demo)';

/** The signed-in counsellor's name, from the x-desk-user header, if it is a known account. */
export function deskUser(req: Request): string | null {
  let u = '';
  try { u = decodeURIComponent(req.headers.get('x-desk-user') ?? ''); } catch { return null; }
  return (COUNSELLORS as readonly string[]).includes(u) ? u : null;
}

/**
 * Checks the desk sign-in. One client (by platform-set address) that has failed 20 times in an hour is
 * refused even with the right passcode until the hour ends, so it can't keep guessing. Failures from all
 * clients together never lock anyone out (that would let anyone shut the escalation path): past 300 an
 * hour every check is slowed by 1.5 s instead, which a counsellor barely notices. Against guessing spread
 * over many addresses the bound is the passcode's strength; production uses per-clinician sign-in.
 */
export async function deskGate(req: Request): Promise<Response | null> {
  if (await over(req, 'desk-fail', 20)) return Response.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  if (await over(null, 'desk-fail', 300)) await new Promise((r) => setTimeout(r, 1500));
  if (deskAuthorised(req)) return null;
  await Promise.all([limited(req, 'desk-fail', 20), countAll('desk-fail')]);
  return Response.json({ error: 'Counsellors only.' }, { status: 401 });
}

/** Compares HMACs of the two passcodes: fixed length, no early exit, nothing learned from timing or length. */
export function deskAuthorised(req: Request): boolean {
  const user = deskUser(req);
  if (!user) return false;
  if (user === JUDGE) return true;
  const want = process.env.DESK_PASSCODE ?? (process.env.VERCEL_ENV || process.env.NODE_ENV === 'production' ? '' : 'counsellor');
  if (!want) return false;
  const k = subkey('desk-passcode');
  const a = hmac(sha256, k, enc.encode(want)), b = hmac(sha256, k, enc.encode(req.headers.get('x-desk') ?? ''));
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}
