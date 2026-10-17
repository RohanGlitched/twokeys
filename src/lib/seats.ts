import 'server-only';
// Shared seat state for one pairing session. Who sat where is kept for a day only; after that just
// a "used" marker without any person id remains, so a link can't be reused and the operator can't
// later recompute who paired with whom.
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import type { Role } from './lab';
import { subkey } from './labkey';
import { store } from './store';

export const PAIR_TTL = 24 * 3600;
export const USED_TTL = 30 * 24 * 3600;
export const hex64 = /^[0-9a-f]{64}$/;

export async function seats(session: string) {
  const db = store();
  const [A, B, okA, okB] = await Promise.all([
    db.get<string>(`seat:${session}:A`), db.get<string>(`seat:${session}:B`),
    db.get<string>(`ok:${session}:A`), db.get<string>(`ok:${session}:B`),
  ]);
  // A confirmation counts only for the person who is actually in the other seat.
  const confirmed = !!A && !!B && okA === B && okB === A;
  return { A, B, okA, okB, confirmed };
}
export const otherRole = (r: Role): Role => (r === 'A' ? 'B' : 'A');

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
export const expired = () => Response.json({ error: 'This pairing has expired. Start a new one.' }, { status: 410 });
