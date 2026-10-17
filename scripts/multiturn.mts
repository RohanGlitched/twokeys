// Follow-up questions in one conversation: every turn should get a checked answer (judge round 5 found follow-ups refused).
//   npx tsx --conditions=react-server --env-file=.env.scripts.local scripts/multiturn.mts
import { ask, type AskInput } from '../src/lib/ask';
const qs = ['What is CAH?', 'What does being a carrier mean?', 'Can we still have healthy children?', 'Should my sister get tested?', 'What happens next after this result?', 'Do we have to tell our families?', 'How much does IVF with embryo testing cost?'];
const history: AskInput['history'] = [];
const routes: string[] = [];
for (const q of qs) {
  const out = await ask({ lang: 'en', level: 'standard', genes: ['CYP21A2'], xl: [], related: true, sex: 'F', question: q, history: [...history] });
  routes.push(out.route);
  console.log(`${out.route.padEnd(8)} ${q} -> ${out.answer.replace(/\s+/g, ' ').slice(0, 160)}`);
  history.push({ role: 'user', text: q }, { role: 'assistant', text: out.answer });
}
console.log(routes.join(' '));
