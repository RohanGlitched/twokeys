// Family letters, written and sealed on the sender's phone. A letter holds facts, not names:
// the gene, how the relative is related, and the chance that follows from it.
import { carrierFreq, oneIn, RELATIVE_SHARE } from './risk';
import { geneQ } from './genefreq';

export type Relation = 'sibling' | 'half-sibling' | 'aunt-uncle' | 'niece-nephew' | 'first-cousin' | 'parent' | 'child';
export const RELATIONS: Relation[] = ['sibling', 'parent', 'child', 'half-sibling', 'aunt-uncle', 'niece-nephew', 'first-cousin'];

export interface LetterBody { v: 1 | 2; gene: string; relation: Relation; chance: number | null; population: number | null; lang: 'en' | 'ar'; inheritance?: 'AR' | 'XL' }

/**
 * Classic CAH only: the published Emirati CYP21A2 carrier rate includes common non-classic alleles,
 * so the background rate uses UAE newborn screening instead (classic CAH 1 in 9,030 → carriers ≈ 2q).
 */
const BACKGROUND_OVERRIDE: Record<string, number> = { CYP21A2: 2 * Math.sqrt(1 / 9030) };

export function letterFor(gene: string, relation: Relation, lang: 'en' | 'ar', inheritance: 'AR' | 'XL' = 'AR'): LetterBody {
  // X-linked chances depend on which parent carries it and on the relative's sex: the letter explains
  // that and leaves the number to a genetic counsellor.
  if (inheritance === 'XL') return { v: 2, gene, relation, lang, inheritance, chance: null, population: null };
  const q = geneQ(gene);
  const r = RELATIVE_SHARE[relation];
  const pop = BACKGROUND_OVERRIDE[gene] ?? (q === null ? null : carrierFreq(q));
  return { v: 2, gene, relation, lang, inheritance, chance: pop === null ? r : r + (1 - r) * pop, population: pop };
}

export { oneIn };

/** A chance as "N in 100", so a relative's chance and the general population's share one denominator. */
export function per100(p: number, lang: 'en' | 'ar'): string {
  const n = Math.round(p * 100);
  const fmt = new Intl.NumberFormat(lang === 'ar' ? 'ar-AE' : 'en-GB');
  if (n < 1) return lang === 'ar' ? 'أقل من 1 من كل 100' : 'fewer than 1 in 100';
  return lang === 'ar' ? `نحو ${fmt.format(n)} من كل 100` : `about ${fmt.format(n)} in 100`;
}

const enc = new TextEncoder();
const dec = new TextDecoder();
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

export async function sealLetter(body: LetterBody): Promise<{ c: string; key: string }> {
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const k = await crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, k, enc.encode(JSON.stringify(body))));
  const out = new Uint8Array(12 + ct.length); out.set(iv); out.set(ct, 12);
  return { c: b64u(out), key: b64u(raw) };
}

export async function openLetter(c: string, key: string): Promise<LetterBody> {
  const raw = unb64u(c);
  const k = await crypto.subtle.importKey('raw', unb64u(key), 'AES-GCM', false, ['decrypt']);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, k, raw.slice(12));
  return JSON.parse(dec.decode(pt)) as LetterBody;
}
