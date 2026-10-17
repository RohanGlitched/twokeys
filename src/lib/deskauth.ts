import 'server-only';
import { countAll, limited, over } from './ratelimit';

/**
 * Role check for the counsellor desk. The demo has named counsellor accounts (x-desk-user) behind
 * one passcode (DESK_PASSCODE, "counsellor" in local development only, sent as x-desk); production
 * uses the health authority's identity provider with per-clinician sign-in.
 */
export const COUNSELLORS = ['Dr. Fatima Al Hammadi (synthetic)', 'Dr. Yousef Al Marzouqi (synthetic)', 'Judge (demo)'] as const;

/** The signed-in counsellor's name, from the x-desk-user header, if it is a known account. */
export function deskUser(req: Request): string | null {
  let u = '';
  try { u = decodeURIComponent(req.headers.get('x-desk-user') ?? ''); } catch { return null; }
  return (COUNSELLORS as readonly string[]).includes(u) ? u : null;
}

/**
 * Checks the desk sign-in. The limit is checked first, so once a client has failed 20 times in an hour
 * even the right passcode is refused until the hour ends; and failures from all clients together are
 * capped at 300 an hour, so spreading guesses across addresses doesn't help either.
 */
export async function deskGate(req: Request): Promise<Response | null> {
  const busy = Response.json({ error: 'Too many attempts. Try again later.' }, { status: 429 });
  if ((await over(req, 'desk-fail', 20)) || (await over(null, 'desk-fail', 300))) return busy;
  if (deskAuthorised(req)) return null;
  await Promise.all([limited(req, 'desk-fail', 20), countAll('desk-fail')]);
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
