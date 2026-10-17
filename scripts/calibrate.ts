// Calibration: does a synthetic Emirati population built from published carrier frequencies and
// real family structures reproduce what UAE premarital screening actually found?
//   npx tsx scripts/calibrate.ts [couplesPerType]
// Writes data/calibration.json for the proof page.
import fs from 'node:fs';
import path from 'node:path';
import { Pedigree, rng, carries } from '../src/lib/sim';
import type { Relationship } from '../src/lib/risk';

const root = path.resolve(import.meta.dirname, '..');
const panel = JSON.parse(fs.readFileSync(path.join(root, 'data/panel.json'), 'utf8'));
const freqs = fs.existsSync(path.join(root, 'data/freqs.json')) ? JSON.parse(fs.readFileSync(path.join(root, 'data/freqs.json'), 'utf8')) : { genes: [] };
const gnomad = new Map<string, { carrierFreq: number; error?: string }>(freqs.genes.map((g: { gene: string; carrierFreq: number; error?: string }) => [g.gene, g]));

// Alpha-globin deletions are invisible to exome data and mostly silent (−α3.7); they are modelled
// separately rather than pretending a 49% "any genotype" rate is a carrier frequency.
const EXCLUDE = new Set(['HBA1', 'HBA2']);

interface GeneRow { gene: string; cf: number; source: 'literature' | 'gnomAD' }
const rows: GeneRow[] = [];
const missing: string[] = [];
for (const g of panel.genes as { gene: string; inheritance: string; literature_carrier_freq?: { value: number } }[]) {
  if (g.inheritance !== 'AR' || EXCLUDE.has(g.gene)) continue;
  const lit = g.literature_carrier_freq?.value;
  const gn = gnomad.get(g.gene);
  if (lit && lit > 0) rows.push({ gene: g.gene, cf: lit, source: 'literature' });
  else if (gn && !gn.error && gn.carrierFreq > 0) rows.push({ gene: g.gene, cf: gn.carrierFreq, source: 'gnomAD' });
  else missing.push(g.gene);
}
const qs = rows.map((r) => 1 - Math.sqrt(1 - r.cf));

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
const byType: Record<string, { couples: number; atRisk: number; rate: number; ci: [number, number] }> = {};
const geneHits = new Map<string, number>();
let positiveTotalWeighted = 0;

function wilson(k: number, n: number): [number, number] {
  const z = 1.96, p = k / n, d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d, h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d;
  return [c - h, c + h];
}

const t0 = Date.now();
for (const [rel, w] of MIX) {
  const ped = new Pedigree(qs, rng(1000 + rel.length));
  let atRisk = 0;
  const hits = new Map<string, number>();
  for (let k = 0; k < N; k++) {
    const [a, b] = ped.couple(rel);
    let any = false;
    for (let i = 0; i < qs.length; i++) {
      if (carries(a, i) && carries(b, i)) { any = true; hits.set(rows[i].gene, (hits.get(rows[i].gene) ?? 0) + 1); }
    }
    if (any) atRisk++;
  }
  byType[rel] = { couples: N, atRisk, rate: atRisk / N, ci: wilson(atRisk, N) };
  positiveTotalWeighted += w * (atRisk / N);
  for (const [g, h] of hits) geneHits.set(g, (geneHits.get(g) ?? 0) + w * (h / N));
  process.stdout.write(`${rel}: ${(100 * atRisk / N).toFixed(2)}% at risk (${((Date.now() - t0) / 1000).toFixed(0)} s)\n`);
}

const totalGeneWeight = [...geneHits.values()].reduce((a, b) => a + b, 0);
const geneShare = [...geneHits.entries()].map(([gene, v]) => ({ gene, shareOfMatches: v / totalGeneWeight })).sort((a, b) => b.shareOfMatches - a.shareOfMatches);
const observedM42: Record<string, number> = { CYP21A2: 0.14, MEFV: 0.12, USH2A: 0.11, ABCA4: 0.09, CFTR: 0.05, EYS: 0.04, CYP1B1: 0.04 };

const out = {
  built: new Date().toISOString(),
  couplesPerType: N,
  genesModelled: rows.length,
  genesFromLiterature: rows.filter((r) => r.source === 'literature').length,
  genesFromGnomad: rows.filter((r) => r.source === 'gnomAD').length,
  genesWithoutData: missing,
  excluded: [...EXCLUDE],
  mix: Object.fromEntries(MIX),
  byType,
  mixedPopulationAtRisk: positiveTotalWeighted,
  targets: [
    { label: 'Dubai, 1,000 couples, 782 genes: at-risk couples excluding alpha-thalassaemia (58 of 1,000)', value: 0.058, ci: [0.045, 0.074], source: 'Alblooshi et al., Nature Medicine 2026' },
    { label: 'Dubai, all at-risk couples including alpha-thalassaemia (79 of 1,000)', value: 0.079, ci: [0.064, 0.097], source: 'Alblooshi et al., Nature Medicine 2026' },
    { label: 'Abu Dhabi, 1,118 couples, 570 genes, WGS: positive couples', value: 0.11, source: 'M42 and DoH poster' },
    { label: 'Abu Dhabi, expected under random mating (their simulation)', value: 0.085, source: 'M42 and DoH poster' },
  ],
  geneShare: geneShare.slice(0, 15).map((g) => ({ ...g, observedM42: observedM42[g.gene] ?? null })),
  notes: [
    'Carrier frequencies: Emirati exomes (Jain et al. 2025) where published, otherwise gnomAD v4.1 Middle Eastern.',
    'CYP21A2 frequency includes non-classic and duplicated-haplotype alleles, so it is an overestimate for classic CAH.',
    'Genes are treated as independent and every pathogenic allele as reportable; real reporting rules (mild alleles, variant classification) lower the rate.',
  ],
};
fs.writeFileSync(path.join(root, 'data/calibration.json'), JSON.stringify(out, null, 1));
console.log(`mixed population: ${(100 * positiveTotalWeighted).toFixed(2)}% at risk · ${rows.length} genes (${out.genesFromLiterature} literature, ${out.genesFromGnomad} gnomAD, ${missing.length} without data)`);
console.log('top genes:', geneShare.slice(0, 8).map((g) => `${g.gene} ${(100 * g.shareOfMatches).toFixed(1)}%`).join(', '));
