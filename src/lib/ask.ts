// The explainer agent. It answers only from vetted facts and the couple's condition cards, never
// sees genotypes or tokens, and every answer passes code checks before a person sees it.
// Layers:
//   1. Keyword guards (English, Modern Standard Arabic, Gulf dialect) for crisis, partner probing,
//      decisions, faith and termination questions: a fixed, reviewed reply, no model involved.
//   2. A model intent check for whatever the keywords miss (same categories).
//   3. The grounded answer, then code checks: numbers only from the facts, no directive language,
//      no "relatedness raises the 1 in 4", no persona ("as a doctor"), no foreign script in Arabic,
//      no known mistranslations, no insurance claim unless asked, valid citations.
//   4. Anything that fails twice gets an honest "I couldn't answer that safely" and the counsellor.
import 'server-only';
import { BedrockRuntimeClient, ConverseCommand } from '@aws-sdk/client-bedrock-runtime';
import { CONDITIONS, type Level } from './conditions';
import { FACTS } from './knowledge';
import { awsConfig } from './aws';

export type Lang = 'en' | 'ar';
export interface AskInput { lang: Lang; level: Level; genes: string[]; xl: string[]; related: boolean; question: string; history?: { role: 'user' | 'assistant'; text: string }[]; noGuards?: boolean }
export type Intent = 'crisis' | 'probe' | 'decide' | 'faith' | 'termination' | 'other';
export interface Checks { numbersOk: boolean; nonDirective: boolean; citesOk: boolean; oddsOk: boolean; personaOk: boolean; languageOk: boolean; framingOk: boolean }
export interface AskOutput {
  answer: string;
  cites: string[];
  escalate: boolean;
  urgent: boolean;
  route: 'model' | 'guard' | 'intent' | 'fallback';
  intent?: Intent;
  checks: Checks;
  model?: string;
  ms: number;
}

// ---------------------------------------------------------------- 1. keyword guards

export const CRISIS = [
  /\b(suicid\w*|kill (my|him|her)self|end (my|it) (life|all)|end it all|self[- ]?harm|hurt(ing)? myself|want(ed)? to die|wanna die|wish i (was|were) dead|don'?t want to (live|be alive|exist)|no (reason|point) (in |to )?(living|live|go on)|better off without me|can'?t go on|take my (own )?life)\b/i,
  /(انتحار|انتحر|أقتل نفسي|اقتل نفسي|أؤذي نفسي|اذي نفسي|إيذاء نفسي|أنهي حياتي|انهي حياتي|أنهي كل شيء|أريد أن أموت|اريد ان اموت|أبي أموت|ابي اموت|أبغى أموت|ابغى اموت|أتمنى الموت|اتمنى الموت|لا أريد (أن أعيش|العيش)|ما (أبي|ابي|أبغى|ابغى) (أعيش|اعيش)|تعبت من الحياة|لا فائدة من الحياة|ما له داعي أعيش|الموت أحسن)/,
];
export const PARTNER_PROBE = [
  /\b(what|which|anything|does|did|is|are|how many)\b[^?]*\b(my|his|her|their)\s+(partner|husband|wife|fianc[ée]e?|fiance|future (husband|wife))('?s)?\b[^?]*\b(carr(y|ies)|results?|genes?|else)\b/i,
  /\b(his|her|my partner'?s?|my fianc[ée]e?'?s?)\s+(other|full|whole|complete|individual|own)\s+(genes?|results?)\b/i,
  /\bdoes\s+(he|she|[A-Z][a-z]+)\s+carry\s+(anything|something|any other|other)\b/i,
  /\b(how many|which other|what other)\s+genes?\b.*\b(he|she|partner|fianc|husband|wife|carr)/i,
  /(الجينات الأخرى|جينات أخرى|غير هذا الجين|شي ثاني|شيء آخر|شيئاً آخر|كم جين|كل نتائج|نتائج\s*(شريكي|شريكتي|زوجي|زوجتي|خطيبي|خطيبتي)|(يحمل|تحمل)\s*(شريكي|شريكتي|زوجي|زوجتي|خطيبي|خطيبتي)|(شو|وش|ايش|إيش|ماذا|ما)\s+(يحمل|تحمل)\s*(خطيبي|خطيبتي|شريكي|زوجي|زوجتي))/,
];
export const DECIDE_FOR_ME = [
  /\b(should|must|shall)\s+(we|i)\s+(still\s+)?(marry|get married|go ahead|cancel|call (it )?off|break|not marry|have (a )?(baby|kids|children)|abort|terminate|do ivf)\b/i,
  /\b(would you|what would you)\s+(marry|do|choose)\b/i,
  /\bis it (better|best|wise|safe) to (marry|call off|cancel|break|have)\b/i,
  /\b(what do you|which (option )?do you|do you) recommend\b/i,
  /\b(best|right) (option|choice|thing to do) for us\b/i,
  /(لازم (نكنسل|نلغي|ننفصل|نتزوج|نكمل)|(يجب|ينبغي) (أن|ان) (نتزوج|نلغي|ننفصل|نكمل)|نكنسل|ننفصل|نفسخ الخطوبة|نلغي (الزواج|العرس|الخطوبة)|نكمل الزواج|نتزوج ولا|تنصحنا|تنصحني|بماذا تنصح|ايش تنصح|وش تنصح|الأفضل لنا|الافضل لنا|لو كنت مكان|هل نتزوج|هل نلغي)/,
];
export const FAITH = [/\b(haram|halal|sinful|allowed in islam|islamically|fatwa|religion allow)\b/i, /(حرام|حلال|يجوز|جائز شرعاً|فتوى|شرعاً|الشرع)/];
export const TERMINATION = [/\b(abort|abortion|terminat\w+ (the |a )?pregnan\w+|end (the|a) pregnancy)\b/i, /(إجهاض|اجهاض|إنهاء الحمل|انهاء الحمل|نسقط الجنين)/];

export const REPLIES: Record<Exclude<Intent, 'other'>, { en: string; ar: string }> = {
  crisis: {
    en: 'I’m sorry you’re feeling this way, and you don’t have to carry it alone. If you might hurt yourself, call 999 (or 998 for an ambulance) now, or go to the nearest emergency department. You can also tap “Ask a counsellor to call me today” below, and a person will contact you.',
    ar: 'يؤسفني أنك تمرّ بهذا، ولست وحدك. إن كنت قد تؤذي نفسك، فاتصل الآن بالرقم 999 (أو 998 للإسعاف)، أو توجّه إلى أقرب قسم طوارئ. ويمكنك أيضاً الضغط على «اطلب اتصال مستشار اليوم» أدناه، وسيتواصل معك شخص.',
  },
  probe: {
    en: 'I can’t share anything about your partner beyond the genes you both carry. That privacy protects both of you. If you’d like to talk it through together, a counsellor can meet you as a couple.',
    ar: 'لا يمكنني مشاركة أي شيء عن شريكك غير الجينات التي تحملانها معاً، فهذه الخصوصية تحميكما كليكما. وإن أردتما الحديث معاً، يمكن للمستشار أن يلتقيكما كزوجين.',
  },
  decide: {
    en: 'That decision is yours, and couples in your situation choose differently. The options include going ahead with no change, testing during pregnancy, IVF with embryo testing, reconsidering plans together, adoption or fostering, and talking with a counsellor first. No option is right for everyone; a counsellor can go through what each involves.',
    ar: 'هذا القرار لكما، ويختار الأزواج في وضعكما خيارات مختلفة. تشمل الخيارات المضي دون تغيير، أو الفحص أثناء الحمل، أو أطفال الأنابيب مع فحص الأجنة، أو إعادة النظر في الخطط معاً، أو الكفالة والرعاية، أو التحدث مع مستشار أولاً. لا يوجد خيار صحيح للجميع، ويمكن للمستشار شرح ما يتضمنه كل خيار.',
  },
  faith: {
    en: 'Questions of faith are best taken to a scholar you trust; I can’t give religious rulings. For the medical side, I can explain your result, and a counsellor can talk it through with you.',
    ar: 'الأسئلة الشرعية يُفضَّل طرحها على عالِم تثقان به، ولا يمكنني إصدار أحكام شرعية. أما الجانب الطبي، فيمكنني شرح نتيجتكما، ويمكن للمستشار مناقشته معكما.',
  },
  termination: {
    en: 'That’s an important question, and a counsellor is the right person for it: they can explain the testing options in pregnancy and what UAE law allows, without judgement. Tap “Talk to a counsellor”.',
    ar: 'هذا سؤال مهم، والمستشار هو الشخص المناسب له: يمكنه شرح خيارات الفحص أثناء الحمل وما يسمح به القانون في الإمارات، دون أحكام. اضغط «تحدّث إلى مستشار».',
  },
};

const norm = (s: string) => s.replace(/[‘’ʼ`]/g, "'");

export function guardIntent(raw: string): Intent | null {
  const q = norm(raw);
  if (CRISIS.some((r) => r.test(q))) return 'crisis';
  if (PARTNER_PROBE.some((r) => r.test(q))) return 'probe';
  if (TERMINATION.some((r) => r.test(q))) return 'termination';
  if (FAITH.some((r) => r.test(q))) return 'faith';
  if (DECIDE_FOR_ME.some((r) => r.test(q))) return 'decide';
  return null;
}

// ---------------------------------------------------------------- 3. checks after the model

const RELATED = /(cousin|related|relative|consanguin|قرابة|أقارب|اقارب|عمومة|خؤولة|ابن عم|بنت عم)/i;
const INCREASE = /(higher|increase|increases|raised|more likely|greater|extra|adds?\b|أعلى|يزيد|تزيد|يرفع|أكبر|إضافي|يضيف)/i;
const OTHER = /(other|untested|not tested|outside|does not change|doesn'?t change|not change|أخرى|لم تُفحص|لم تفحص|غير المفحوصة|لا يغيّر|لا يغير|لا تغيّر)/i;
const PERSONA = [/\b(as a|as your|i am a|i'?m a|speaking as a)\s+(doctor|physician|clinician|genetic counsel?lor|medical professional)\b/i, /(كطبيب|بصفتي طبيب|بصفتي طبيبة|أنا طبيب|انا طبيب|بصفتي مستشار)/];
const BAD_TERMS = [/\bincompatible\b/i, /(الحمل الجيني|اختبار الحمل|فحص الحمل|غير متوافق|مرتبطان)/];
const FOREIGN = /[぀-ヿ㐀-鿿가-힯Ѐ-ӿऀ-ॿ]/;
const DIRECTIVE = [
  /\byou (should|must|need to|have to|ought to)\s+(not\s+)?(marry|cancel|break|have|terminate|abort|do ivf|choose|review|share|tell)\b/i,
  /\b(i|we) (recommend|advise|suggest) (that )?you\b/i,
  /\bit'?s (best|better|wise) (to|that you)\b/i,
  /\b(don'?t|do not) (marry|get married|have children)\b/i,
  /(يجب عليكما|يجب عليك|ننصحكم|ننصحكما|أنصحك|أنصحكما|من الأفضل أن|الأفضل أن|لا تتزوجا|لا تتزوج|عليكما أن|ينبغي عليكما)/,
];
const MONEY_Q = /(cost|price|pay|insur|thiqa|daman|cover|تكلف|سعر|تأمين|ثقة|ضمان|يغطي)/i;

function numbersIn(s: string): string[] {
  const ascii = s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
  return (ascii.match(/\d+(?:\.\d+)?/g) ?? []).filter((n) => !/^(9497|9380|2021|2023|2025|2026|2019|2002|2006|49)$/.test(n));
}

export function allowedNumbers(genes: string[]): Set<string> {
  const pool = [...FACTS.flatMap((f) => [f.en, f.source]), ...genes.flatMap((g) => {
    const c = CONDITIONS[g];
    return c ? [c.name.en, c.care.en, c.what.simple.en, c.what.standard.en, c.what.detailed.en, c.carrierNote?.en ?? ''] : [];
  }), REPLIES.crisis.en, '1 2 3 4'];
  return new Set(pool.flatMap(numbersIn));
}

export function checkAnswer(raw: string, cites: string[], genes: string[], ctx: { lang?: Lang; related?: boolean; question?: string } = {}): Checks {
  const answer = norm(raw);
  const allowed = allowedNumbers(genes);
  const numbersOk = numbersIn(answer).every((n) => allowed.has(n));
  const nonDirective = !DIRECTIVE.some((r) => r.test(answer));
  const ids = new Set([...FACTS.map((f) => f.id), ...genes.map((g) => `cond:${g}`)]);
  const citesOk = cites.length > 0 && cites.every((c) => ids.has(c));
  // A sentence that ties relatedness to "more risk" must say it is about other, untested conditions.
  const sentences = answer.split(/[.!?؟\n]+/);
  const oddsOk = !(genes.length > 0 && sentences.some((s) => RELATED.test(s) && INCREASE.test(s) && !OTHER.test(s)));
  const personaOk = !PERSONA.some((r) => r.test(answer));
  const latinWords = answer.replace(/\b(PGT-M|IVF|CAH|SMA|FMF|HbS|HbC|HbE|DNA)\b/g, '').match(/\b[a-z]{4,}\b/g);
  const languageOk = !BAD_TERMS.some((r) => r.test(answer)) && !(ctx.lang === 'ar' && (FOREIGN.test(answer) || !!latinWords));
  const framingOk = !(/(thiqa|ثقة)/i.test(answer) && !MONEY_Q.test(ctx.question ?? ''));
  return { numbersOk, nonDirective, citesOk, oddsOk, personaOk, languageOk, framingOk };
}
const allOk = (c: Checks) => Object.values(c).every(Boolean);

// ---------------------------------------------------------------- the model

function knowledge(input: AskInput): string {
  const lines = FACTS.map((f) => `[${f.id}] ${f.en}`);
  for (const g of [...input.genes, ...input.xl]) {
    const c = CONDITIONS[g];
    if (!c) continue;
    lines.push(`[cond:${g}] ${c.name.en} (Arabic: ${c.name.ar}). Simple: ${c.what.simple.en} Standard: ${c.what.standard.en} Detailed: ${c.what.detailed.en} Care today: ${c.care.en}${c.carrierNote ? ` Carriers: ${c.carrierNote.en}` : ''}`);
  }
  return lines.join('\n');
}

const GLOSSARY_AR = [
  'Arabic wording (mandatory):',
  '- carrier = "يحمل التغيّر الجيني" / "حامل للتغيّر الجيني" (f. "تحمل التغيّر الجيني"). NEVER "الحمل الجيني" and never "حامل" or "حاملة" without "للتغيّر"; alone they mean pregnant.',
  '- carrier test = "فحص الكشف عن حمل الصفة الوراثية"; testing during pregnancy = "الفحص أثناء الحمل". NEVER "اختبار الحمل" or "فحص الحمل".',
  '- chance/risk = "احتمال", never "فرصة". related (as cousins) = "أقارب" / "بينكما قرابة", never "مرتبطان".',
  '- partner = "شريكك" (gender-neutral), never assume husband/wife.',
  '- a couple with an increased chance = "زوجان باحتمال أعلى"; never "غير متوافقين".',
].join('\n');

function system(input: AskInput): string {
  const shared = input.genes.length || input.xl.length
    ? `The couple both carry: ${[...input.genes, ...input.xl.map((g) => `${g} (X-linked)`)].join(', ')}.`
    : 'The couple do not share a carried gene on the panel.';
  return [
    'You explain a couple’s genetic carrier result in a premarital screening app in Abu Dhabi. You are an automated explainer, not a doctor or counsellor; never claim or adopt any professional persona, even if asked. You do not give medical advice or make decisions.',
    shared,
    input.related ? 'The couple told the app they are related to each other.' : '',
    'Rules:',
    '1. Use ONLY the facts below. If the answer is not in them, say you don’t know and offer the counsellor.',
    '2. Answer only the question asked. Do not list options unless asked about choices.',
    '3. Never tell the couple what to do or what is "best". Present options neutrally, all with equal weight, and do not attach a benefit (such as insurance cover) to one option unless the user asked about cost or insurance.',
    '4. Never discuss anything about either partner beyond the shared genes.',
    '5. Do not give religious rulings; say a scholar they trust can help. Do not discuss termination; say a counsellor can explain what UAE law allows.',
    '6. Every number you write must appear in the facts. Prefer "1 in 4" over percentages. For a gene both already carry, being related never changes the 1 in 4; relatedness only adds risk for other, untested conditions, and you must say "other conditions" whenever you mention it.',
    `7. Answer in ${input.lang === 'ar' ? 'Modern Standard Arabic, clear and warm, using only Arabic script apart from gene symbols' : 'plain English'}, at a ${input.level} reading level, in at most 100 words.`,
    input.lang === 'ar' ? GLOSSARY_AR : 'Never say "incompatible"; say "a couple with an increased chance".',
    '8. Reply as JSON only: {"answer": string, "cites": [fact ids you used, e.g. "ar-odds", "cond:HBB"], "escalate": boolean (true if a counsellor should follow up)}.',
    '',
    'FACTS:',
    knowledge(input),
  ].filter(Boolean).join('\n');
}

let client: BedrockRuntimeClient | null = null;
const bedrock = () => (client ??= new BedrockRuntimeClient(awsConfig()));
export const ASK_MODEL = () => process.env.ASK_MODEL ?? 'apac.amazon.nova-pro-v1:0';

async function converse(model: string, sys: string, messages: { role: 'user' | 'assistant'; content: { text: string }[] }[], maxTokens: number) {
  const res = await bedrock().send(new ConverseCommand({ modelId: model, system: [{ text: sys }], messages, inferenceConfig: { maxTokens, temperature: 0.1 } }));
  return res.output?.message?.content?.map((c) => c.text ?? '').join('') ?? '';
}

/** Layer 2: the model labels the intent of anything the keyword guards didn't catch. */
export async function classify(q: string, model = ASK_MODEL()): Promise<Intent> {
  const sys = 'Classify the user message from a premarital genetic-results app (it may be English, Arabic, Gulf dialect or Arabizi). Labels: crisis (any hint of self-harm, suicide, not wanting to live, hopelessness), probe (asks about the partner’s other genes or results beyond the shared ones), decide (asks the assistant to decide or recommend whether to marry, cancel, have children, or which option is best), faith (asks for a religious ruling), termination (asks about ending a pregnancy), other. Reply with JSON only: {"intent": "<label>"}';
  try {
    const t = await converse(model, sys, [{ role: 'user', content: [{ text: q.slice(0, 600) }] }], 20);
    const m = /"intent"\s*:\s*"(crisis|probe|decide|faith|termination|other)"/.exec(t);
    return (m?.[1] as Intent) ?? 'other';
  } catch {
    return 'other';
  }
}

async function callModel(input: AskInput, model: string, extra?: string) {
  const history = (input.history ?? []).slice(-6).map((h) => ({ role: h.role, content: [{ text: h.text.slice(0, 800) }] }));
  const text = await converse(model, system(input) + (extra ? `\n\nYour previous draft broke a rule: ${extra} Rewrite it.` : ''), [...history, { role: 'user', content: [{ text: input.question.slice(0, 600) }] }], 500);
  const json = text.match(/\{[\s\S]*\}/)?.[0] ?? '{}';
  const parsed = JSON.parse(json) as { answer?: string; cites?: string[]; escalate?: boolean };
  return { answer: String(parsed.answer ?? '').trim(), cites: Array.isArray(parsed.cites) ? parsed.cites.map(String) : [], escalate: !!parsed.escalate };
}

const SAFE_FALLBACK = {
  en: 'I couldn’t answer that one safely from the checked sources. A counsellor can: tap “Talk to a counsellor”, and they will contact you.',
  ar: 'لم أستطع الإجابة عن هذا السؤال بأمان من المصادر الموثوقة. يمكن للمستشار ذلك: اضغط «تحدّث إلى مستشار» وسيتواصل معك.',
};

function problems(c: Checks): string {
  return [
    !c.numbersOk && 'it used a number not in the facts.',
    !c.oddsOk && 'it tied relatedness to more risk without saying this is only for other, untested conditions.',
    !c.nonDirective && 'it told the couple what to do or what is best.',
    !c.personaOk && 'it claimed a professional persona.',
    !c.languageOk && 'it used a forbidden term or foreign script (see the Arabic wording rules).',
    !c.framingOk && 'it attached insurance cover to one option without being asked.',
    !c.citesOk && 'it did not cite valid fact ids.',
  ].filter(Boolean).join(' ');
}

export async function ask(input: AskInput, model = ASK_MODEL()): Promise<AskOutput> {
  const t0 = Date.now();
  const okChecks: Checks = { numbersOk: true, nonDirective: true, citesOk: true, oddsOk: true, personaOk: true, languageOk: true, framingOk: true };
  const reply = (intent: Exclude<Intent, 'other'>, route: 'guard' | 'intent'): AskOutput => ({
    answer: REPLIES[intent][input.lang], cites: ['counsellor'], escalate: intent === 'crisis' || intent === 'termination', urgent: intent === 'crisis',
    route, intent, checks: okChecks, ms: Date.now() - t0,
  });

  if (!input.noGuards) {
    const g = guardIntent(input.question);
    if (g && g !== 'other') return reply(g, 'guard');
    const m = await classify(input.question, model);
    if (m !== 'other') return reply(m, 'intent');
  }

  let draft: { answer: string; cites: string[]; escalate: boolean } | null = null;
  let problem: string | undefined;
  const ctx = { lang: input.lang, related: input.related, question: input.question };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      draft = await callModel(input, model, problem);
    } catch {
      draft = null;
      break;
    }
    const checks = checkAnswer(draft.answer, draft.cites, [...input.genes, ...input.xl], ctx);
    if (draft.answer && (input.noGuards || allOk(checks))) return { ...draft, urgent: false, route: 'model', checks, model, ms: Date.now() - t0 };
    problem = problems(checks);
  }
  return { answer: SAFE_FALLBACK[input.lang], cites: ['counsellor'], escalate: true, urgent: false, route: 'fallback', checks: okChecks, model, ms: Date.now() - t0 };
}
