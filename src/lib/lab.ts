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
  /**
   * Alpha globin only (HBA1/HBA2): a non-deletional alpha-plus change (αT-Saudi, Hb Constant Spring), which
   * can cause HbH disease even with another alpha-plus change. 'severe' alone means α0 (--), 'mild' α+ (-α).
   * Each HBA finding is one chromosome: two findings of one class mean that class on both (see sessionTokens).
   */
  alpha?: 'nondeletional';
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
/**
 * Genes matched as one: HBA1 and HBA2 together make alpha globin, so a change in either matches a
 * change in the other.
 */
export const matchGene = (gene: string) => (/^HBA[12]$/i.test(gene) ? 'HBA' : gene.toUpperCase());
/**
 * Genes where only the exact pair of changes says how serious it is (HbS with HbC, HbD-Punjab or
 * beta-zero is serious even though HbC, HbD or HbE alone looks "mild"). Any shared change counts as a
 * full match until the lab's confirmatory test (HPLC) gives the pair.
 */
const PAIR_DECIDES = new Set(['HBB']);

/**
 * Alpha globin: each person has two alpha haplotypes, each αα (normal), α0 (--), α+ (-α) or αT (a
 * non-deletional α+ such as αT-Saudi or Hb Constant Spring). A child takes one from each parent, so the four
 * combinations are equally likely, and each person's pair sets the chance. The lab reads a person's pair
 * from their HBA findings: two findings of one class are that class on both chromosomes (-α/-α); a single
 * finding is that class with αα; with more than two, the two most serious are kept (the lab's confirmatory
 * test settles cis or trans, see the HBA card).
 *
 * Tokens: a person gets one token for every pair of genotypes that could meet, with their own genotype in
 * their own seat (A gets "mine|g" for each of the nine carrier genotypes g, B gets "g|mine"). Exactly one
 * token is common to both, the one naming their two real genotypes, and the lab grades from its label. So
 * whenever both carry any alpha change, exactly one alpha token matches: the match count says alpha globin
 * is shared and nothing about how many changes, classes or copies the partner has.
 * Disclosure: the graded result itself (kind and chance, which both partners receive) is computed from both
 * people's two copies, so read with your own result it can tell you part of your partner's. For example, if
 * you carry -α on one chromosome and the result is "trait, 1 in 2", your partner carries -α on both; a result
 * that names Hb Bart's says both of you carry α0. A correct chance needs that; the count adds nothing to it.
 */
type Hap = 'a0' | 'aT' | 'a+' | 'aa';
/** Most serious first; a genotype is written most serious haplotype first, e.g. 'a0/a+', 'a+/aa'. */
const RANK: Hap[] = ['a0', 'aT', 'a+', 'aa'];
const byRank = (p: Hap, q: Hap) => RANK.indexOf(p) - RANK.indexOf(q);
const alphaClass = (f: Finding): Hap => (f.severity === 'severe' ? 'a0' : f.alpha === 'nondeletional' ? 'aT' : 'a+');
/** The nine genotypes of anyone with at least one alpha change. */
const CARRIER_GENOTYPES = RANK.slice(0, 3).flatMap((x, i) => RANK.slice(i).map((y) => `${x}/${y}`));
function alphaGenotype(findings: Finding[]): string | null {
  const haps = findings.filter((f) => f.inheritance === 'AR' && matchGene(f.gene) === 'HBA').map(alphaClass).sort(byRank);
  return haps.length ? `${haps[0]}/${haps[1] ?? 'aa'}` : null;
}

export function sessionTokens(labKey: Uint8Array, session: string, role: Role, findings: Finding[]): LabelledToken[] {
  if (!/^[0-9a-f]{32,64}$/.test(session)) throw new Error('Bad session id.');
  const out: LabelledToken[] = [];
  const mine = alphaGenotype(findings);
  if (mine) for (const g of CARRIER_GENOTYPES) {
    const pair = role === 'A' ? `${mine}|${g}` : `${g}|${mine}`;
    out.push({ i: out.length, label: `HBA:${pair}`, token: token(labKey, session, `hg:${pair}`, 'HBA') });
  }
  for (const f of findings) {
    const g = matchGene(f.gene);
    if (g === 'HBA' && f.inheritance === 'AR') continue;
    if (f.inheritance === 'AR') {
      const severeTag = role === 'A' ? 'r1' : 'r2';
      const anyTag = role === 'A' ? 'r2' : 'r1';
      if (f.severity === 'severe' || PAIR_DECIDES.has(g)) out.push({ i: out.length, label: g, token: token(labKey, session, severeTag, g) });
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
 * What a phone receives: exactly SET_SIZE opaque tokens with no gene names. Real tokens are padded with
 * lab-made decoys that match nothing, and the whole list is put in a lab-keyed order, so a token's
 * position says nothing about which finding it stands for. Everything is derived from the lab key, the
 * session and the seat, so asking again returns the identical list: comparing two answers reveals
 * nothing, and the lab can rebuild the exact list later to check the phone's first lock. The routes pass
 * a per-session key (seats.ts sessionKey: the tokens subkey with a server nonce), not the root key.
 */
export function issue(labKey: Uint8Array, session: string, role: Role, findings: Finding[]): Token[] {
  const real = sessionTokens(labKey, session, role, findings).map(({ token }) => token);
  const all = [...real];
  for (let j = real.length; j < SET_SIZE; j++) all.push(token(labKey, session, `pad:${role}`, `${j}`));
  const key = (t: string) => toHex0(hmac(sha256, labKey, enc.encode(`twokeys/v2|order|${session}|${role}|${t}`)));
  return all.map((t) => ({ t, k: key(t) })).sort((x, y) => (x.k < y.k ? -1 : 1)).map(({ t }, i) => ({ i, token: t }));
}
const toHex0 = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');

/**
 * strength 2 = both carry a serious change; 1 = one of them carries a milder one; 0 = both milder (low concern).
 * kind, for the globin genes, names what the pair means:
 *   HBB: 'hplc' (a full match until the confirmatory test gives the exact pair);
 *   alpha globin, the most serious outcome any of the four haplotype combinations gives (α0 = --, α+ = -α,
 *   αT = non-deletional α+): 'bart' (α0 with α0: Hb Bart's hydrops possible), 'hbh-severe' (α0 with αT, e.g.
 *   --/αCSα: severe HbH disease, hydrops before birth possible), 'hbh' (α0 with α+, αT with αT, or αT with
 *   α+: HbH disease possible), 'trait' (α+ with α+ only: trait, not an illness). Bart's needs α0 from both.
 * chance, alpha globin only: the chance per pregnancy of that outcome, from both people's two copies:
 *   'quarter' (1 in 4), 'half' (1 in 2), 'three-quarters' (3 in 4: only αT/α+ with αT/α+) or 'all' (every
 *   child; -α/-α with -α/-α gives trait every time). Every other autosomal match is 1 in 4.
 */
export interface SharedGene {
  gene: string;
  inheritance: Inheritance;
  strength: 0 | 1 | 2;
  kind?: 'hplc' | 'bart' | 'hbh-severe' | 'hbh' | 'trait';
  chance?: 'quarter' | 'half' | 'three-quarters' | 'all';
}

type AlphaKind = 'bart' | 'hbh-severe' | 'hbh' | 'trait';
const WORST: AlphaKind[] = ['bart', 'hbh-severe', 'hbh', 'trait'];
/** What a child with one haplotype from each parent has, when it is more than a silent carrier state. */
function childKind(x: Hap, y: Hap): AlphaKind | null {
  if (x === 'aa' || y === 'aa') return null;
  const p = [x, y].sort(byRank).join('/');
  return p === 'a0/a0' ? 'bart' : p === 'a0/aT' ? 'hbh-severe' : p === 'a+/a+' ? 'trait' : 'hbh';
}
const CHANCE = { 1: 'quarter', 2: 'half', 3: 'three-quarters', 4: 'all' } as const;

/** Grades an alpha-globin match from the two genotypes in its label, e.g. 'a+/a+|a0/aa' (A's, then B's). */
function alphaGraded(pair: string): SharedGene {
  const [a, b] = pair.split('|').map((g) => g.split('/') as Hap[]);
  const kids = a.flatMap((x) => b.map((y) => childKind(x, y)));
  // Both carry at least one change, so at least one of the four combinations meets two changes.
  const kind = WORST.find((k) => kids.includes(k))!;
  const n = kids.filter((k) => k === kind).length as 1 | 2 | 3 | 4;
  return { gene: 'HBA', inheritance: 'AR', strength: kind === 'trait' ? 0 : 2, kind, chance: CHANCE[n] };
}

function graded(label: string, n: number): SharedGene {
  if (label.startsWith('X:')) return { gene: label.slice(2), inheritance: 'XL', strength: 2 };
  const strength = Math.min(2, n - 1) as 0 | 1 | 2;
  if (label === 'HBB') return { gene: label, inheritance: 'AR', strength: 2, kind: 'hplc' };
  return { gene: label, inheritance: 'AR', strength };
}

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
  // At most one alpha token matches (see sessionTokens), and its label names both genotypes.
  const alphaPair = [...counts.keys()].find((l) => l.startsWith('HBA:'))?.slice(4);
  const genes: SharedGene[] = [
    ...[...counts.entries()].filter(([label]) => !label.startsWith('HBA:')).map(([label, n]) => graded(label, n)),
    ...(alphaPair ? [alphaGraded(alphaPair)] : []),
  ].sort((x, y) => x.gene.localeCompare(y.gene));
  return { A: new Set(aIdx.map((t) => t.token)), B: new Set(bIdx.map((t) => t.token)), genes };
}

/**
 * Findings that matter for a person whatever their partner carries: X-linked results. For a woman,
 * her sons' chances; for a man, his own health and his daughters (who will all carry it).
 */
export function personalFindings(_sex: Sex, findings: Finding[]): Finding[] {
  return findings.filter((f) => f.inheritance === 'XL');
}
