// Carrier frequencies used for relatives' chances and the counsellor's estimates.
// Emirati published values where they exist; otherwise gnomAD v4.1 Middle Eastern ("mid").
export interface GeneFreq { carrier: number; source: string }

export const GENE_FREQ: Record<string, GeneFreq> = {
  CYP21A2: { carrier: 0.106, source: 'Jain et al., Genet Med Open 2025 (1,194 Emirati exomes); includes non-classic alleles' },
  HBB: { carrier: 0.096, source: 'Jain et al., Genet Med Open 2025 (1,194 Emirati exomes)' },
  MEFV: { carrier: 0.059, source: 'Jain et al., Genet Med Open 2025 (1,194 Emirati exomes)' },
  ABCA4: { carrier: 0.043, source: 'Jain et al., Genet Med Open 2025 (1,194 Emirati exomes)' },
  SMN1: { carrier: 0.013, source: 'Rabea et al., Commun Med 2024 (1,502 Emirati newborns)' },
  CYP1B1: { carrier: 0.017, source: 'gnomAD v4.1 mid, ClinVar P/LP (≈1 in 59)' },
};

/** Allele frequency q from a carrier frequency (autosomal): cf = 1 − (1 − q)². */
export const qFromCarrier = (cf: number) => 1 - Math.sqrt(1 - cf);
export const geneQ = (gene: string): number | null => {
  const f = GENE_FREQ[gene.toUpperCase()];
  return f ? qFromCarrier(f.carrier) : null;
};
