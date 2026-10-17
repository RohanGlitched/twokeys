// Reruns chosen cases through the explainer and prints every draft the checks rejected, with the failed checks.
// Usage: npm run debug:ask -- v4-003 v4-009 ...  (or --fallbacks to take every fallback from data/eval-ask.json)
import { readFileSync } from 'node:fs';
import { ask, type AskInput } from '../src/lib/ask';

const XL = new Set(['G6PD', 'DMD', 'F8', 'F9', 'OTC', 'ABCD1', 'FMR1', 'GLA']);
type Case = { id: string; lang: 'en' | 'ar'; q: string; genes: string[]; xl?: string[]; strengths?: Record<string, number>; related: boolean; sex?: 'F' | 'M'; history?: { role: 'user' | 'assistant'; text: string }[] };
const file = process.env.HELDOUT ?? 'eval/heldout-v4.json';
const raw = JSON.parse(readFileSync(file, 'utf8'));
const cases: Case[] = [...(Array.isArray(raw) ? raw : raw.cases), ...JSON.parse(readFileSync('eval/questions.json', 'utf8')).cases];
const args = process.argv.slice(2);
const ids = args.includes('--fallbacks')
  ? (JSON.parse(readFileSync('data/eval-ask.json', 'utf8')).results as { id: string; twokeys: { route: string } }[]).filter((r) => r.twokeys.route === 'fallback').map((r) => r.id)
  : args;
const inputOf = (c: Case): AskInput => ({ lang: c.lang, level: 'standard', sex: c.sex, genes: c.genes.filter((g) => !XL.has(g)), xl: [...(c.xl ?? []), ...c.genes.filter((g) => XL.has(g))], strengths: c.strengths, related: c.related, question: c.q, history: c.history ?? [] });

const tally: Record<string, number> = {};
for (const id of ids) {
  const c = cases.find((x) => x.id === id);
  if (!c) { console.log('missing', id); continue; }
  const out = await ask(inputOf(c), undefined, (answer, checks) => {
    const bad = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    bad.forEach((k) => (tally[k] = (tally[k] ?? 0) + 1));
    console.log(`  rejected [${bad.join(',')}]: ${answer.replace(/\s+/g, ' ').slice(0, 500)}`);
  });
  console.log(`== ${id} -> ${out.route} | ${c.q.slice(0, 120)}`);
  if (process.env.SHOW) console.log(`  answer: ${out.answer.replace(/\s+/g, ' ')}`);
}
console.log(tally);
