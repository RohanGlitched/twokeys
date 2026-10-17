import 'server-only';
// Shared seat state for one pairing session. Who sat where is kept for a day only; after that just
// a "used" marker without any person id remains, so a link can't be reused and the operator can't
// later recompute who paired with whom.
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { fail } from './identity';
import type { Role } from './lab';
import { subkey } from './labkey';
import { store } from './store';

export const PAIR_TTL = 24 * 3600;
export const USED_TTL = 30 * 24 * 3600;
export const hex64 = /^[0-9a-f]{64}$/;

export async function seats(session: string) {
  const db = store();
  const [A, B, okA, okB, stop] = await Promise.all([
    db.get<string>(`seat:${session}:A`), db.get<string>(`seat:${session}:B`),
    db.get<string>(`ok:${session}:A`), db.get<string>(`ok:${session}:B`),
    db.get<Role>(`stop:${session}`),
  ]);
  // A confirmation counts only for the person who is actually in the other seat.
  const confirmed = !!A && !!B && okA === B && okB === A;
  return { A, B, okA, okB, confirmed, stopped: stop ?? null };
}
export const otherRole = (r: Role): Role => (r === 'A' ? 'B' : 'A');

/**
 * Someone in the pairing says no or stops. The link's creator saying no to a joiner they haven't
 * confirmed is "not my partner": the joiner's seat is freed for the right person, and that joiner can't
 * sit again (their next request is answered 'stopped'). Anything else ends the session for both: every
 * later lab request in it is answered 'stopped'.
 */
export async function stopSession(session: string, role: Role, s: Awaited<ReturnType<typeof seats>>) {
  const db = store();
  if (role === 'A' && s.B && s.okA !== s.B) {
    await db.put(`rejected:${session}:${s.B}`, true, PAIR_TTL);
    await Promise.all([db.del(`seat:${session}:B`), db.del(`ok:${session}:B`)]);
    return;
  }
  await db.putNew(`stop:${session}`, role, PAIR_TTL);
}
/** True if the creator said no to this person in this session. */
export const wasRejected = async (session: string, person: string) => !!(await store().get<boolean>(`rejected:${session}:${person}`));

/** Makes the session's server nonce, once, when a seat is first taken; it lives as long as the seats. */
export async function newNonce(session: string) {
  const n = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');
  await store().putNew(`nonce:${session}`, n, PAIR_TTL);
}
/**
 * The token key for one session: HMAC(tokens key, session | nonce). With the nonce, a session id that
 * comes round again (a link reused after its marker expired) never gets the same tokens; kept beside the
 * seats, it lets the lab rebuild exactly what it issued. Null once the session has expired.
 */
export async function sessionKey(session: string): Promise<Uint8Array | null> {
  const n = await store().get<string>(`nonce:${session}`);
  return n ? hmac(sha256, subkey('tokens'), new TextEncoder().encode(`twokeys/v2|session|${session}|${n}`)) : null;
}
export const expired = () => fail('link_expired', 'This pairing has expired. Start a new one.', 410);
export const stoppedRes = () => fail('stopped', 'Your partner stopped this comparison. Nothing was revealed.', 409, {}, { 'cache-control': 'no-store' });
export const badRole = () => fail('bad_request', 'Role must be A or B.', 400);
export const badSession = () => fail('bad_request', 'Bad session id.', 400);
export const notInPairing = () => fail('not_in_pairing', 'You are not in this pairing.', 403);
export const notConfirmed = () => fail('not_confirmed', 'Both of you need to confirm each other first.', 409);
export const tooMany = (error = 'Too many requests.') => fail('rate_limited', error, 429);
