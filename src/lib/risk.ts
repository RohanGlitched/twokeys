// The risk engine. Every number the product shows comes from here, never from a language model.
// Notation: q = summed pathogenic allele frequency of a gene; cf = carrier frequency ≈ 2q;
// F = inbreeding coefficient of the couple's child (= kinship coefficient φ of the couple).

export type Relationship =
  | 'unrelated'
  | 'second-cousins'
  | 'first-cousins-once-removed'
  | 'first-cousins'
  | 'double-first-cousins';

/** Inbreeding coefficient of a child of the couple. Standard pedigree values. */
export const F: Record<Relationship, number> = {
  unrelated: 0,
  'second-cousins': 1 / 64,
  'first-cousins-once-removed': 1 / 32,
  'first-cousins': 1 / 16,
  'double-first-cousins': 1 / 8,
};

export const RELATIONSHIPS = Object.keys(F) as Relationship[];

/** Carrier frequency of an autosomal gene from its pathogenic allele frequency. */
export const carrierFreq = (q: number) => 1 - (1 - q) ** 2;

/**
 * Chance a child of the couple is affected by one autosomal recessive gene, before anyone is tested:
 * P = q²(1 − F) + qF  (both alleles independent, or both identical by descent).
 */
export const childAffectedPrior = (q: number, rel: Relationship) => q * q * (1 - F[rel]) + q * F[rel];

/**
 * Chance the partner carries the same gene, given one person is a known carrier.
 * A relative shares a given allele identical by descent with probability 2φ (the coefficient of
 * relationship: 1/8 for first cousins); otherwise they carry at the population rate.
 */
export function partnerCarrierGiven(q: number, rel: Relationship): number {
  const r = 2 * F[rel];
  return r + (1 - r) * carrierFreq(q);
}

/** Bayes: chance someone is still a carrier after a negative test with detection rate d. */
export function residualAfterNegative(prior: number, detection: number): number {
  return (prior * (1 - detection)) / (1 - prior * detection);
}

export interface PregnancyOdds { affected: number; carrier: number; clear: number }

/** Both partners carry the same autosomal recessive gene. */
export const BOTH_CARRIERS: PregnancyOdds = { affected: 1 / 4, carrier: 1 / 2, clear: 1 / 4 };

/** X-linked, mother a carrier, father unaffected. Per son and per daughter. */
export const XL_CARRIER_MOTHER = { son: { affected: 1 / 2, clear: 1 / 2 }, daughter: { carrier: 1 / 2, clear: 1 / 2 } } as const;
/** X-linked, mother a carrier and father affected. Per son and per daughter. */
export const XL_CARRIER_MOTHER_AFFECTED_FATHER = { son: { affected: 1 / 2, clear: 1 / 2 }, daughter: { affected: 1 / 2, carrier: 1 / 2 } } as const;

/**
 * Chance per pregnancy of an affected child for one gene when ONE partner is a known carrier and
 * the other tested negative (residual risk): ¼ × P(partner still a carrier | negative test).
 */
export function oneCarrierResidual(q: number, rel: Relationship, detection: number): number {
  return 0.25 * residualAfterNegative(partnerCarrierGiven(q, rel), detection);
}

/** Chance a relative carries the same variant as a known carrier (identical by descent), plus background. */
export const RELATIVE_SHARE: Record<string, number> = {
  parent: 1 / 2,
  sibling: 1 / 2,
  child: 1 / 2,
  'half-sibling': 1 / 4,
  'aunt-uncle': 1 / 4,
  'niece-nephew': 1 / 4,
  grandparent: 1 / 4,
  'first-cousin': 1 / 8,
  'second-cousin': 1 / 32,
};

export function relativeCarrierChance(relation: keyof typeof RELATIVE_SHARE, q: number): number {
  const r = RELATIVE_SHARE[relation];
  return r + (1 - r) * carrierFreq(q);
}

/** "1 in N" with sensible rounding for people, never "1 in 0"; in Arabic "1 من N". */
export function oneIn(p: number, lang: 'en' | 'ar' = 'en'): string {
  const of = lang === 'ar' ? 'من' : 'in';
  const tiny = lang === 'ar' ? 'أقل من 1 من 1,000,000' : 'less than 1 in 1,000,000';
  if (!(p > 0)) return tiny;
  if (p >= 0.5) return `${Math.round(p * 100)} ${of} 100`;
  const n = 1 / p;
  const r = n < 20 ? Math.round(n) : n < 200 ? Math.round(n / 5) * 5 : n < 2000 ? Math.round(n / 50) * 50 : Math.round(n / 500) * 500;
  if (r > 1_000_000) return tiny;
  return `1 ${of} ${r.toLocaleString('en-US')}`;
}

/** Days left to day 120 after conception (about 19 weeks of pregnancy counted from the last period), from weeks at booking. */
export const daysTo120 = (weeks: number, bookedAt: number, now = Date.now()) => Math.round(120 - (weeks * 7 - 14) - (now - bookedAt) / 86_400_000);
/**
 * The conservative reading: day 120 counted from the last period (about week 17+1), two weeks earlier than
 * counting from conception. The desk shows both, labelled, until the counsellor confirms which applies.
 */
export const daysTo120Lmp = (weeks: number, bookedAt: number, now = Date.now()) => Math.round(120 - weeks * 7 - (now - bookedAt) / 86_400_000);
