// Family letters, written and sealed on the sender's phone. A letter holds facts, not names:
// the gene, how the relative is related, and the chance that follows from it.
import { carrierFreq, oneIn, RELATIVE_SHARE } from './risk';
import { geneQ } from './genefreq';

export type Relation = 'sibling' | 'half-sibling' | 'aunt-uncle' | 'niece-nephew' | 'first-cousin' | 'parent' | 'child';
export const RELATIONS: Relation[] = ['sibling', 'parent', 'child', 'half-sibling', 'aunt-uncle', 'niece-nephew', 'first-cousin'];

export interface LetterBody { v: 1 | 2; gene: string; relation: Relation; chance: number | null; population: number | null; lang: 'en' | 'ar'; inheritance?: 'AR' | 'XL' }

/**
 * The panel's genes and how each is inherited (from data/panel.json, version 2026-10-17; HBA is the
 * alpha-globin match the lab names). Small and client-safe, so a relative's phone can check a letter
 * without loading the panel.
 */
const PANEL_XL = 'ABCD1 AFF2 ARX DMD F8 F9 FMR1 GLA L1CAM MID1 NR0B1 OTC PLP1 RPGR RS1 SLC6A8 G6PD';
const PANEL_AR = 'ABCA3 ABCC8 ACADM ACADVL ACAT1 AGA AGXT AHI1 AIRE ALDOB ALPL ANO10 ARSA ASL ASPA ATP7B BBS1 BBS2 BCKDHB BLM BTD CBS CC2D2A CCDC88C CEP290 CFTR CHRNE CLCN1 CLRN1 '
  + 'CNGB3 COL7A1 CPT2 CYP11A1 CYP21A2 CYP27A1 CYP27B1 DHCR7 DHDDS DLD DYNC2H1 ELP1 ERCC2 EVC2 FAH FANCC FKRP FKTN FMO3 FXN G6PC1 GAA GALT GBA1 GBE1 GJB2 GNPTAB GRIP1 '
  + 'HBA HBA1 HBA2 HBB HEXA HPS1 HPS3 IDUA LRP2 MCCC2 MCOLN1 MCPH1 MLC1 MMACHC MMUT MVK NAGA NEB NPHS1 OCA2 PAH PCDH15 PKHD1 PMM2 POLG PRF1 RARS2 RNASEH2B SCO2 SLC19A3 '
  + 'SLC26A2 SLC26A4 SLC37A4 SMN1 SMPD1 TF TMEM216 TNXB TYR USH2A XPC CYP1B1 ABCA4 KCNV2 MEFV DNAH5 CCDC40 CCNO DNAH11 DONSON ALDH3A2 SGCG TPO F7 GALNT3 ABCA12 ITGB3 '
  + 'PKLR EYS RPGRIP1 CDH23 ABCC6 MPL NCF1 MERTK CNGA3 TMEM67 INPP5E LIFR GLB1 MAN2B1 ETFDH GCDH SLC26A3 CYP11B1 QDPR MYO7A RPE65 DOCK8 RAG1';
export const PANEL_INHERITANCE: Record<string, 'AR' | 'XL'> = Object.fromEntries([
  ...PANEL_AR.split(' ').map((g) => [g, 'AR'] as const), ...PANEL_XL.split(' ').map((g) => [g, 'XL'] as const),
]);

/** Letters made from this UTC day on carry an ack hash; only older ones accept acknowledgements without a token. */
export const ACK_REQUIRED_FROM = Date.UTC(2026, 9, 18);

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

/**
 * What a relative's phone shows: the letter rebuilt from its facts, never its own numbers. A sealed body
 * is accepted only if it is version 2, names a panel gene with the panel's inheritance, a known relation
 * and language; the chance and background rate are then recomputed with letterFor. Anything else
 * (an old, broken or forged note) returns null, and the page says the note could not be checked.
 */
export function checkLetter(body: unknown): LetterBody | null {
  if (!body || typeof body !== 'object') return null;
  const b = body as Partial<LetterBody>;
  if (b.v !== 2 || typeof b.gene !== 'string' || !(b.lang === 'en' || b.lang === 'ar')) return null;
  if (!RELATIONS.includes(b.relation as Relation)) return null;
  const gene = b.gene.toUpperCase();
  const inh = PANEL_INHERITANCE[gene];
  if (!inh || (b.inheritance ?? 'AR') !== inh) return null;
  return letterFor(gene, b.relation as Relation, b.lang, inh);
}

export { oneIn };

/**
 * A chance as people say it, "about 1 in 8", rounded to a number that reads easily; the same rounding as
 * the sender's preview on the phone, so the sender and the relative see the same words.
 */
export function naturalFrequency(p: number, lang: 'en' | 'ar'): string {
  const fmt = new Intl.NumberFormat(lang === 'ar' ? 'ar-AE' : 'en-GB');
  const n = 1 / p;
  if (n > 1000) return lang === 'ar' ? 'أقل من 1 من كل 1,000' : 'fewer than 1 in 1,000';
  const r = n < 2.5 ? 2 : n < 20 ? Math.round(n) : n < 100 ? Math.round(n / 5) * 5 : Math.round(n / 50) * 50;
  return lang === 'ar' ? `نحو 1 من كل ${fmt.format(r)}` : `about 1 in ${fmt.format(r)}`;
}

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

/** Opens a sealed letter; the result is untrusted until checkLetter has rebuilt it. */
export async function openLetter(c: string, key: string): Promise<unknown> {
  const raw = unb64u(c);
  const k = await crypto.subtle.importKey('raw', unb64u(key), 'AES-GCM', false, ['decrypt']);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: raw.slice(0, 12) }, k, raw.slice(12));
  return JSON.parse(dec.decode(pt)) as unknown;
}
