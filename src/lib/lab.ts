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
 * - Autosomal recessive: role A gets r1 for severe and r2 for any finding; role B the reverse,
 *   so severe×any matches and mild×mild doesn't. A severe×severe gene matches twice, a
 *   severe×mild gene once: the lab uses that to say "one of you carries a milder change".
 * - X-linked: both partners get an 'x' token for an X-linked finding, so it matches only when she
 *   carries it and he is affected. Her X-linked carrier result matters for sons whatever he carries;
 *   it reaches her as a personal result (see personalFindings), never through the pairing.
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
    } else {
      out.push({ i: out.length, label: `X:${g}`, token: token(labKey, session, 'x', g) });
    }
  }
  if (out.length > SET_SIZE) throw new Error('Too many findings for one session.');
  return out;
}

/** What a phone receives: opaque, indexed tokens with no gene names. */
export function issue(labKey: Uint8Array, session: string, role: Role, findings: Finding[]): Token[] {
  return sessionTokens(labKey, session, role, findings).map(({ i, token }) => ({ i, token }));
}

export interface SharedGene { gene: string; inheritance: Inheritance; /** 2 = both carry a severe change; 1 = one of them carries a milder one. */ strength: 1 | 2 }

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
    label.startsWith('X:') ? { gene: label.slice(2), inheritance: 'XL' as const, strength: 2 as const } : { gene: label, inheritance: 'AR' as const, strength: (n >= 2 ? 2 : 1) as 1 | 2 }
  )).sort((x, y) => x.gene.localeCompare(y.gene));
  return { A: new Set(aIdx.map((t) => t.i)), B: new Set(bIdx.map((t) => t.i)), genes };
}

/** Findings that matter for a person whatever their partner carries: a woman's X-linked carrier results. */
export function personalFindings(sex: Sex, findings: Finding[]): Finding[] {
  return sex === 'F' ? findings.filter((f) => f.inheritance === 'XL') : [];
}
