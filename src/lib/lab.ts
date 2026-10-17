// The lab's side of the protocol: it already holds each person's results, and for one pairing
// session it issues tokens only it can make. It never takes part in the comparison itself.
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

const enc = new TextEncoder();

function token(labKey: Uint8Array, session: string, tag: string, gene: string): string {
  const mac = hmac(sha256, labKey, enc.encode(`twokeys/v1|${session}|${tag}|${gene.toUpperCase()}`));
  return toHex(macToPoint(mac));
}

/**
 * Tokens for one person in one session.
 * - Autosomal recessive: role A gets r1 for severe and r2 for any finding; role B the reverse,
 *   so severe×any matches and mild×mild doesn't.
 * - X-linked: a woman's carrier finding matters for sons on its own, so it is hers alone (no token).
 *   Daughters are only at risk if she carries and he is affected (hemizygous); both then get an
 *   'x' token, which is the only way an X-linked gene can match.
 */
export function sessionTokens(labKey: Uint8Array, session: string, role: Role, sex: Sex, findings: Finding[]): Token[] {
  if (!/^[0-9a-f]{32,64}$/.test(session)) throw new Error('Bad session id.');
  const out: Token[] = [];
  for (const f of findings) {
    const g = f.gene.toUpperCase();
    if (f.inheritance === 'AR') {
      const severeTag = role === 'A' ? 'r1' : 'r2';
      const anyTag = role === 'A' ? 'r2' : 'r1';
      if (f.severity === 'severe') out.push({ label: g, token: token(labKey, session, severeTag, g) });
      out.push({ label: g, token: token(labKey, session, anyTag, g) });
    } else {
      // XL: for a woman the finding is a heterozygous carrier state; for a man it means affected.
      out.push({ label: `X:${g}`, token: token(labKey, session, 'x', g) });
    }
  }
  if (out.length > SET_SIZE) throw new Error('Too many findings for one session.');
  return out;
}

/** What the lab hands a device for one session. The device pads to SET_SIZE when it starts the PSI. */
export function issue(labKey: Uint8Array, session: string, role: Role, sex: Sex, findings: Finding[]): Token[] {
  return sessionTokens(labKey, session, role, sex, findings);
}

/** Collapse matched labels to genes: severe×severe matches twice (r1 and r2). */
export function matchedGenes(labels: string[]): { ar: string[]; xl: string[] } {
  const ar = new Set<string>();
  const xl = new Set<string>();
  for (const l of labels) (l.startsWith('X:') ? xl.add(l.slice(2)) : ar.add(l));
  return { ar: [...ar].sort(), xl: [...xl].sort() };
}

