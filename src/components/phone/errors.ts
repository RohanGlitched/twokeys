// What the person reads when something stops. The server's `error` text is English for logs and tests;
// the phone shows its own words for each stable `code`, in the reader's language and grammatical
// gender. An unknown code falls back to the English text in English, and to a general line in Arabic.
import type { L, T } from './PhoneApp';

export const ERR: Record<string, L> = {
  rate_limited: { en: 'The demo is busy. Wait a minute, then try again.', ar: 'العرض مشغول. انتظر دقيقة، ثم حاول مجدداً.', arF: 'العرض مشغول. انتظري دقيقة، ثم حاولي مجدداً.' },
  stopped: { en: 'Your partner stopped this comparison. Nothing about either of you was shown.', ar: 'أوقفت شريكتك هذه المقارنة. ولم يُعرض شيء عن أي منكما.', arF: 'أوقف شريكك هذه المقارنة. ولم يُعرض شيء عن أي منكما.' },
  stopped_by_me: { en: 'You stopped this comparison. Nothing about you was shown.', ar: 'أوقفت هذه المقارنة. ولم يُعرض عنك شيء.', arF: 'أوقفتِ هذه المقارنة. ولم يُعرض عنك شيء.' },
  seat_taken: { en: 'Someone else has already joined this comparison. Start a new one with your partner.', ar: 'انضم شخص آخر إلى هذه المقارنة. ابدأ مقارنة جديدة مع شريكتك.', arF: 'انضم شخص آخر إلى هذه المقارنة. ابدئي مقارنة جديدة مع شريكك.' },
  link_expired: { en: 'This link has expired. Links work for 10 minutes; start a new comparison.', ar: 'انتهت صلاحية هذا الرابط. يعمل الرابط 10 دقائق؛ ابدأ مقارنة جديدة.', arF: 'انتهت صلاحية هذا الرابط. يعمل الرابط 10 دقائق؛ ابدئي مقارنة جديدة.' },
  open_case: { en: 'You already have an open request for this comparison. A genetic counsellor will contact you.', ar: 'لديك طلب مفتوح لهذه المقارنة. سيتواصل معك مرشد وراثي.' },
  not_joined: { en: 'Your partner hasn’t joined yet. Share the link again, or start over.', ar: 'لم تنضم شريكتك بعد. شارك الرابط مجدداً، أو ابدأ من جديد.', arF: 'لم ينضم شريكك بعد. شاركي الرابط مجدداً، أو ابدئي من جديد.' },
  not_confirmed: { en: 'Your partner hasn’t confirmed yet. Ask them to check their screen, or start over.', ar: 'لم تؤكد شريكتك بعد. اطلب منها أن تنظر إلى شاشتها، أو ابدأ من جديد.', arF: 'لم يؤكد شريكك بعد. اطلبي منه أن ينظر إلى شاشته، أو ابدئي من جديد.' },
  timeout: { en: 'Your partner’s phone stopped answering. Start a new comparison when you are both ready.', ar: 'توقف هاتف شريكتك عن الرد. ابدأ مقارنة جديدة عندما تكونان مستعدين.', arF: 'توقف هاتف شريكك عن الرد. ابدئي مقارنة جديدة عندما تكونان مستعدين.' },
  not_in_pairing: { en: 'This phone isn’t part of this comparison. Start a new one with your partner.', ar: 'هذا الهاتف ليس جزءاً من هذه المقارنة. ابدأ مقارنة جديدة مع شريكتك.', arF: 'هذا الهاتف ليس جزءاً من هذه المقارنة. ابدئي مقارنة جديدة مع شريكك.' },
  incomplete: { en: 'This comparison is incomplete. Start a new one.', ar: 'هذه المقارنة غير مكتملة. ابدأ مقارنة جديدة.', arF: 'هذه المقارنة غير مكتملة. ابدئي مقارنة جديدة.' },
  no_match: { en: 'The lab couldn’t confirm the comparison, so nothing was named. Start a new one.', ar: 'لم يستطع المختبر تأكيد المقارنة، لذلك لم يُسمَّ شيء. ابدأ مقارنة جديدة.', arF: 'لم يستطع المختبر تأكيد المقارنة، لذلك لم يُسمَّ شيء. ابدئي مقارنة جديدة.' },
  signed_out: { en: 'You were signed out. Start over to sign in again.', ar: 'انتهت جلستك. ابدأ من جديد لتسجيل الدخول مرة أخرى.', arF: 'انتهت جلستك. ابدئي من جديد لتسجيل الدخول مرة أخرى.' },
  offline: { en: 'The connection dropped. Check your connection and try again.', ar: 'انقطع الاتصال. تحقق من الاتصال وحاول مجدداً.', arF: 'انقطع الاتصال. تحققي من الاتصال وحاولي مجدداً.' },
};
/** Codes that mean the same thing to the person. */
const ALIAS: Record<string, string> = {
  busy: 'rate_limited', too_many: 'rate_limited', expired: 'link_expired', session_expired: 'link_expired',
  partner_timeout: 'timeout', not_recognised: 'stopped_by_me', mismatch: 'no_match', lab_mismatch: 'no_match',
  unauthorized: 'signed_out', bad_identity: 'signed_out', identity_expired: 'signed_out', already_open: 'open_case',
};
const GENERAL: L = { en: 'Something went wrong. Start over to try again.', ar: 'حدث خطأ. ابدأ من جديد للمحاولة مرة أخرى.', arF: 'حدث خطأ. ابدئي من جديد للمحاولة مرة أخرى.' };

/** The code an error or an API reply carries, if any. */
export const codeOf = (x: unknown): string | undefined => {
  const c = x && typeof x === 'object' && 'code' in x ? (x as { code?: unknown }).code : undefined;
  return typeof c === 'string' ? c : undefined;
};

/** The person's words for an error: by code, else the English text in English, else a general line. */
export function errorText(t: T, lang: 'en' | 'ar', code: string | undefined, english?: string, general: L = GENERAL): string {
  const known = code ? ERR[code] ?? ERR[ALIAS[code] ?? ''] : undefined;
  if (known) return t(known);
  if (lang === 'en' && english && english !== 'Cancelled.') return english;
  return t(general);
}
