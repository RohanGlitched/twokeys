import 'server-only';

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
