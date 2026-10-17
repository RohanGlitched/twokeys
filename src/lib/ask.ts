// The explainer agent. It answers only from vetted facts and the couple's condition cards, never
// sees genotypes or tokens, and every answer passes code checks before a person sees it:
//   - numbers must come from the facts (no invented percentages),
//   - no directive language (Arabic or English),
//   - cited fact ids must exist.
// Questions about a partner's private results, crisis words and requests for decisions are caught
// before the model is called.
import 'server-only';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { CONDITIONS, type Level } from './conditions';
import { FACTS } from './knowledge';

export type Lang = 'en' | 'ar';
export interface AskInput { lang: Lang; level: Level; genes: string[]; xl: string[]; related: boolean; question: string; history?: { role: 'user' | 'assistant'; text: string }[] }
export interface AskOutput {
  answer: string;
  cites: string[];
  escalate: boolean;
  route: 'model' | 'guard' | 'fallback';
  checks: { numbersOk: boolean; nonDirective: boolean; citesOk: boolean };
  model?: string;
  ms: number;
}

// ---------------------------------------------------------------- guards (before the model)

const PARTNER_PROBE = [
  /\b(what|which|does|did|is)\b.*\b(my|his|her)\s+(partner|husband|wife|fianc[ée]e?|fiance)\b.*\b(carr(y|ies)|results?|genes?)\b/i,
  /\b(his|her)\s+(other\s+)?(genes?|results?)\b/i,
  /(ماذا|ما|هل).*(يحمل|تحمل|نتائج)\s*(شريكي|زوجي|زوجتي|خطيبي|خطيبتي)/,
  /(نتائج|جينات)\s*(شريكي|زوجي|زوجتي|خطيبي|خطيبتي)/,
];
const DECIDE_FOR_ME = [
  /\b(should|must)\s+(we|i)\s+(marry|get married|cancel|break|not marry|have (a )?(baby|children)|abort|terminate)\b/i,
  /\b(is it|would it be)\s+(haram|halal|allowed|a sin)\b/i,
  /(هل\s+)?(يجب|ينبغي|علينا|عليّ|علي)\s+(أن\s+)?(نتزوج|نلغي|ننفصل|نجهض|ننجب)/,
  /(حرام|حلال|يجوز)/,
];
const CRISIS = [/\b(suicide|kill myself|end my life|self[- ]harm|hurt myself)\b/i, /(انتحار|أقتل نفسي|أنهي حياتي|إيذاء نفسي)/];

const T = {
  probe: {
    en: 'I can’t share anything about your partner beyond the genes you both carry. That privacy protects both of you. If you would like to talk it through together, a counsellor can meet you as a couple.',
    ar: 'لا يمكنني مشاركة أي شيء عن شريكك غير الجينات التي تحملانها معاً، فهذه الخصوصية تحميكما كليكما. وإن أردتما الحديث معاً، يمكن للمستشار أن يلتقيكما كزوجين.',
  },
  decide: {
    en: 'That decision belongs to you, and many couples in your situation choose differently. I can explain the options and what each involves. For religious questions, a scholar you trust can help; for the medical side, a counsellor can talk it through with you.',
    ar: 'هذا القرار لكما، ويختار كثير من الأزواج في وضعكما خيارات مختلفة. يمكنني شرح الخيارات وما يتضمنه كل منها. وللأسئلة الشرعية يمكن لعالِم تثقان به أن يساعد، وللجانب الطبي يمكن للمستشار مناقشة الأمر معكما.',
  },
  crisis: {
    en: 'I’m sorry you’re feeling this way. Please talk to someone now: in the UAE you can call the National Programme for Happiness and Wellbeing support line on 800 4673 (800 HOPE), or 999 in an emergency. I have also asked a counsellor to contact you.',
    ar: 'يؤسفني أنك تشعر بهذا. أرجو أن تتحدث مع أحد الآن: في الإمارات يمكنك الاتصال بخط الدعم 800 4673 (800 HOPE)، أو 999 في حالات الطوارئ. وقد طلبت من مستشار التواصل معك.',
  },
};

// ---------------------------------------------------------------- checks (after the model)

const DIRECTIVE = [
  /\byou (should|must|need to|have to|ought to)\s+(not\s+)?(marry|cancel|break|have|terminate|abort|do ivf|choose)\b/i,
  /\b(i|we) (recommend|advise) (that )?you\b/i,
  /\b(don'?t|do not) (marry|get married|have children)\b/i,
  /(يجب عليكما|يجب عليك|ننصحكم|ننصحكما|أنصحك|لا تتزوجا|لا تتزوج|عليكما أن|ينبغي عليكما)/,
];

function numbersIn(s: string): string[] {
  const ascii = s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  return (ascii.match(/\d+(?:\.\d+)?/g) ?? []).filter((n) => !/^(9497|9380|2021|2023|2025|2026|2019|2002|2006|49)$/.test(n));
}

export function allowedNumbers(genes: string[]): Set<string> {
  const pool = [...FACTS.flatMap((f) => [f.en, f.source]), ...genes.flatMap((g) => {
    const c = CONDITIONS[g];
    return c ? [c.name.en, c.care.en, c.what.simple.en, c.what.standard.en, c.what.detailed.en] : [];
  }), T.crisis.en, '1 2 3 4'];
  return new Set(pool.flatMap(numbersIn));
}

export function checkAnswer(answer: string, cites: string[], genes: string[]) {
  const allowed = allowedNumbers(genes);
  const numbersOk = numbersIn(answer).every((n) => allowed.has(n));
  const nonDirective = !DIRECTIVE.some((r) => r.test(answer));
  const ids = new Set([...FACTS.map((f) => f.id), ...genes.map((g) => `cond:${g}`)]);
  const citesOk = cites.length > 0 && cites.every((c) => ids.has(c));
  return { numbersOk, nonDirective, citesOk };
}

// ---------------------------------------------------------------- the model

function knowledge(input: AskInput): string {
  const lines = FACTS.map((f) => `[${f.id}] ${f.en}`);
  for (const g of [...input.genes, ...input.xl]) {
    const c = CONDITIONS[g];
    if (!c) continue;
    lines.push(`[cond:${g}] ${c.name.en} (Arabic: ${c.name.ar}). Simple: ${c.what.simple.en} Standard: ${c.what.standard.en} Detailed: ${c.what.detailed.en} Care today: ${c.care.en}`);
  }
  return lines.join('\n');
}

function system(input: AskInput): string {
  const shared = input.genes.length || input.xl.length
    ? `The couple both carry: ${[...input.genes, ...input.xl.map((g) => `${g} (X-linked)`)].join(', ')}.`
    : 'The couple do not share a carried gene on the panel.';
  return [
    'You explain a couple’s genetic carrier result in a premarital screening app in Abu Dhabi. You are not a doctor and you do not give medical advice or make decisions.',
    shared,
    input.related ? 'The couple told the app they are related to each other.' : '',
    'Rules:',
    '1. Use ONLY the facts below. If the answer is not in them, say you don’t know and offer the counsellor.',
    '2. Never tell the couple what to do. Present options neutrally, with equal weight. Never say "should", "must", "recommend" or the Arabic equivalents about their choices.',
    '3. Never discuss anything about either partner beyond the shared genes.',
    '4. Do not give religious rulings; say a scholar they trust can help. Do not discuss termination details; say a counsellor can explain what UAE law allows.',
    '5. Every number you write must appear in the facts. Prefer "1 in 4" style over percentages.',
    `6. Answer in ${input.lang === 'ar' ? 'Modern Standard Arabic, clear and warm' : 'plain English'}, at a ${input.level} reading level, in at most 110 words. Use "a couple with an increased chance", never "incompatible".`,
    '7. Reply as JSON only: {"answer": string, "cites": [fact ids you used, e.g. "ar-odds", "cond:HBB"], "escalate": boolean (true if a counsellor should follow up)}.',
    '',
    'FACTS:',
    knowledge(input),
  ].filter(Boolean).join('\n');
}

let client: BedrockRuntimeClient | null = null;
const bedrock = () => (client ??= new BedrockRuntimeClient({ region: process.env.AWS_REGION ?? 'ap-southeast-2' }));
export const ASK_MODEL = () => process.env.ASK_MODEL ?? 'apac.amazon.nova-pro-v1:0';

async function callModel(input: AskInput, model: string, extra?: string): Promise<{ answer: string; cites: string[]; escalate: boolean }> {
  const history = (input.history ?? []).slice(-6).map((h) => ({ role: h.role, content: [{ text: h.text.slice(0, 800) }] }));
  const res = await bedrock().send(new ConverseCommand({
    modelId: model,
    system: [{ text: system(input) + (extra ? `\n\nYour previous draft broke a rule: ${extra} Rewrite it.` : '') }],
    messages: [...history, { role: 'user', content: [{ text: input.question.slice(0, 600) }] }],
    inferenceConfig: { maxTokens: 500, temperature: 0.2 },
  }));
  const text = res.output?.message?.content?.map((c) => c.text ?? '').join('') ?? '';
  const json = text.match(/\{[\s\S]*\}/)?.[0] ?? '{}';
  const parsed = JSON.parse(json) as { answer?: string; cites?: string[]; escalate?: boolean };
  return { answer: String(parsed.answer ?? '').trim(), cites: Array.isArray(parsed.cites) ? parsed.cites.map(String) : [], escalate: !!parsed.escalate };
}

function fallback(input: AskInput): { answer: string; cites: string[] } {
  const g = input.genes[0];
  const c = g ? CONDITIONS[g] : null;
  const odds = FACTS.find((f) => f.id === (g ? 'ar-odds' : 'negative'))!;
  return {
    answer: `${odds[input.lang]}${c ? ' ' + c.what[input.level][input.lang] : ''} ${FACTS.find((f) => f.id === 'counsellor')![input.lang]}`,
    cites: [g ? 'ar-odds' : 'negative', ...(c ? [`cond:${g}`] : []), 'counsellor'],
  };
}

export async function ask(input: AskInput, model = ASK_MODEL()): Promise<AskOutput> {
  const t0 = Date.now();
  const q = input.question;
  const guard = (key: keyof typeof T, escalate: boolean): AskOutput => ({
    answer: T[key][input.lang], cites: ['counsellor'], escalate, route: 'guard',
    checks: { numbersOk: true, nonDirective: true, citesOk: true }, ms: Date.now() - t0,
  });
  if (CRISIS.some((r) => r.test(q))) return guard('crisis', true);
  if (PARTNER_PROBE.some((r) => r.test(q))) return guard('probe', false);
  if (DECIDE_FOR_ME.some((r) => r.test(q))) return guard('decide', false);

  let draft: { answer: string; cites: string[]; escalate: boolean } | null = null;
  let problem: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      draft = await callModel(input, model, problem);
    } catch {
      draft = null;
      break;
    }
    const checks = checkAnswer(draft.answer, draft.cites, [...input.genes, ...input.xl]);
    if (draft.answer && checks.numbersOk && checks.nonDirective && checks.citesOk) {
      return { ...draft, route: 'model', checks, model, ms: Date.now() - t0 };
    }
    problem = [!checks.numbersOk && 'it used a number not in the facts.', !checks.nonDirective && 'it told the couple what to do.', !checks.citesOk && 'it did not cite valid fact ids.'].filter(Boolean).join(' ');
  }
  const fb = fallback(input);
  return { ...fb, escalate: draft?.escalate ?? false, route: 'fallback', checks: checkAnswer(fb.answer, fb.cites, input.genes), model, ms: Date.now() - t0 };
}
