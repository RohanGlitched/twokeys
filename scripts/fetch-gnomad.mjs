// Build-time data pipeline: for every panel gene, read gnomAD v4.1 (CC0) and keep the ClinVar
// pathogenic / likely-pathogenic variants with their allele frequency in the Middle Eastern
// group ("mid"). Writes data/freqs.json. Cached per gene in data/cache/gnomad/, so re-runs resume.
//   node scripts/fetch-gnomad.mjs [GENE ...]
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), '..');
const cacheDir = path.join(root, 'data', 'cache', 'gnomad');
fs.mkdirSync(cacheDir, { recursive: true });
const panel = JSON.parse(fs.readFileSync(path.join(root, 'data', 'panel.json'), 'utf8'));
const only = process.argv.slice(2).map((g) => g.toUpperCase());
const genes = panel.genes.filter((g) => !only.length || only.includes(g.gene.toUpperCase()));

const API = 'https://gnomad.broadinstitute.org/api';
const QUERY = `query($g:String!){ gene(gene_symbol:$g, reference_genome:GRCh38){ gene_id symbol chrom
  clinvar_variants{ variant_id clinical_significance gold_stars review_status hgvsc hgvsp major_consequence }
  variants(dataset:gnomad_r4){ variant_id hgvsc hgvsp consequence
    exome{ ac an populations{ id ac an } } genome{ ac an populations{ id ac an } } } } }`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchGene(symbol) {
  const file = path.join(cacheDir, `${symbol}.json`);
  if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  for (let attempt = 1; attempt <= 5; attempt++) {
    const res = await fetch(API, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': 'twokeys-build (research prototype)' },
      body: JSON.stringify({ query: QUERY, variables: { g: symbol } }),
    });
    if (res.status === 429 || res.status >= 500) { await sleep(15000 * attempt); continue; }
    const json = await res.json();
    if (json.errors?.length) {
      const msg = json.errors.map((e) => e.message).join('; ');
      if (/rate|limit|cost/i.test(msg)) { await sleep(20000 * attempt); continue; }
      fs.writeFileSync(file, JSON.stringify({ error: msg }));
      return { error: msg };
    }
    fs.writeFileSync(file, JSON.stringify(json.data));
    await sleep(4000);
    return json.data;
  }
  return { error: 'gave up after retries' };
}

const isPLP = (sig) => /pathogenic/i.test(sig) && !/conflicting/i.test(sig) && !/benign/i.test(sig);

function summarise(meta, data) {
  if (data.error || !data.gene) return { gene: meta.gene, error: data.error ?? 'not found' };
  const clin = new Map();
  for (const c of data.gene.clinvar_variants ?? []) if (isPLP(c.clinical_significance) && c.gold_stars >= 1) clin.set(c.variant_id, c);
  const rows = [];
  let q = 0;
  for (const v of data.gene.variants ?? []) {
    const c = clin.get(v.variant_id);
    if (!c) continue;
    let ac = 0, an = 0;
    for (const part of [v.exome, v.genome]) {
      const p = part?.populations?.find((x) => x.id === 'mid');
      if (p) { ac += p.ac; an += p.an; }
    }
    if (!an || !ac) continue;
    const af = ac / an;
    q += af;
    rows.push({ id: v.variant_id, hgvsp: v.hgvsp || c.hgvsp || null, hgvsc: v.hgvsc || c.hgvsc || null, ac, an, af, sig: c.clinical_significance, stars: c.gold_stars });
  }
  rows.sort((a, b) => b.af - a.af);
  const inh = meta.inheritance;
  return {
    gene: meta.gene,
    inheritance: inh,
    plpWithMidCounts: rows.length,
    clinvarPLP: clin.size,
    q, // summed pathogenic allele frequency in gnomAD 'mid'
    carrierFreq: inh === 'XL' ? 2 * q : 1 - (1 - q) ** 2,
    top: rows.slice(0, 12),
  };
}

const out = [];
let n = 0;
for (const g of genes) {
  n++;
  const data = await fetchGene(g.gene);
  const s = summarise(g, data);
  out.push(s);
  process.stdout.write(`${n}/${genes.length} ${g.gene} ${s.error ? 'ERR ' + s.error : `q=${s.q.toExponential(2)} cf=1/${s.carrierFreq ? Math.round(1 / s.carrierFreq) : '∞'} (${s.plpWithMidCounts} variants)`}\n`);
}
const prev = fs.existsSync(path.join(root, 'data', 'freqs.json')) ? JSON.parse(fs.readFileSync(path.join(root, 'data', 'freqs.json'), 'utf8')) : { genes: [] };
const merged = new Map(prev.genes.map((x) => [x.gene, x]));
for (const s of out) merged.set(s.gene, s);
fs.writeFileSync(path.join(root, 'data', 'freqs.json'), JSON.stringify({
  source: 'gnomAD v4.1 (gnomad_r4), population "mid" (Middle Eastern), exome+genome; ClinVar P/LP with ≥1 star, non-conflicting. CC0; no re-identification.',
  built: new Date().toISOString(),
  genes: [...merged.values()].sort((a, b) => a.gene.localeCompare(b.gene)),
}, null, 1));
console.log('wrote data/freqs.json');
