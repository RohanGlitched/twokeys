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
export interface AskInput {
  lang: Lang; level: Level; genes: string[]; xl: string[]; related: boolean; question: string; history?: { role: 'user' | 'assistant'; text: string }[]; noGuards?: boolean;
  /** The person asking, so Arabic addresses them correctly (their partner is the other sex). */
  sex?: 'F' | 'M';
  /** Match strength per shared gene: 2 full, 1 one milder change, 0 both milder. */
  strengths?: Record<string, number>;
}
export type Intent = 'crisis' | 'probe' | 'decide' | 'faith' | 'termination' | 'pregnant' | 'other';
export interface Checks { numbersOk: boolean; nonDirective: boolean; citesOk: boolean; oddsOk: boolean; personaOk: boolean; languageOk: boolean; framingOk: boolean; xlOk: boolean; strengthOk: boolean; reassureOk: boolean }
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
  /\b(suicid\w*|kill (my|him|her)self|end (my|it) (life|all)|end it all|self[- ]?harm|hurt(ing)? myself|want(ed)? to die|wanna die|wish i (was|were) dead|don'?t want to (live|be alive|exist)|no (reason|point) (in |to )?(living|live|go on)|better off without me|can'?t go on|can'?t live like this|can'?t take (it|this) any ?more|take my (own )?life)\b/i,
  /((مش|ما|مو|مب|لست)\s*(قادر|قادرة|أقدر|اقدر)\s*(أعيش|اعيش|على العيش)|لا (أستطيع|استطيع|أقدر|اقدر) (أن أعيش|ان اعيش|العيش|أعيش|اعيش)|انتحار|انتحر|أقتل نفسي|اقتل نفسي|أؤذي نفسي|اذي نفسي|إيذاء نفسي|أنهي حياتي|انهي حياتي|أنهي كل شيء|أريد أن أموت|اريد ان اموت|أبي أموت|ابي اموت|أبغى أموت|ابغى اموت|أتمنى الموت|اتمنى الموت|لا أريد (أن أعيش|العيش)|ما (أبي|ابي|أبغى|ابغى) (أعيش|اعيش)|تعبت من الحياة|لا فائدة من الحياة|ما له داعي أعيش|الموت أحسن)/,
  // Arabizi (Arabic in Latin letters and digits), Gulf and Egyptian spellings.
  /\b(a2tol|a2tl|aktol|a9tl)\s*nafs[iy]|\b(ab[iy]|bd[iy]|3ayez|3ayza|abgha|abga)\s*(amoot|amout|amut|a?moot)|\b(ant7ar|anta7ar|nt7ar|enti7ar)\b|\b(m(e|i)?sh|mo|ma)\s*(3ayez|3ayza|abi|bdi|abgha)\s*a?3[ie]+sh|\bhayati\s*(5ls|5alsat|khalsat|5alas)|\b(ma\s*fi|mafi|mfi)\s*(fayda|fydeh|faydeh)\s*(mn|min)\s*(7ayati|hayati|el 7aya)/i,
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
export const FAITH = [/\b(haram|halal|sinful|a sin|allowed in islam|islamically|in islam|fatwa|religion allows?|religiously|permissible|sharia)\b/i, /(حرام|حلال|يجوز|جائز شرعاً|فتوى|شرعاً|الشرع|حكم الدين|حكم الشرع|الدين يسمح|في الدين|ديننا|شرعي)/];
/**
 * Someone who is pregnant now: timing matters (some tests have time limits), so they go to a person.
 * Arabic حامل also means "carrier", so it counts only when not followed by what is carried.
 */
export const PREGNANT = [
  /(?<!\b(if|when|once)\s)\b(i'?m|i am|she'?s|she is|my wife is|we'?re|we are)\s+(\d+\s+(weeks?|months?)\s+)?pregnant\b|\bpregnant (now|already|with)\b|\b\d+\s*weeks? pregnant\b/i,
  /(أنا|انا|إني|اني|زوجتي|مرتي)\s+(حامل|حبلى)(?!\s*(لل|ل|ب)?\s*(جين|تغي|الجين|التغي|الصفة|هذا))|حامل\s+(في|ب)\s*(الأسبوع|الاسبوع|الشهر|أسبوع|اسبوع|شهر)|(الأسبوع|الاسبوع)\s+\S+\s+من الحمل|حبلى/,
  /\b(ana|ena)\s+(7amel|7amil|7amla|hamel|7ableh?)\b(?!\s*(b|bil|el)?\s*(gene|jeen))/i,
];
export const TERMINATION = [/\b(abort|abortion|terminat\w+ (the |a )?pregnan\w+|end (the|a) pregnancy)\b/i, /(إجهاض|اجهاض|إنهاء الحمل|انهاء الحمل|نسقط الجنين)/];

type Said = { en: string; ar: string; arF: string };
export const HELP_LINE = { en: 'UAE Mental Support Line 800 4673 (800 HOPE)', ar: 'خط الدعم النفسي في الإمارات 800 4673 (800 HOPE)' };
export const REPLIES: Record<Exclude<Intent, 'other'>, Said> = {
  crisis: {
    en: `I’m sorry you’re feeling this way, and you don’t have to carry it alone. If you might hurt yourself, call 999 (or 998 for an ambulance) now, or go to the nearest emergency department. To talk to someone now: ${HELP_LINE.en}. You can also tap “Ask a counsellor to call me today” below, and a person will contact you.`,
    ar: `يؤسفني أنك تمرّ بهذا، ولست وحدك. إن كنت قد تؤذي نفسك فاتصل الآن بـ999 (أو 998 للإسعاف) أو توجّه إلى أقرب قسم طوارئ. وللتحدث مع أحد الآن: ${HELP_LINE.ar}. ويمكنك أيضاً الضغط على «اطلب من مرشد الاتصال بي اليوم» أدناه، وسيتواصل معك شخص.`,
    arF: `يؤسفني أنكِ تمرّين بهذا، ولستِ وحدك. إن كنتِ قد تؤذين نفسك فاتصلي الآن بـ999 (أو 998 للإسعاف) أو توجّهي إلى أقرب قسم طوارئ. وللتحدث مع أحد الآن: ${HELP_LINE.ar}. ويمكنك أيضاً الضغط على «اطلبي من مرشد الاتصال بي اليوم» أدناه، وسيتواصل معك شخص.`,
  },
  probe: {
    en: 'I can’t share anything about your partner beyond the genes you both carry. That privacy protects both of you. If you’d like to talk it through together, a genetic counsellor can meet you as a couple.',
    ar: 'لا يمكنني مشاركة أي شيء عن شريكتك غير الجينات التي تحملانها معاً، فهذه الخصوصية تحميكما كليكما. وإن أردتما الحديث معاً، يمكن للمرشد الوراثي أن يلتقيكما معاً.',
    arF: 'لا يمكنني مشاركة أي شيء عن شريكك غير الجينات التي تحملانها معاً، فهذه الخصوصية تحميكما كليكما. وإن أردتما الحديث معاً، يمكن للمرشد الوراثي أن يلتقيكما معاً.',
  },
  decide: {
    en: 'That decision is yours, and couples in your situation choose differently. The options include going ahead with no change, testing during pregnancy, IVF with embryo testing, reconsidering plans together, kafala or fostering, and talking with a genetic counsellor first. No option is right for everyone; a counsellor can go through what each involves.',
    ar: 'هذا القرار لكما، ويختار الأزواج في وضعكما خيارات مختلفة. تشمل الخيارات المضي دون تغيير، أو الفحص أثناء الحمل، أو أطفال الأنابيب مع فحص الأجنة، أو إعادة النظر في الخطط معاً، أو الكفالة والرعاية، أو التحدث مع مرشد وراثي أولاً. لا يوجد خيار صحيح للجميع، ويمكن للمرشد شرح ما يتضمنه كل خيار.',
    arF: 'هذا القرار لكما، ويختار الأزواج في وضعكما خيارات مختلفة. تشمل الخيارات المضي دون تغيير، أو الفحص أثناء الحمل، أو أطفال الأنابيب مع فحص الأجنة، أو إعادة النظر في الخطط معاً، أو الكفالة والرعاية، أو التحدث مع مرشد وراثي أولاً. لا يوجد خيار صحيح للجميع، ويمكن للمرشد شرح ما يتضمنه كل خيار.',
  },
  faith: {
    en: 'Questions of faith are best taken to a scholar you trust; I can’t give religious rulings. For the medical side, I can explain your result, and a genetic counsellor can talk it through with you.',
    ar: 'الأسئلة الشرعية يُفضَّل طرحها على عالِم تثقان به، ولا يمكنني إصدار أحكام شرعية. أما الجانب الطبي، فيمكنني شرح نتيجتكما، ويمكن للمرشد الوراثي مناقشته معكما.',
    arF: 'الأسئلة الشرعية يُفضَّل طرحها على عالِم تثقان به، ولا يمكنني إصدار أحكام شرعية. أما الجانب الطبي، فيمكنني شرح نتيجتكما، ويمكن للمرشد الوراثي مناقشته معكما.',
  },
  pregnant: {
    en: 'Because there is a pregnancy, timing matters: some tests in pregnancy can only be done within certain weeks. Please tap “Talk to a genetic counsellor” and say how many weeks: a counsellor will contact you within one working day, and the same day from week 9.',
    ar: 'بما أن هناك حملاً فالتوقيت مهم: فبعض الفحوص أثناء الحمل لا تُجرى إلا في أسابيع معينة. اضغط «تحدّث إلى مرشد وراثي» واذكر عدد الأسابيع: سيتواصل معك مرشد خلال يوم عمل واحد، وفي اليوم نفسه ابتداءً من الأسبوع التاسع.',
    arF: 'بما أن هناك حملاً فالتوقيت مهم: فبعض الفحوص أثناء الحمل لا تُجرى إلا في أسابيع معينة. اضغطي «تحدّثي إلى مرشد وراثي» واذكري عدد الأسابيع: سيتواصل معك مرشد خلال يوم عمل واحد، وفي اليوم نفسه ابتداءً من الأسبوع التاسع.',
  },
  termination: {
    en: 'That’s an important question, and a genetic counsellor is the right person for it: they can explain the testing options in pregnancy and what UAE law allows, without judgement. Tap “Talk to a genetic counsellor”.',
    ar: 'هذا سؤال مهم، والمرشد الوراثي هو الشخص المناسب له: يمكنه شرح خيارات الفحص أثناء الحمل وما يسمح به القانون في الإمارات، دون أحكام. اضغط «تحدّث إلى مرشد وراثي».',
    arF: 'هذا سؤال مهم، والمرشد الوراثي هو الشخص المناسب له: يمكنه شرح خيارات الفحص أثناء الحمل وما يسمح به القانون في الإمارات، دون أحكام. اضغطي «تحدّثي إلى مرشد وراثي».',
  },
};
/** Picks the reply for the asker's language and, in Arabic, their sex. */
export const said = (l: { en: string; ar: string; arF?: string }, lang: Lang, sex?: 'F' | 'M') => (lang === 'en' ? l.en : sex === 'F' && l.arF ? l.arF : l.ar);

const norm = (s: string) => s.replace(/[‘’ʼ`]/g, "'");

export function guardIntent(raw: string): Intent | null {
  const q = norm(raw);
  if (CRISIS.some((r) => r.test(q))) return 'crisis';
  if (PARTNER_PROBE.some((r) => r.test(q))) return 'probe';
  if (TERMINATION.some((r) => r.test(q))) return 'termination';
  if (PREGNANT.some((r) => r.test(q))) return 'pregnant';
  // A religious question about a decision is a faith question first.
  if (FAITH.some((r) => r.test(q))) return 'faith';
  if (DECIDE_FOR_ME.some((r) => r.test(q))) return 'decide';
  return null;
}

// ---------------------------------------------------------------- 3. checks after the model

const RELATED = /(cousin|related|relative|consanguin|قرابة|أقارب|اقارب|عمومة|خؤولة|ابن عم|بنت عم)/i;
const INCREASE = /(higher|increase|increases|raised|more likely|greater|extra|adds?\b|أعلى|يزيد|تزيد|يرفع|أكبر|إضافي|يضيف)/i;
const OTHER = /(other|untested|not tested|outside|does not change|doesn'?t change|not change|أخرى|لم تُفحص|لم تفحص|غير المفحوصة|لا يغيّر|لا يغير|لا تغيّر)/i;
const PERSONA = [/\b(as a|as your|i am a|i'?m a|speaking as a)\s+(doctor|physician|clinician|genetic counsel?lor|medical professional)\b/i, /(كطبيب|بصفتي طبيب|بصفتي طبيبة|أنا طبيب|انا طبيب|بصفتي مستشار)/];
const BAD_TERMS = [/\bincompatible\b/i, /(الحمل الجيني|اختبار الحمل|فحص الحمل|غير متوافق|مرتبطان|التبني|تبنّي|تبني|ظروف|المتنحي الجسدي)/];
/** The couple is two people: Arabic must use the dual (لكما), not the plural (لكم). */
const PLURAL_YOU = /(^|[\s،.])(لكم|يمكنكم|حالتكم|أطفالكم|عليكم|لديكم|منكم|أنتم)(?![ا\u064B-\u0652])/;
/** Reassurance the facts don't support. */
const REASSURE = /\b(not serious|nothing to worry|no need to worry|don'?t worry|nothing serious)\b|(ليست خطيرة|ليس خطيراً|ليس خطيرا|غير خطيرة|لا داعي للقلق|لا تقلق|لا تقلقي|مش خطير)/i;
const SPOUSE = /\b(husband|wife)\b/i;
/** Every Arabic حامل-word must say what is carried (التغيّر / الصفة), or it reads as "pregnant". */
const bareCarrier = (s: string) => [...s.matchAll(/حامل\S*/g)].some((m) => !/(تغي|الصفة|لهذا)/.test(s.slice(m.index!, m.index! + 30)));
const DAUGHTER = /(daughter|ابنة|بنات|البنات|بناتك|بنت)/i;
const CARRIER_WORD = /(carrier|حامل)/i;
const AFFECTED_WORD = /(affected|ha(ve|s|ving) (the condition|it)|مصاب|تصاب|يصاب|إصابة)/i;
const MILD_WORD = /(mild|milder|أخف|خفيف)/i;
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

export function checkAnswer(raw: string, cites: string[], genes: string[], ctx: { lang?: Lang; related?: boolean; question?: string; xl?: string[]; strengths?: Record<string, number> } = {}): Checks {
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
  const latinWords = answer.replace(/\b(PGT-M|IVF|CAH|SMA|FMF|HbS|HbC|HbE|DNA|HOPE)\b/g, '').replace(/\b[A-Z0-9]{2,}[0-9][A-Z0-9]*\b/g, '').match(/\b[a-z]{4,}\b/gi);
  const languageOk = !BAD_TERMS.some((r) => r.test(answer)) && !(ctx.lang === 'ar' && (FOREIGN.test(answer) || !!latinWords || bareCarrier(answer) || PLURAL_YOU.test(answer)))
    && !(ctx.lang !== 'ar' && SPOUSE.test(answer) && !SPOUSE.test(ctx.question ?? ''));
  const reassureOk = !REASSURE.test(answer);
  const framingOk = !(/(thiqa|ثقة)/i.test(answer) && !MONEY_Q.test(ctx.question ?? ''));
  // X-linked couple (she carries, he is affected): checked clause by clause (commas included, Arabic too).
  // A clause calling daughters carriers must also say they can be affected; and if daughters are
  // mentioned at all, some clause must say a daughter can be affected.
  const clauses = answer.split(/[.!?؟\n,،;؛]+/);
  const xl = (ctx.xl?.length ?? 0) > 0;
  const xlOk = !(xl && (clauses.some((s) => DAUGHTER.test(s) && CARRIER_WORD.test(s) && !AFFECTED_WORD.test(s))
    || (DAUGHTER.test(answer) && !clauses.some((s) => DAUGHTER.test(s) && AFFECTED_WORD.test(s)))));
  // A milder match must not be described as a plain "1 in 4 affected" without saying milder.
  const milder = Object.entries(ctx.strengths ?? {}).filter(([, v]) => v < 2).map(([g]) => g);
  // Per sentence: a "1 in 4 ... affected" sentence must say milder; and "both milder" only when both are.
  const both = /(both (carry |have )?(a )?milder|both changes are milder|كلاكما يحمل تغيّراً أخف|كلاكما تحملان تغيّرات أخف|تغيّرات أخف|كلا التغيّرين أخف)/i;
  const oneMilder = Object.values(ctx.strengths ?? {}).some((v) => v === 1) && !Object.values(ctx.strengths ?? {}).some((v) => v === 0);
  const strengthOk = !(milder.length > 0 && (sentences.some((s) => /1\s*(in|من|في)\s*4/.test(s) && AFFECTED_WORD.test(s) && !MILD_WORD.test(s)) || (oneMilder && both.test(answer))));
  return { numbersOk, nonDirective, citesOk, oddsOk, personaOk, languageOk, framingOk, xlOk, strengthOk, reassureOk };
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
  '- carrier test = "فحص حاملي الصفة الوراثية"; testing during pregnancy = "الفحص أثناء الحمل". NEVER "اختبار الحمل" or "فحص الحمل".',
  '- chance/risk = "احتمال", never "فرصة". related (as cousins) = "أقارب" / "بينكما قرابة", never "مرتبطان".',
  '- partner: follow the addressee rule above; never say husband/wife (they may not be married yet).',
  '- never use the word for adoption (التبني); say kafala or fostering (الكفالة أو الرعاية).',
  '- a couple with an increased chance = "زوجان باحتمال أعلى"; never "غير متوافقين".',
  '- address the couple in the DUAL: لكما، أطفالكما، يمكنكما، حالتكما. Never the plural لكم، يمكنكم، حالتكم.',
  '- other conditions = "حالات أخرى"; never "ظروف". recessive inheritance = "وراثة متنحية"; never "المتنحي الجسدي".',
].join('\n');

function system(input: AskInput): string {
  const tier = (g: string) => {
    const st = input.strengths?.[g] ?? 2;
    // The globin genes: the pair of changes decides it (see lab.ts).
    if (g === 'HBB') return 'a full match until a blood test (HPLC) shows the exact pair; some pairs are milder, and the counsellor explains which';
    if (g === 'HBA') return st === 0 ? 'each lost one alpha gene: a child with both has alpha-thalassaemia trait, which is not an illness' : 'a serious alpha-globin match (HbH disease or Hb Bart’s hydrops, see [cond:HBA]); the counsellor explains which';
    return ({ 2: 'both changes serious', 1: 'one milder change: a milder form is likely (use [milder-match])', 0: 'both changes milder: low concern (use [milder-match])' } as Record<number, string>)[st];
  };
  const shared = input.genes.length || input.xl.length
    ? `The couple both carry: ${[...input.genes.map((g) => `${g} (${tier(g)})`), ...input.xl.map((g) => `${g} (X-linked: she carries it and he has the condition; use [xl-affected-father], never [xl-odds])`)].join(', ')}.`
    : 'The couple do not share a carried gene on the panel.';
  const addressee = input.lang === 'ar'
    ? input.sex === 'F' ? 'Address the user in the feminine (أنتِ). Her partner is a man: "شريكك".' : input.sex === 'M' ? 'Address the user in the masculine (أنت). His partner is a woman: "شريكتك".' : 'Address the user neutrally.'
    : '';
  return [
    'You explain a couple’s genetic carrier result in a premarital screening app in Abu Dhabi. You are an automated explainer, not a doctor or counsellor; never claim or adopt any professional persona, even if asked. You do not give medical advice or make decisions.',
    shared,
    input.related ? 'The couple told the app they are related to each other.' : '',
    addressee,
    'Rules:',
    '1. Use ONLY the facts below. If the answer is not in them, say you don’t know and offer the counsellor.',
    '2. Answer only the question asked. Do not list options unless asked about choices. If asked whether their result is serious or what it means, say what it means for their children: the 1 in 4 for each shared gene, and for an X-linked gene what it means for sons and for daughters.',
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
// Adaptive retries: under throttling, wait and retry rather than fall back to a canned answer.
const bedrock = () => (client ??= new BedrockRuntimeClient({ ...awsConfig(), maxAttempts: 6, retryMode: 'adaptive' }));
export const ASK_MODEL = () => process.env.ASK_MODEL ?? 'apac.amazon.nova-pro-v1:0';

/** Running token totals, read by the evaluation script to measure cost per answer. */
export const usageMeter = { input: 0, output: 0, calls: 0 };

async function converse(model: string, sys: string, messages: { role: 'user' | 'assistant'; content: { text: string }[] }[], maxTokens: number) {
  const res = await bedrock().send(new ConverseCommand({ modelId: model, system: [{ text: sys }], messages, inferenceConfig: { maxTokens, temperature: 0.1 } }));
  usageMeter.input += res.usage?.inputTokens ?? 0;
  usageMeter.output += res.usage?.outputTokens ?? 0;
  usageMeter.calls++;
  return res.output?.message?.content?.map((c) => c.text ?? '').join('') ?? '';
}

/** Layer 2: the model labels the intent of anything the keyword guards didn't catch. */
export async function classify(q: string, model = ASK_MODEL()): Promise<Intent | 'unknown'> {
  const sys = `Classify the user message from a premarital genetic-results app. The couple already know the genes they BOTH carry; asking about those is normal. The message may be English, Arabic, Gulf dialect or Arabizi.
Labels:
- crisis: any hint of self-harm, suicide, not wanting to live or go on, life being over, hopelessness, even if a normal question follows.
- probe: asks what ELSE the partner carries, how many genes, or any result beyond the shared ones.
- decide: asks the assistant to choose or recommend: marry or not, cancel, have children, which option is best, "what would you do".
- faith: asks for a religious ruling (halal, haram, permitted).
- termination: asks about ending a pregnancy.
- pregnant: says the asker or the partner is pregnant now (not a question about future pregnancies).
- other: everything else, including what the shared result means, chances, symptoms, care, options, costs and relatives.
Examples: "What does it mean that we both carry this?" -> other. "We both have CYP21A2, I'm confused" -> other. "Does he carry anything else serious?" -> probe. "How many genes does she have?" -> probe. "If you were me would you go ahead?" -> decide. "I don't see the point anymore, what is ABCA4?" -> crisis.
Reply with JSON only: {"intent": "<label>"}`;
  try {
    const t = await converse(model, sys, [{ role: 'user', content: [{ text: q.slice(0, 600) }] }], 20);
    const m = /"intent"\s*:\s*"(crisis|probe|decide|faith|termination|pregnant|other)"/.exec(t);
    // An answer we can't read is treated like a check that couldn't run: fail closed.
    return (m?.[1] as Intent) ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

async function callModel(input: AskInput, model: string, extra?: string) {
  const history = (input.history ?? []).slice(-6).map((h) => ({ role: h.role, content: [{ text: h.text.slice(0, 800) }] }));
  const text = await converse(model, system(input) + (extra ? `\n\nYour previous draft broke a rule: ${extra} Rewrite it.` : ''), [...history, { role: 'user', content: [{ text: input.question.slice(0, 600) }] }], 500);
  const json = text.match(/\{[\s\S]*\}/)?.[0] ?? '{}';
  const parsed = JSON.parse(json) as { answer?: string; cites?: string[]; escalate?: boolean };
  return { answer: String(parsed.answer ?? '').trim(), cites: Array.isArray(parsed.cites) ? parsed.cites.map(String) : [], escalate: !!parsed.escalate };
}

/** Fear or worry, short of a crisis: in English, Arabic, Gulf dialect and Arabizi. */
// Self-blame and stigma ("we are defective", "bad blood") count too: they need the same human follow-up.
const WORRY = /\b(scared|afraid|worried|worrying|anxious|frightened|terrified|nervous|upset|ashamed|defective|bad blood|my fault|selfish)\b|أناني|أنانيين|معيب|معيبين|معيبة|دم فاسد|دمها فاسد|دمه فاسد|ذنبي|غلطتي|خجلان|خجلانة|خايف|خايفة|خائف|خائفة|قلق|قلقان|قلقانة|خوف|متوتر|متوترة|مرعوب|زعلان|زعلانة|حزين|حزينة|\b(5ayf|5ayfa|khayf|khayfa|khayef|2al2an|2al2ana|5ofi|kha2fa)\b/i;
export const expressesWorry = (q: string) => WORRY.test(q.normalize('NFKC'));
const ACKNOWLEDGE = {
  en: 'It’s completely understandable to feel worried about this, and you don’t have to work through it alone: a genetic counsellor can talk it through with you.',
  ar: 'من الطبيعي تماماً أن تشعر بالقلق من هذا، ولست وحدك فيه: يمكن لمرشد وراثي أن يتحدث معك عنه.',
  arF: 'من الطبيعي تماماً أن تشعري بالقلق من هذا، ولستِ وحدك فيه: يمكن لمرشد وراثي أن يتحدث معك عنه.',
};
/** When the safety checks themselves can't run, show help rather than an unchecked answer. */
const CHECK_FAILED = {
  en: `I couldn’t check your message safely just now. If you are struggling, call 999 (998 for an ambulance) or the ${HELP_LINE.en}. Otherwise a genetic counsellor can answer: tap below.`,
  ar: `لم أستطع فحص رسالتك بأمان الآن. إن كنت تمرّ بوقت صعب فاتصل بـ999 (998 للإسعاف) أو ${HELP_LINE.ar}. وإلا فيمكن للمرشد الوراثي الإجابة: اضغط أدناه.`,
  arF: `لم أستطع فحص رسالتك بأمان الآن. إن كنتِ تمرّين بوقت صعب فاتصلي بـ999 (998 للإسعاف) أو ${HELP_LINE.ar}. وإلا فيمكن للمرشد الوراثي الإجابة: اضغطي أدناه.`,
};

const SAFE_FALLBACK = {
  en: 'I couldn’t answer that one safely from the checked sources. A genetic counsellor can: tap below, and they will contact you.',
  ar: 'لم أستطع الإجابة عن هذا السؤال بأمان من المصادر الموثوقة. يمكن للمرشد الوراثي ذلك: اضغط أدناه وسيتواصل معك.',
  arF: 'لم أستطع الإجابة عن هذا السؤال بأمان من المصادر الموثوقة. يمكن للمرشد الوراثي ذلك: اضغطي أدناه وسيتواصل معك.',
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
    !c.xlOk && 'for this X-linked couple, daughters are either affected (1 in 2) or carriers; say both, using [xl-affected-father].',
    !c.strengthOk && 'this is a milder match: say the 1 in 4 child would usually have a milder form, using [milder-match], and say exactly how many of the changes are milder (one, or both).',
    !c.reassureOk && 'it reassured beyond the facts ("not serious", "nothing to worry"); describe the chance and the care instead.',
  ].filter(Boolean).join(' ');
}

export async function ask(input: AskInput, model = ASK_MODEL()): Promise<AskOutput> {
  const t0 = Date.now();
  const okChecks: Checks = { numbersOk: true, nonDirective: true, citesOk: true, oddsOk: true, personaOk: true, languageOk: true, framingOk: true, xlOk: true, strengthOk: true, reassureOk: true };
  const say = (l: { en: string; ar: string; arF?: string }) => said(l, input.lang, input.sex);
  const reply = (intent: Exclude<Intent, 'other'>, route: 'guard' | 'intent'): AskOutput => ({
    answer: say(REPLIES[intent]), cites: ['counsellor'], escalate: intent === 'crisis' || intent === 'termination' || intent === 'pregnant', urgent: intent === 'crisis',
    route, intent, checks: okChecks, ms: Date.now() - t0,
  });
  const worried = expressesWorry(input.question);

  if (!input.noGuards) {
    const g = guardIntent(input.question);
    if (g && g !== 'other') return reply(g, 'guard');
    const m = await classify(input.question, model);
    // Fail closed: if the intent check can't run, nobody gets an unchecked answer; they get help instead.
    if (m === 'unknown') return { answer: say(CHECK_FAILED), cites: ['counsellor'], escalate: true, urgent: true, route: 'fallback', checks: okChecks, model, ms: Date.now() - t0 };
    if (m !== 'other') return reply(m, 'intent');
  }

  let draft: { answer: string; cites: string[]; escalate: boolean } | null = null;
  let problem: string | undefined;
  const ctx = { lang: input.lang, related: input.related, question: input.question, xl: input.xl, strengths: input.strengths };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      draft = await callModel(input, model, problem);
    } catch {
      draft = null;
      break;
    }
    const checks = checkAnswer(draft.answer, draft.cites, [...input.genes, ...input.xl], ctx);
    if (draft.answer && (input.noGuards || allOk(checks))) {
      // Someone who says they are scared or worried hears that first, and is offered a person.
      if (!input.noGuards && worried) return { ...draft, answer: `${say(ACKNOWLEDGE)} ${draft.answer}`, escalate: true, urgent: false, route: 'model', checks, model, ms: Date.now() - t0 };
      return { ...draft, urgent: false, route: 'model', checks, model, ms: Date.now() - t0 };
    }
    problem = problems(checks);
  }
  // A worried person whose answer failed gets the help card too.
  return { answer: say(SAFE_FALLBACK), cites: ['counsellor'], escalate: true, urgent: worried, route: 'fallback', checks: okChecks, model, ms: Date.now() - t0 };
}
