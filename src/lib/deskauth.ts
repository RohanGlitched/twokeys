import 'server-only';

/**
 * Role check for the counsellor desk. The demo uses one shared passcode (DESK_PASSCODE, default
 * "counsellor" in development) sent as the x-desk header; production would use the health
 * authority's identity provider with per-clinician accounts.
 */
export function deskAuthorised(req: Request): boolean {
  const want = process.env.DESK_PASSCODE ?? (process.env.VERCEL_ENV === 'production' ? '' : 'counsellor');
  if (!want) return false;
  const got = req.headers.get('x-desk') ?? '';
  if (got.length !== want.length) return false;
  let diff = 0;
  for (let i = 0; i < want.length; i++) diff |= got.charCodeAt(i) ^ want.charCodeAt(i);
  return diff === 0;
}
