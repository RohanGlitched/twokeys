// Reruns chosen cases through the explainer and prints every draft the checks rejected, with the failed checks.
// Usage: npm run debug:ask -- v4-003 v4-009 ...  (or --fallbacks to take every fallback from data/eval-ask.json)
import { readFileSync } from 'node:fs';
import { ask, type AskInput } from '../src/lib/ask';
import { parseAskBody } from '../src/lib/askinput';

type Case = { id: string; lang: 'en' | 'ar'; q: string; genes: string[]; xl?: string[]; strengths?: Record<string, number>; related: boolean; sex?: 'F' | 'M'; history?: { role: 'user' | 'assistant'; text: string }[] };
const file = process.env.HELDOUT ?? 'eval/heldout-v4.json';
const raw = JSON.parse(readFileSync(file, 'utf8'));
const cases: Case[] = [...(Array.isArray(raw) ? raw : raw.cases), ...JSON.parse(readFileSync('eval/questions.json', 'utf8')).cases];
const args = process.argv.slice(2);
// --must runs every case in eval/must-answer.json and reports how many got a model answer.
if (args[0] === '--must') { const m = JSON.parse(readFileSync('eval/must-answer.json', 'utf8')).cases as Case[]; cases.push(...m); args.splice(0, 1, ...m.map((c) => c.id)); }
// --q '{"lang":"en","genes":["HBB"],"q":"..."}' runs one ad-hoc case.
if (args[0] === '--q') { cases.push({ id: 'adhoc', related: false, xl: [], genes: [], lang: 'en', ...JSON.parse(args[1]) }); args.splice(0, 2, 'adhoc'); }
const ids = args.includes('--fallbacks')
  ? (JSON.parse(readFileSync('data/eval-ask.json', 'utf8')).results as { id: string; twokeys: { route: string } }[]).filter((r) => r.twokeys.route === 'fallback').map((r) => r.id)
  : args;
// Same parser as /api/ask and the evaluation.
const inputOf = (c: Case): AskInput => parseAskBody({ lang: c.lang, level: 'standard', sex: c.sex, genes: c.genes, xl: c.xl ?? [], strengths: c.strengths, related: c.related, question: c.q, history: c.history ?? [] }, () => true) as AskInput;

const tally: Record<string, number> = {};
const routes: Record<string, number> = {};
for (const id of ids) {
  const c = cases.find((x) => x.id === id);
  if (!c) { console.log('missing', id); continue; }
  const out = await ask(inputOf(c), undefined, (answer, checks) => {
    const bad = Object.entries(checks).filter(([, v]) => !v).map(([k]) => k);
    bad.forEach((k) => (tally[k] = (tally[k] ?? 0) + 1));
    console.log(`  rejected [${bad.join(',')}]: ${answer.replace(/\s+/g, ' ').slice(0, 500)}`);
  });
  routes[out.route] = (routes[out.route] ?? 0) + 1;
  console.log(`== ${id} -> ${out.route} | ${c.q.slice(0, 120)}`);
  if (process.env.SHOW) console.log(`  answer: ${out.answer.replace(/\s+/g, ' ')}`);
}
console.log(tally);
console.log('routes:', routes);
