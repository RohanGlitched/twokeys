// Calibration: does a synthetic Emirati population built from published carrier frequencies and
// real family structures reproduce what UAE premarital screening actually found?
//   npx tsx scripts/calibrate.ts [couplesPerType]
// Writes data/calibration.json for the proof page.
import fs from 'node:fs';
import path from 'node:path';
import { Pedigree, rng, carries } from '../src/lib/sim';
import { F, type Relationship } from '../src/lib/risk';

const root = path.resolve(import.meta.dirname, '..');
const panel = JSON.parse(fs.readFileSync(path.join(root, 'data/panel.json'), 'utf8'));
const freqs = fs.existsSync(path.join(root, 'data/freqs.json')) ? JSON.parse(fs.readFileSync(path.join(root, 'data/freqs.json'), 'utf8')) : { genes: [] };
const gnomad = new Map<string, { carrierFreq: number; error?: string }>(freqs.genes.map((g: { gene: string; carrierFreq: number; error?: string }) => [g.gene, g]));

// Alpha-globin is left out: its deletions are invisible to exome data and mostly silent (−α3.7 at
// 0.28), and a 49% "any defect" rate is not a carrier frequency. So the fair target is Dubai's rate
// excluding alpha-thalassaemia; the all-inclusive rates are shown too, with the gap stated.
const EXCLUDE = new Set(['HBA1', 'HBA2']);

// CAH: the published Emirati exome rate counts non-classic and duplicated-haplotype alleles, which
// inflates classic CAH, so we derive the classic allele frequency from UAE newborn screening (classic
// CAH 1 in 9,030 births, 1995–2011). Births in a population with mean inbreeding F are affected at
//   I = q²(1 − F) + qF,
// so q = sqrt(I) (which assumes F = 0) overstates q, and the pedigree simulation then adds
// consanguinity a second time. We solve for q with F = 0.0222, the mean inbreeding coefficient of
// the UAE survey of 2,033 women (Al-Gazali et al. 1997), whose era matches the parents of the
// 1995–2011 newborns. The old F = 0 value is still run, and shown, for comparison.
const CAH_INCIDENCE = 1 / 9030;
const F_POP = 0.0222;
const F_SOURCE = 'Al-Gazali et al. 1997, UAE survey of 2,033 women: mean inbreeding coefficient 0.0222 (RESEARCH.md, flagged 30 years old)';
const qFromIncidence = (I: number, F: number) => (-F + Math.sqrt(F * F + 4 * (1 - F) * I)) / (2 * (1 - F));
const cfFromQ = (q: number) => 1 - (1 - q) ** 2;
type CahMode = 'inbreedingAdjusted' | 'naive' | 'allAlleles';

interface GeneRow { gene: string; cf: number; source: 'literature' | 'gnomAD' }
function buildRows(cah: CahMode, drop: Set<string> = new Set()) {
  const rows: GeneRow[] = [];
  const missing: string[] = [];
  for (const g of panel.genes as { gene: string; inheritance: string; literature_carrier_freq?: { value: number } }[]) {
    if (g.inheritance !== 'AR' || EXCLUDE.has(g.gene) || drop.has(g.gene)) continue;
    const lit = g.literature_carrier_freq?.value;
    const gn = gnomad.get(g.gene);
    if (g.gene === 'CYP21A2' && cah !== 'allAlleles') rows.push({ gene: g.gene, cf: cfFromQ(qFromIncidence(CAH_INCIDENCE, cah === 'naive' ? 0 : F_POP)), source: 'literature' });
    else if (lit && lit > 0) rows.push({ gene: g.gene, cf: lit, source: 'literature' });
    else if (gn && !gn.error && gn.carrierFreq > 0) rows.push({ gene: g.gene, cf: gn.carrierFreq, source: 'gnomAD' });
    else missing.push(g.gene);
  }
  return { rows, missing, qs: rows.map((r) => 1 - Math.sqrt(1 - r.cf)), names: rows.map((r) => r.gene) };
}
const base = buildRows('inbreedingAdjusted');
const { rows, missing, qs } = base;

// Marriage mix: Dubai 2025 found 28% of couples genetically related (Nature Medicine 2026); the split
// among related couples follows the UAE survey (Al-Gazali 1997): first cousins 26.2, double first
// cousins 3.5, other (taken as second cousins) 20.8 of 50.5.
const relatedShare = 0.28;
const MIX: [Relationship, number][] = [
  ['unrelated', 1 - relatedShare],
  ['first-cousins', relatedShare * (26.2 / 50.5)],
  ['double-first-cousins', relatedShare * (3.5 / 50.5)],
  ['second-cousins', relatedShare * (20.8 / 50.5)],
];

const N = Number(process.argv[2] ?? 60_000);
const N_SCENARIO = Math.round(N / 3);

function wilson(k: number, n: number): [number, number] {
  const z = 1.96, p = k / n, d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d, h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d;
  return [c - h, c + h];
}

/** Simulates n couples of each relationship over genes with allele frequencies `q`, weighted by the marriage mix. */
function simulate(q: number[], names: string[], n: number, seedBase: number) {
  const byType: Record<string, { couples: number; atRisk: number; rate: number; ci: [number, number] }> = {};
  const geneHits = new Map<string, number>();
  let mixed = 0;
  for (const [rel, w] of MIX) {
    const ped = new Pedigree(q, rng(seedBase + rel.length));
    let atRisk = 0;
    const hits = new Map<string, number>();
    for (let k = 0; k < n; k++) {
      const [a, b] = ped.couple(rel);
      let any = false;
      for (let i = 0; i < q.length; i++) {
        if (carries(a, i) && carries(b, i)) { any = true; hits.set(names[i], (hits.get(names[i]) ?? 0) + 1); }
      }
      if (any) atRisk++;
    }
    byType[rel] = { couples: n, atRisk, rate: atRisk / n, ci: wilson(atRisk, n) };
    mixed += w * (atRisk / n);
    for (const [g, h] of hits) geneHits.set(g, (geneHits.get(g) ?? 0) + w * (h / n));
  }
  return { byType, mixed, geneHits };
}

const t0 = Date.now();
const main = simulate(qs, rows.map((r) => r.gene), N, 1000);
const { byType, geneHits } = main;
const positiveTotalWeighted = main.mixed;
for (const [rel, v] of Object.entries(byType)) console.log(`${rel}: ${(100 * v.rate).toFixed(2)}% at risk`);
console.log(`main run (inbreeding-adjusted CAH) ${(100 * main.mixed).toFixed(2)}%, ${((Date.now() - t0) / 1000).toFixed(0)} s`);

const shareOf = (hits: Map<string, number>, gene: string) => (hits.get(gene) ?? 0) / [...hits.values()].reduce((x, y) => x + y, 0);
const rates = (bt: typeof byType) => Object.fromEntries(Object.entries(bt).map(([k, v]) => [k, { rate: v.rate, ci: v.ci }]));
/** Re-runs the main simulation with a different CAH rule and/or genes left out; same seeds, same mix. */
function variant(cah: CahMode, drop: string[] = []) {
  const b = buildRows(cah, new Set(drop));
  const r = simulate(b.qs, b.names, N, 1000);
  console.log(`variant ${cah}${drop.length ? ` without ${drop.join(',')}` : ''}: ${(100 * r.mixed).toFixed(2)}% (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  return { mixed: r.mixed, byType: rates(r.byType), cyp21a2Share: shareOf(r.geneHits, 'CYP21A2'), genesModelled: b.rows.length };
}
const naive = variant('naive');
const allAlleles = variant('allAlleles');
const noHbb = variant('inbreedingAdjusted', ['HBB']);
const noHbbAllAlleles = variant('allAlleles', ['HBB']);

// Sensitivity: Abu Dhabi screens 570 genes and this demo models about 128. The other genes are each
// rare, but their carrier frequencies add up, and for related couples rare genes matter most. We don't
// have per-gene Emirati data for them, so these are scenarios, not estimates: every unmodelled gene is
// given the same carrier frequency, at three plausible levels.
const TAIL_GENES = 570 - rows.length;
const scenarios = [0.001, 0.002, 0.003].map((cf) => {
  const qt = 1 - Math.sqrt(1 - cf);
  const q2 = [...qs, ...Array(TAIL_GENES).fill(qt)];
  const names2 = [...rows.map((r) => r.gene), ...Array.from({ length: TAIL_GENES }, (_, i) => `tail${i}`)];
  const r = simulate(q2, names2, N_SCENARIO, 2000);
  const hbb = names2.indexOf('HBB');
  const r2 = simulate(q2.filter((_, i) => i !== hbb), names2.filter((_, i) => i !== hbb), N_SCENARIO, 2000);
  console.log(`tail ${TAIL_GENES} genes at carrier frequency ${cf}: ${(100 * r.mixed).toFixed(2)}% (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  return { tailGenes: TAIL_GENES, tailCarrierFreq: cf, cumulativeTailCarrierFreq: TAIL_GENES * cf, couplesPerType: N_SCENARIO, mixed: r.mixed, mixedWithoutHbb: r2.mixed, byType: Object.fromEntries(Object.entries(r.byType).map(([k, v]) => [k, v.rate])) };
});

const totalGeneWeight = [...geneHits.values()].reduce((a, b) => a + b, 0);
const geneShare = [...geneHits.entries()].map(([gene, v]) => ({ gene, shareOfMatches: v / totalGeneWeight })).sort((a, b) => b.shareOfMatches - a.shareOfMatches);
const observedM42: Record<string, number> = { CYP21A2: 0.14, MEFV: 0.12, USH2A: 0.11, ABCA4: 0.09, CFTR: 0.05, EYS: 0.04, CYP1B1: 0.04 };

const meanFOfMix = MIX.reduce((acc, [rel, w]) => acc + w * F[rel], 0);
const qNaive = qFromIncidence(CAH_INCIDENCE, 0), qAdj = qFromIncidence(CAH_INCIDENCE, F_POP);
const ab = { value: 565 / 11748, ci: wilson(565, 11748) };
const targets = [
  { label: 'Dubai, 1,000 couples, 782 genes: at-risk couples excluding alpha-thalassaemia (58 of 1,000)', value: 0.058, ci: [0.045, 0.074], source: 'Alblooshi et al., Nature Medicine 2026', compareWith: 'mixedPopulationAtRisk', note: 'Includes haemoglobin genes (11 beta-thalassaemia or sickle couples), excludes alpha-thalassaemia, as the model does. 782 genes against our 128, so the model should sit below it.' },
  { label: 'Dubai, all at-risk couples including alpha-thalassaemia (79 of 1,000)', value: 0.079, ci: [0.064, 0.097], source: 'Alblooshi et al., Nature Medicine 2026', compareWith: null, note: 'Not comparable: the model leaves out alpha-globin.' },
  { label: 'Abu Dhabi programme, 11,748 couples tested 2022 to July 2026, 570 genes: couples with an increased chance (565; the programme’s word is “incompatible”)', value: ab.value, ci: ab.ci, source: 'DoH, reported by Gulf News, 3 Oct 2026', compareWith: 'withoutHbb.mixedPopulationAtRisk', note: 'Whether this count includes haemoglobin pairs is not published. Haemoglobin disorders are also found by the premarital blood count and HPLC, so we compare it with the model run without HBB, and show the run with HBB too. The same article lists thalassaemia and sickle cell among the frequent conditions, so it may include them.' },
  { label: 'Abu Dhabi, 1,118 couples, 570 genes, WGS: positive couples', value: 0.11, source: 'M42 and DoH poster', compareWith: 'mixedPopulationAtRisk', note: 'Definition of positive not published; 570 genes against our 128.' },
  { label: 'Abu Dhabi, expected under random mating (their simulation)', value: 0.085, source: 'M42 and DoH poster', compareWith: 'byType.unrelated', note: 'Their 570-gene random-mating figure; our unrelated-couple rate covers 128 genes.' },
];

const out = {
  built: new Date().toISOString(),
  couplesPerType: N,
  genesModelled: rows.length,
  genesFromLiterature: rows.filter((r) => r.source === 'literature').length,
  genesFromGnomad: rows.filter((r) => r.source === 'gnomAD').length,
  genesWithoutData: missing,
  excluded: [...EXCLUDE],
  mix: Object.fromEntries(MIX),
  meanInbreedingOfMix: meanFOfMix,
  byType,
  /** Main result: inbreeding-adjusted classic CAH, HBB included. */
  mixedPopulationAtRisk: positiveTotalWeighted,
  /** Same run without HBB (haemoglobin pairs are also found by the premarital blood test). */
  withoutHbb: {
    mixedPopulationAtRisk: noHbb.mixed,
    byType: noHbb.byType,
    allCyp21a2AllelesMixed: noHbbAllAlleles.mixed,
    note: 'Same seeds and mix, HBB removed. Compare with Abu Dhabi’s 4.8% if that count leaves out haemoglobin pairs (not published).',
  },
  cyp21a2InbreedingAdjusted: {
    incidence: CAH_INCIDENCE,
    incidenceSource: 'UAE newborn screening 1995–2011: classic CAH 1 in 9,030',
    F: F_POP,
    fSource: F_SOURCE,
    formula: 'I = q²(1 − F) + qF, solved for q',
    qNaive, carrierFreqNaive: cfFromQ(qNaive),
    qAdjusted: qAdj, carrierFreqAdjusted: cfFromQ(qAdj),
    qAtOtherF: [0, meanFOfMix, F_POP, 0.03].map((f) => ({ F: f, q: qFromIncidence(CAH_INCIDENCE, f), carrierFreq: cfFromQ(qFromIncidence(CAH_INCIDENCE, f)) })),
    mixedPopulationAtRiskNaive: naive.mixed,
    byTypeNaive: naive.byType,
    cyp21a2ShareAdjusted: shareOf(geneHits, 'CYP21A2'),
    cyp21a2ShareNaive: naive.cyp21a2Share,
    note: 'q = sqrt(1/9,030) assumed no inbreeding among the parents of screened newborns; the simulation then added consanguinity again. Solving with F lowers q about 2.5-fold. The naive run is kept for comparison.',
  },
  sensitivity570: scenarios,
  targets,
  geneShare: geneShare.slice(0, 15).map((g) => ({ ...g, observedM42: observedM42[g.gene] ?? null })),
  /** Longer list used to choose which genes get a full condition card. */
  geneShareTop40: geneShare.slice(0, 40).map((g) => ({ ...g, observedM42: observedM42[g.gene] ?? null })),
  allCyp21a2Alleles: {
    mixedPopulationAtRisk: allAlleles.mixed,
    cyp21a2Share: allAlleles.cyp21a2Share,
    note: 'Same run with the published Emirati CYP21A2 rate (all P/LP alleles, including non-classic), which programmes may report.',
  },
  limitations: [
    'Jain et al. 2025 exomes come from people referred for clinical testing, not a random population sample: referral enriches for pathogenic variants and for consanguineous families, so carrier rates taken from it may run high.',
    'The F used for CAH (0.0222) comes from a 1997 survey; the parents of the 1995–2011 newborns are the right generation for it, but it is 30 years old.',
    'gnomAD Middle Eastern exomes are small (~2,900 people) and pan-Middle-Eastern, not Emirati.',
    '128 of 570 programme genes are modelled; the sensitivity runs show how much the rest could add.',
  ],
  notes: [
    'Carrier frequencies: Emirati exomes (Jain et al. 2025) where published, otherwise gnomAD v4.1 Middle Eastern.',
    'CYP21A2 uses the classic-only allele frequency from UAE newborn screening (classic CAH 1 in 9,030), solved with mean inbreeding F = 0.0222, because the published exome rate includes non-classic and duplicated-haplotype alleles.',
    'Genes are treated as independent and every pathogenic allele as reportable; real reporting rules (mild alleles, variant classification) lower the rate.',
    'The marriage mix uses Dubai 2025 (28% related); Abu Dhabi’s mix is not published and may be higher.',
    'The 11% poster figure and the 4.8% programme figure come from the same programme with different definitions and periods; the poster’s definition of positive is not published.',
    'Every target is shown, including those the model misses.',
  ],
};
fs.writeFileSync(path.join(root, 'data/calibration.json'), JSON.stringify(out, null, 1));
console.log(`mixed population: ${(100 * positiveTotalWeighted).toFixed(2)}% at risk · ${rows.length} genes (${out.genesFromLiterature} literature, ${out.genesFromGnomad} gnomAD, ${missing.length} without data)`);
console.log('top genes:', geneShare.slice(0, 8).map((g) => `${g.gene} ${(100 * g.shareOfMatches).toFixed(1)}%`).join(', '));
