// The lab's side of the protocol. It already holds each person's results; for one pairing session
// it issues opaque tokens only it can make, and afterwards releases gene names only for the indices
// it itself confirms are shared. Phones never hold a name they weren't entitled to.
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { macToPoint, SET_SIZE, toHex, type Token } from './psi';

export type Inheritance = 'AR' | 'XL';
export interface Finding {
  gene: string;
  inheritance: Inheritance;
  /** 'mild' = an allele that only matters with a severe one on the other side (e.g. GJB2 V37I). */
  severity: 'severe' | 'mild';
}
export type Role = 'A' | 'B';
export type Sex = 'F' | 'M';

/** A token with its meaning: stays inside the lab. */
export interface LabelledToken extends Token { label: string }

const enc = new TextEncoder();

function token(labKey: Uint8Array, session: string, tag: string, gene: string): string {
  const mac = hmac(sha256, labKey, enc.encode(`twokeys/v1|${session}|${tag}|${gene.toUpperCase()}`));
  return toHex(macToPoint(mac));
}

/**
 * Tokens for one person in one session (with labels; the lab keeps the labels).
 * - Autosomal recessive: role A gets r1 for a serious change and r2 for any change; role B the
 *   reverse; and both get an 'm' token for any change. So a gene both carry matches three times
 *   when both changes are serious, twice when one is milder, and once when both are milder: the lab
 *   uses that count to say "full", "milder" or "low-concern" match.
 * - X-linked: both partners get an 'x' token for an X-linked finding, so it matches only when she
 *   carries it and he has it. Each person's own X-linked result also reaches them as a personal
 *   result (see personalFindings), never only through the pairing.
 */
export function sessionTokens(labKey: Uint8Array, session: string, role: Role, findings: Finding[]): LabelledToken[] {
  if (!/^[0-9a-f]{32,64}$/.test(session)) throw new Error('Bad session id.');
  const out: LabelledToken[] = [];
  for (const f of findings) {
    const g = f.gene.toUpperCase();
    if (f.inheritance === 'AR') {
      const severeTag = role === 'A' ? 'r1' : 'r2';
      const anyTag = role === 'A' ? 'r2' : 'r1';
      if (f.severity === 'severe') out.push({ i: out.length, label: g, token: token(labKey, session, severeTag, g) });
      out.push({ i: out.length, label: g, token: token(labKey, session, anyTag, g) });
      out.push({ i: out.length, label: g, token: token(labKey, session, 'm', g) });
    } else {
      out.push({ i: out.length, label: `X:${g}`, token: token(labKey, session, 'x', g) });
    }
  }
  if (out.length > SET_SIZE) throw new Error('Too many findings for one session.');
  return out;
}

/**
 * What a phone receives: exactly SET_SIZE opaque, indexed tokens with no gene names. Real tokens are
 * padded with lab-made decoys that match nothing, so even someone holding the phone can't tell
 * how many findings its owner has.
 */
export function issue(labKey: Uint8Array, session: string, role: Role, findings: Finding[]): Token[] {
  const real = sessionTokens(labKey, session, role, findings).map(({ i, token }) => ({ i, token }));
  const decoys: Token[] = [];
  for (let i = real.length; i < SET_SIZE; i++) {
    const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)), (x) => x.toString(16).padStart(2, '0')).join('');
    decoys.push({ i, token: token(labKey, session, `pad:${role}`, nonce) });
  }
  // Shuffle so decoys aren't always at the end; indices travel with their tokens.
  const all = [...real, ...decoys];
  for (let k = all.length - 1; k > 0; k--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (k + 1);
    [all[k], all[j]] = [all[j], all[k]];
  }
  return all;
}

/** strength 2 = both carry a serious change; 1 = one of them carries a milder one; 0 = both milder (low concern). */
export interface SharedGene { gene: string; inheritance: Inheritance; strength: 0 | 1 | 2 }

/** The lab's own view of what two people share in a session, computed from its records. */
export function intersection(labKey: Uint8Array, session: string, a: Finding[], b: Finding[]) {
  const ta = sessionTokens(labKey, session, 'A', a);
  const tb = sessionTokens(labKey, session, 'B', b);
  const inB = new Set(tb.map((t) => t.token));
  const inA = new Set(ta.map((t) => t.token));
  const aIdx = ta.filter((t) => inB.has(t.token));
  const bIdx = tb.filter((t) => inA.has(t.token));
  const counts = new Map<string, number>();
  for (const t of aIdx) counts.set(t.label, (counts.get(t.label) ?? 0) + 1);
  const genes: SharedGene[] = [...counts.entries()].map(([label, n]) => (
    label.startsWith('X:') ? { gene: label.slice(2), inheritance: 'XL' as const, strength: 2 as const } : { gene: label, inheritance: 'AR' as const, strength: Math.min(2, n - 1) as 0 | 1 | 2 }
  )).sort((x, y) => x.gene.localeCompare(y.gene));
  return { A: new Set(aIdx.map((t) => t.token)), B: new Set(bIdx.map((t) => t.token)), genes };
}

/**
 * Findings that matter for a person whatever their partner carries: X-linked results. For a woman,
 * her sons' chances; for a man, his own health and his daughters (who will all carry it).
 */
export function personalFindings(_sex: Sex, findings: Finding[]): Finding[] {
  return findings.filter((f) => f.inheritance === 'XL');
}
