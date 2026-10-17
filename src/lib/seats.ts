import 'server-only';
// Shared seat state for one pairing session. Who sat where is kept for a day only; after that just
// a "used" marker without any person id remains, so a link can't be reused and the operator can't
// later recompute who paired with whom.
import type { Role } from './lab';
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
