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
export interface Checks { numbersOk: boolean; nonDirective: boolean; citesOk: boolean; oddsOk: boolean; personaOk: boolean; languageOk: boolean; framingOk: boolean; xlOk: boolean; strengthOk: boolean; reassureOk: boolean; relatedOk: boolean; coverOk: boolean }
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
  /((مش|ما|مو|مب|لست)\s*(قادر|قادرة|أقدر|اقدر)\s*(أعيش|اعيش|على العيش)|لا (أستطيع|استطيع|أقدر|اقدر) (أن أعيش|ان اعيش|العيش|أعيش|اعيش)|انتحار|انتحر|أقتل نفسي|اقتل نفسي|أؤذي نفسي|اذي نفسي|إيذاء نفسي|أنهي حياتي|انهي حياتي|أنهي كل شيء|أريد أن أموت|اريد ان اموت|أبي أموت|ابي اموت|أبغى أموت|ابغى اموت|أتمنى الموت|اتمنى الموت|لا أريد (أن أعيش|العيش)|ما (أبي|ابي|أبغى|ابغى) (أعيش|اعيش)|أفكر\s+(أ|ا)\S{1,5}\s+نفسي|(ما|مو|مب)\s*(أطيق|اطيق)\s+نفسي|تعبت من الحياة|لا فائدة من الحياة|ما له داعي أعيش|الموت أحسن)/,
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
  /(?<!\b(if|when|once)\s)\b(i'?m|i am|she'?s|she is|my wife is|we'?re|we are)\s+(\d+\s+(weeks?|months?)\s+)?pregnant\b|\bpregnant (now|already|with)\b|\b\d+\s*weeks? (pregnant|along)\b/i,
  // حاملة usually means "carrier"; حامل without ة, or any form with a number of weeks, means pregnant.
  /(أنا|انا|إني|اني|زوجتي|مرتي)\s+(حامل|حبلى)(?!ة)(?!\s*(لل|ل|ب)?\s*(جين|تغي|الجين|التغي|الصفة|هذا|[A-Z]))|حامل(ة)?\s+(في|ب)\s*(الأسبوع|الاسبوع|الشهر|أسبوع|اسبوع|شهر)|حامل(ة)?\s*(في|ب)?\s*(ال)?\s*[0-9٠-٩]+\s*(أسبوع|اسبوع|أسابيع|اسابيع|شهر|أشهر|اشهر|شهور)|حمل(نا|ي|ها)?\s+[0-9٠-٩]+\s*(أسبوع|اسبوع|أسابيع|اسابيع|شهر|أشهر|اشهر)|[0-9٠-٩]+\s*(أسبوع|اسبوع|أسابيع|اسابيع|شهر|أشهر|اشهر)\s+(من\s+)?(ال)?حمل|(الأسبوع|الاسبوع)\s+\S+\s+من الحمل|حبلى/,
  /\b(ana|ena)\s+(7amel|7amil|7amla|hamel|7ableh?)\b(?!\s*(b|bil|el|l)?\s*(gene|jeen|hbb|hba|cftr|mefv|[a-z]{2,6}\d))|\b\d+\s*(asabi\w*|esb[uo]+3\w*|weeks?|shohor|shhor|months?)\s*(fi\s+|el\s+|al\s+|of\s+)?(el|al)?\s*-?(haml|hamla|7aml|7amla|pregnancy)\b|\b(haml|hamla|7aml|7amla)\s*\d+\s*(asabi\w*|esb[uo]+3\w*|weeks?)/i,
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
const OTHER = /(other|untested|not tested|outside|does not change|doesn'?t change|not change|أخرى|لغيرها|لغيرهما|غيرها من|غيرهما من|لم تُفحص|لم تفحص|غير المفحوصة|لا يغيّر|لا يغير|لا تغيّر)/i;
const PERSONA = [/\b(as a|as your|i am a|i'?m a|speaking as a)\s+(doctor|physician|clinician|genetic counsel?lor|medical professional)\b/i, /(كطبيب|بصفتي طبيب|بصفتي طبيبة|أنا طبيب|انا طبيب|بصفتي مستشار)/];
const BAD_TERMS = [/\bincompatible\b/i, /(الحمل الجيني|اختبار الحمل|فحص الحمل|غير متوافق|مرتبطان|التبني|تبنّي|تبني|ظروف|المتنحي الجسدي)/];
/** The couple is two people: Arabic must use the dual (لكما), not the plural (لكم). */
const PLURAL_YOU = /(^|[\s،.])(لكم|يمكنكم|حالتكم|أطفالكم|عليكم|لديكم|منكم|أنتم)(?![ا\u064B-\u0652])/;
/** Reassurance the facts don't support. */
const REASSURE = /\b(not serious|nothing to worry|no need to worry|don'?t worry|nothing serious)\b|(ليست خطيرة|ليس خطيراً|ليس خطيرا|غير خطيرة|لا داعي للقلق|لا تقلق|لا تقلقي|مش خطير)/i;
const SPOUSE = /\b(husband|wife)\b/i;
/** Every Arabic حامل-word must say what is carried (التغيّر / الصفة), or it reads as "pregnant". */
const bareCarrier = (s: string) => [...s.matchAll(/حامل\S*/g)].some((m) => !/(تغي|الصفة|لهذا|جين|ل[ـ]?\s*[A-Z])/.test(s.slice(m.index!, m.index! + 30)));
const DAUGHTER = /(daughter|ابنة|بنات|البنات|بناتك|بنت)/i;
const SON = /(\bsons?\b|ابن(?!ة)|أبناء|الأولاد الذكور|الذكور)/i;
const RELATED_ANY = /(cousin|related|relative|consanguin|قرابة|أقارب|اقارب|قرابتكما|كونكما أقارب|عمومة|خؤولة|ابن عم|بنت عم|أولاد عم|اولاد عم)/i;
/** A negative claim about cover that the facts don't make (they say what Thiqa covers, never what it excludes). */
const COVER_NEG = /(thiqa|ثقة|insurance|التأمين)[^.!?؟]{0,120}(not cover|doesn'?t cover|does not cover|won'?t cover|excluded|\bexcept\b|\bbut not\b|\bnot for\b|لا يغطي|لا تغطي|لا يشمل|لا تشمل|غير مشمول|وليس ل|لكن ليس|باستثناء)|(not|doesn'?t|does not|لا)\s+(cover|يغطي|تغطي)[^.!?؟]{0,40}(x-linked|المرتبط|G6PD)/i;
const DUAL: [RegExp, string][] = [
  [/(^|[\s،.])يمكنكم(?![ا\u064B-\u0652])/g, '$1يمكنكما'], [/(^|[\s،.])لكم(?![ا\u064B-\u0652])/g, '$1لكما'], [/(^|[\s،.])حالتكم(?![ا\u064B-\u0652])/g, '$1حالتكما'],
  [/(^|[\s،.])أطفالكم(?![ا\u064B-\u0652])/g, '$1أطفالكما'], [/(^|[\s،.])عليكم(?![ا\u064B-\u0652])/g, '$1عليكما'], [/(^|[\s،.])لديكم(?![ا\u064B-\u0652])/g, '$1لديكما'],
  [/(^|[\s،.])منكم(?![ا\u064B-\u0652])/g, '$1منكما'], [/(^|[\s،.])أنتم(?![ا\u064B-\u0652])/g, '$1أنتما'],
];
/** Repairs that never change meaning: Arabic script for plan names, the dual for the couple, the agreed recessive term. */
export const stripCiteTags = (s: string) => s.replace(/\s*\[(?:\s*(?:cond:[A-Z0-9]+|[a-z]+(?:-[a-z]+)*)\s*,?)+\]/g, '').trim();
export function polishArabic(s: string): string {
  let t = s.replace(/\bThiqa\b/gi, 'ثقة').replace(/\bDaman\b/gi, 'ضمان').replace(/\(?\s*X-linked\s*:?\s*\)?/gi, (m) => (m.includes('(') ? '(مرتبط بالكروموسوم X: ' : 'المرتبط بالكروموسوم X'))
    .replace(/(الجسمي|الجسدي)\s*المتنحي|المتنحي\s*(الجسمي|الجسدي)/g, 'المتنحي');
  for (const [r, w] of DUAL) t = t.replace(r, w);
  return t;
}
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
const MONEY_Q = /(cost|price|pay|insur|thiqa|daman|cover|takl|takal|tak?leef|ta'?m[ie]+n|t2m[ie]+n|ta2m[ie]+n|masaref|masarif|thaman|tha?mn|yghat|yaghat|تكلف|تكاليف|سعر|تأمين|التامين|ثقة|ضمان|يغطي|مصاريف|ثمن)/i;
/** "I don't know" answers that only point to a counsellor need no fact citation. */
const DONT_KNOW = /(i don'?t (know|have)|not in (the|my) (facts|sources)|لا أملك معلومات|لا أعرف|لا تتوفر لدي|ليست لدي معلومات)/i;

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
  const citesOk = cites.length > 0 ? cites.every((c) => ids.has(c)) : DONT_KNOW.test(answer) && numbersIn(answer).every((n) => /^\d$/.test(n) || genes.some((g) => g.includes(n)));
  // A sentence that ties relatedness to "more risk" must say it is about other, untested conditions.
  const sentences = answer.split(/[.!?؟\n]+/);
  const oddsOk = !(genes.length > 0 && sentences.some((s) => RELATED.test(s) && INCREASE.test(s) && !OTHER.test(s)));
  const personaOk = !PERSONA.some((r) => r.test(answer));
  const latinWords = answer.replace(/\b(PGT-M|IVF|CAH|SMA|FMF|HbS|HbC|HbE|HbH|DNA|HOPE)\b/g, '').replace(/\b[A-Z][A-Z0-9-]{1,7}\b/g, '').match(/\b[a-z]{4,}\b/gi);
  const languageOk = !BAD_TERMS.some((r) => r.test(answer)) && !(ctx.lang === 'ar' && (FOREIGN.test(answer) || !!latinWords || bareCarrier(answer) || PLURAL_YOU.test(answer)))
    && !(ctx.lang !== 'ar' && SPOUSE.test(answer) && !SPOUSE.test(ctx.question ?? ''));
  const reassureOk = !REASSURE.test(answer);
  const framingOk = !(/(thiqa|ثقة)/i.test(answer) && !MONEY_Q.test(ctx.question ?? ''));
  // X-linked couple (she carries, he is affected): checked clause by clause (commas included, Arabic too).
  // A clause calling daughters carriers must also say they can be affected; and if daughters are
  // mentioned at all, some clause must say a daughter can be affected.
  const clauses = answer.split(/[.!?؟\n,،;؛]+/);
  const xl = (ctx.xl?.length ?? 0) > 0;
  const aboutDaughters = (s: string) => {
    const i = s.search(DAUGHTER);
    if (i < 0) return '';
    const rest = s.slice(i);
    const j = rest.slice(1).search(SON);
    return j < 0 ? rest : rest.slice(0, j + 1);
  };
  const daughterParts = clauses.map(aboutDaughters).filter(Boolean);
  const xlOk = !(xl && (daughterParts.some((s) => CARRIER_WORD.test(s) && !AFFECTED_WORD.test(s))
    || (daughterParts.length > 0 && !daughterParts.some((s) => AFFECTED_WORD.test(s)))));
  // A milder match must not be described as a plain "1 in 4 affected" without saying milder.
  const milder = Object.entries(ctx.strengths ?? {}).filter(([g, v]) => v < 2 && g !== 'HBB').map(([g]) => g);
  const names = (g: string) => [g, CONDITIONS[g]?.name.en, CONDITIONS[g]?.name.ar].filter((x): x is string => !!x);
  const namesMilder = (t: string) => milder.some((g) => names(g).some((n) => t.includes(n)));
  // Per sentence: a "1 in 4 ... affected" sentence must say milder; and "both milder" only when both are.
  const both = /(both (carry |have )?(a )?milder|both changes are milder|كلاكما يحمل تغيّراً أخف|كلاكما تحملان تغيّرات أخف|تغيّرات أخف|كلا التغيّرين أخف)/i;
  const oneMilder = milder.some((g) => ctx.strengths?.[g] === 1) && !milder.some((g) => ctx.strengths?.[g] === 0);
  const plainQuarter = (t: string) => /1\s*(in|من|في)\s*4/.test(t) && AFFECTED_WORD.test(t) && !MILD_WORD.test(t);
  const strengthOk = !(milder.length > 0 && (sentences.some((t) => plainQuarter(t) && namesMilder(t)) || (sentences.some(plainQuarter) && !MILD_WORD.test(answer)) || (oneMilder && both.test(answer))));
  const wrongCarrierOdds = (ctx.xl?.length ?? 0) === 0 && genes.length > 0 && clauses.some((t) => /(^|\D)1\s*(in|من|في)\s*4/.test(t) && CARRIER_WORD.test(t) && !AFFECTED_WORD.test(t) && !/(free|neither|بلا|خالي|سليم من)/i.test(t));
  const relatedOk = !!ctx.related || !RELATED_ANY.test(answer) || RELATED_ANY.test(ctx.question ?? '');
  const coverOk = !COVER_NEG.test(answer);
  return { numbersOk, nonDirective, citesOk, oddsOk: oddsOk && !wrongCarrierOdds, personaOk, languageOk, framingOk, xlOk, strengthOk, reassureOk, relatedOk, coverOk };
}
const allOk = (c: Checks) => Object.values(c).every(Boolean);

// ---------------------------------------------------------------- the model

function knowledge(input: AskInput): string {
  const lines = FACTS.map((f) => (input.lang === 'ar' && f.ar ? `[${f.id}] ${f.en}\n  (Arabic wording to reuse, in part, only where it answers the question: ${f.ar})` : `[${f.id}] ${f.en}`));
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
    input.related ? 'The couple told the app they are related to each other.' : 'The couple have not said they are related: do not mention relatedness or cousins unless the user asks about it.',
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
    'For insurance, say only what [pgt-cover] says it covers; never say what a plan does not cover. For anything else about cost or cover, say a counsellor can check.',
    input.xl.length ? 'For the X-linked gene, every sentence about daughters must say a daughter can have the condition (1 in 2) and otherwise is a carrier.' : '',
    Object.values(input.strengths ?? {}).some((v) => v < 2) ? 'For a milder match, put the word "milder" in the same sentence as its 1 in 4.' : '',
    '8. Write Arabic letters directly in the JSON, never as \\u escapes. Reply as JSON only: {"answer": string, "cites": [fact ids you used, e.g. "ar-odds", "cond:HBB"], "escalate": boolean (true if a counsellor should follow up)}.',
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
  const text = await converse(model, system(input) + (extra ? `\n\nYour previous draft broke a rule: ${extra} Rewrite it.` : ''), [...history, { role: 'user', content: [{ text: input.question.slice(0, 600) }] }], 1500);
  const json = text.match(/\{[\s\S]*\}/)?.[0] ?? '{}';
  const parsed = JSON.parse(json) as { answer?: string; cites?: string[]; escalate?: boolean };
  return { answer: String(parsed.answer ?? '').trim(), cites: Array.isArray(parsed.cites) ? parsed.cites.map(String) : [], escalate: !!parsed.escalate };
}

/** Fear or worry, short of a crisis: in English, Arabic, Gulf dialect and Arabizi. */
// Self-blame and stigma ("we are defective", "bad blood") count too: they need the same human follow-up.
const WORRY = /\b(scared|afraid|worried|worrying|anxious|frightened|terrified|nervous|upset|ashamed|defective|bad blood|my fault|selfish)\b|أناني|أنانيين|معيب|معيبين|معيبة|دم فاسد|دمها فاسد|دمه فاسد|ذنبي|غلطتي|خجلان|خجلانة|خايف|خايفة|خائف|خائفة|قلق|قلقان|قلقانة|خوف|متوتر|متوترة|مرعوب|زعلان|زعلانة|حزين|حزينة|مضايق|مضايقة|ضايقني|مخنوق|مخنوقة|(مش|ما) (عارف|عارفة|أعرف|اعرف) (إيش|ايش|شو|وش|شنو|ماذا) (أسوي|اسوي|أعمل|اعمل|نسوي|نعمل)|\b(5ayf|5ayfa|khayf|khayfa|khayef|2al2an|2al2ana|5ofi|kha2fa|mdaye2|mday2a|ma5no2|makhnou2|wesh?t\s*ro7i)|\bm(e|i)?sh 3ar(e)?f(a)? (eih|eh|shu|sho|esh) (a3mel|asawi|n3mel)\b/i;
export const expressesWorry = (q: string) => WORRY.test(q.normalize('NFKC')) || STIGMA.test(q.normalize('NFKC'));
/** Shame about a family or about being a carrier ("broken", "bad blood", "dirty blood", "our family is sick"). */
const STIGMA = /\b(broken|defective|damaged|cursed|bad blood|dirty blood|tainted|our fault|my fault|ashamed|shame)\b|معيب|معيبين|(إحنا|احنا|نحن|هل نحن|أنا|انا) عيب|دم فاسد|دم مش نظيف|دم غير نظيف|دم وسخ|عائلتي مريضة|العيلة كلها مريضة|العائلة كلها مريضة|عائلة مريضة|ذنبي|غلطتي|خجلان|خجلانة|\b(3ayb|3eib|3ayleen|m7awleen|dam\s*wis5)\b/i;
export const expressesShame = (q: string) => STIGMA.test(q.normalize('NFKC'));
const NOT_BROKEN = {
  en: 'Being a carrier is not an illness and not anyone’s fault: carriers are healthy, and carrier changes are found in every family and community.',
  ar: 'حمل التغيّر الجيني ليس مرضاً وليس ذنب أحد: حاملو التغيّر أصحاء، وتوجد هذه التغيّرات في كل عائلة وكل مجتمع.',
  arF: 'حمل التغيّر الجيني ليس مرضاً وليس ذنب أحد: حاملو التغيّر أصحاء، وتوجد هذه التغيّرات في كل عائلة وكل مجتمع.',
};
const ACKNOWLEDGE = {
  en: 'It’s completely understandable to feel this way, and you don’t have to work through it alone: a genetic counsellor can talk it through with you.',
  ar: 'من الطبيعي تماماً أن تشعر بهذا، ولست وحدك فيه: يمكن لمرشد وراثي أن يتحدث معك عنه.',
  arF: 'من الطبيعي تماماً أن تشعري بهذا، ولستِ وحدك فيه: يمكن لمرشد وراثي أن يتحدث معك عنه.',
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
    !c.oddsOk && 'it tied relatedness to more risk without saying this is only for other, untested conditions, or gave the carrier chance wrongly (a carrier child is 2 in 4, not 1 in 4).',
    !c.nonDirective && 'it told the couple what to do or what is best.',
    !c.personaOk && 'it claimed a professional persona.',
    !c.languageOk && 'it used a forbidden term or foreign script (see the Arabic wording rules).',
    !c.framingOk && 'it attached insurance cover to one option without being asked.',
    !c.citesOk && 'it did not cite valid fact ids.',
    !c.xlOk && 'for this X-linked couple, daughters are either affected (1 in 2) or carriers; say both, using [xl-affected-father].',
    !c.strengthOk && 'this is a milder match: say the 1 in 4 child would usually have a milder form, using [milder-match], and say exactly how many of the changes are milder (one, or both).',
    !c.relatedOk && 'the couple are not related: remove every mention of relatedness or cousins.',
    !c.coverOk && 'it said what a plan does not cover; say only what [pgt-cover] covers, and that a counsellor can check the rest.',
    !c.reassureOk && 'it reassured beyond the facts ("not serious", "nothing to worry"); describe the chance and the care instead.',
  ].filter(Boolean).join(' ');
}

/** `onReject` sees each draft the checks turned down (for evaluation and debugging; never sent to a user). */
export async function ask(input: AskInput, model = ASK_MODEL(), onReject?: (answer: string, checks: Checks) => void): Promise<AskOutput> {
  const t0 = Date.now();
  const okChecks: Checks = { numbersOk: true, nonDirective: true, citesOk: true, oddsOk: true, personaOk: true, languageOk: true, framingOk: true, xlOk: true, strengthOk: true, reassureOk: true, relatedOk: true, coverOk: true };
  const say = (l: { en: string; ar: string; arF?: string }) => said(l, input.lang, input.sex);
  const worried = expressesWorry(input.question);
  const shame = expressesShame(input.question);
  const lead = () => [shame ? say(NOT_BROKEN) : '', say(ACKNOWLEDGE)].filter(Boolean).join(' ');
  // Worry or self-blame is acknowledged on fixed replies too (crisis has its own words), and offered a person.
  const reply = (intent: Exclude<Intent, 'other'>, route: 'guard' | 'intent'): AskOutput => ({
    answer: worried && intent !== 'crisis' ? `${lead()} ${say(REPLIES[intent])}` : say(REPLIES[intent]), cites: ['counsellor'],
    escalate: worried || intent === 'crisis' || intent === 'termination' || intent === 'pregnant', urgent: intent === 'crisis',
    route, intent, checks: okChecks, ms: Date.now() - t0,
  });

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
  let failed: Checks = okChecks;
  const ctx = { lang: input.lang, related: input.related, question: input.question, xl: input.xl, strengths: input.strengths };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      draft = await callModel(input, model, problem);
    } catch {
      draft = null;
      break;
    }
    if (!input.noGuards) draft = { ...draft, answer: input.lang === 'ar' ? polishArabic(stripCiteTags(draft.answer)) : stripCiteTags(draft.answer) };
    const checks = checkAnswer(draft.answer, draft.cites, [...input.genes, ...input.xl], ctx);
    if (draft.answer && (input.noGuards || allOk(checks))) {
      // Someone who says they are scared or worried hears that first, and is offered a person.
      if (!input.noGuards && worried) return { ...draft, answer: `${lead()} ${draft.answer}`, escalate: true, urgent: false, route: 'model', checks, model, ms: Date.now() - t0 };
      return { ...draft, urgent: false, route: 'model', checks, model, ms: Date.now() - t0 };
    }
    onReject?.(draft.answer, checks);
    failed = checks;
    problem = problems(checks);
  }
  // A worried person whose answer failed gets the help card too.
  return { answer: worried ? `${lead()} ${say(SAFE_FALLBACK)}` : say(SAFE_FALLBACK), cites: ['counsellor'], escalate: true, urgent: worried, route: 'fallback', checks: failed, model, ms: Date.now() - t0 };
}
