import 'server-only';
import { limited } from './ratelimit';

/**
 * Role check for the counsellor desk. The demo has named counsellor accounts (x-desk-user) behind
 * one passcode (DESK_PASSCODE, "counsellor" in local development only, sent as x-desk); production
 * uses the health authority's identity provider with per-clinician sign-in.
 */
export const COUNSELLORS = ['Dr. Fatima Al Hammadi (synthetic)', 'Dr. Yousef Al Marzouqi (synthetic)', 'Judge (demo)'] as const;

/** The signed-in counsellor's name, from the x-desk-user header, if it is a known account. */
export function deskUser(req: Request): string | null {
  const u = decodeURIComponent(req.headers.get('x-desk-user') ?? '');
  return (COUNSELLORS as readonly string[]).includes(u) ? u : null;
}

/** Checks the desk sign-in; failed attempts are limited to 20 an hour, so the passcode can't be guessed online. */
export async function deskGate(req: Request): Promise<Response | null> {
  if (deskAuthorised(req)) return null;
  if (await limited(req, 'desk-fail', 20)) return Response.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  return Response.json({ error: 'Counsellors only.' }, { status: 401 });
}

export function deskAuthorised(req: Request): boolean {
  if (!deskUser(req)) return false;
  const want = process.env.DESK_PASSCODE ?? (process.env.VERCEL_ENV || process.env.NODE_ENV === 'production' ? '' : 'counsellor');
  if (!want) return false;
  const got = req.headers.get('x-desk') ?? '';
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= got.charCodeAt(i) ^ want.charCodeAt(i);
  return diff === 0;
}
