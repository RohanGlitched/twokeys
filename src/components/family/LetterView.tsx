'use client';
// A family note, opened on the relative's phone with the key in the link's #fragment. The relative
// alone decides whether the sender may know that it was read, or that a test was booked.
// A note is shown only when the screening lab's signature on its facts checks out: the lab signed the
// gene, relation and inheritance after checking the gene is in the sender's own results (api/family), and
// this page rebuilds those facts from the sealed body. A note without it, or one that says something
// else, is not shown.
import { useEffect, useState } from 'react';
import { ed25519 } from '@noble/curves/ed25519.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import type { Locale } from '@/i18n/locales';
import { conditionFor } from '@/lib/conditions';
import { checkLetter, labTagged, naturalFrequency, noteDigest, openLetter, type LetterBody, type Relation } from '@/lib/letters';
import { Mark } from '@/components/glyphs';
import { Sadu } from '@/components/Sadu';

type L = { en: string; ar: string };
export const RELATION_NAME: Record<Relation, L> = {
  sibling: { en: 'brother or sister', ar: 'أخ أو أخت' },
  parent: { en: 'parent', ar: 'أحد الوالدين' },
  child: { en: 'son or daughter', ar: 'ابن أو ابنة' },
  'half-sibling': { en: 'half-brother or half-sister', ar: 'أخ غير شقيق أو أخت غير شقيقة' },
  'aunt-uncle': { en: 'aunt or uncle', ar: 'عمّ أو عمّة أو خال أو خالة' },
  'niece-nephew': { en: 'niece or nephew', ar: 'ابن أو ابنة أخ أو أخت' },
  'first-cousin': { en: 'first cousin', ar: 'ابن أو ابنة عمّ أو عمّة أو خال أو خالة' },
};
/** The same, after بصفتك (accusative). */
const RELATION_AS: Record<Relation, string> = {
  sibling: 'أخاً أو أختاً', parent: 'أحدَ الوالدين', child: 'ابناً أو ابنةً', 'half-sibling': 'أخاً غير شقيق أو أختاً غير شقيقة',
  'aunt-uncle': 'عمّاً أو عمّةً أو خالاً أو خالةً', 'niece-nephew': 'ابنَ أو ابنةَ أخ أو أخت', 'first-cousin': 'ابنَ أو ابنةَ عمّ أو عمّة أو خال أو خالة',
};

const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const unb64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
/** The acknowledgement token, HMAC(letter key, 'ack'): only someone holding the link's #fragment can make it. */
export const ackToken = (key: string) => hex(hmac(sha256, unb64u(key), new TextEncoder().encode('ack')));
/** What the sender registers with the letter (POST /api/family { c, ack }), so the server can check tokens without the key. */
export const ackHash = (key: string) => hex(sha256(new TextEncoder().encode(ackToken(key))));

const unhex = (s: string) => Uint8Array.from(s.match(/../g) ?? [], (x) => parseInt(x, 16));
/** True if the lab's signature (from the note's record) covers exactly the facts in this sealed body. */
function labChecked(b: LetterBody, sig: unknown, day: unknown, pub: unknown): boolean {
  if (!b.nonce || typeof sig !== 'string' || !/^[0-9a-f]{128}$/.test(sig) || typeof day !== 'number' || typeof pub !== 'string' || !/^[0-9a-f]{64}$/.test(pub)) return false;
  try {
    const digest = noteDigest({ gene: b.gene, relation: b.relation, inheritance: b.inheritance ?? 'AR', nonce: b.nonce, day });
    return ed25519.verify(unhex(sig), labTagged('family-note', digest), unhex(pub));
  } catch { return false; }
}

export function LetterView({ lang, id }: { lang: Locale; id: string }) {
  const t = (l: L) => l[lang];
  const [body, setBody] = useState<LetterBody | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // The note exists (the link reached a record), so it can be reported even if it can't be shown.
  const [found, setFound] = useState(false);
  const [told, setTold] = useState<{ read?: boolean; booked?: boolean; report?: boolean }>({});

  useEffect(() => {
    const key = window.location.hash.slice(1);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only value, read once after hydration
    if (!key) { setErr(t({ en: 'This link is incomplete. Ask for the full link.', ar: 'هذا الرابط ناقص. يلزم الرابط كاملاً.' })); return; }
    (async () => {
      try {
        const [r, k] = await Promise.all([fetch(`/api/family/${id}`), fetch('/api/lab/key').catch(() => null)]);
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setFound(true);
        try { setTold(JSON.parse(localStorage.getItem(`told:${id}`) ?? '{}')); } catch {}
        // Never show a sealed body as it came: only a letter rebuilt from checked facts (lib/letters.checkLetter),
        // and only when the lab's signature covers those facts.
        const checked = checkLetter(await openLetter(j.c, key));
        const pub = k?.ok ? ((await k.json().catch(() => ({}))) as { publicKey?: string }).publicKey : undefined;
        if (!checked || !labChecked(checked, j.sig, j.day, pub)) { setErr(t({ en: 'This note could not be checked, so it isn’t shown. Ask the person who sent it for a new link, or talk to a genetic counsellor.', ar: 'تعذّر التحقق من هذه الرسالة، لذا لا تُعرض. اطلب رابطاً جديداً ممن أرسلها، أو تحدّث إلى مرشد وراثي.' })); return; }
        setBody(checked);
      } catch (e) {
        setErr(e instanceof Error && e.message ? e.message : t({ en: 'This letter could not be opened.', ar: 'تعذّر فتح هذه الرسالة.' }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Each acknowledgement (or report) is sent once per device, and only when the relative taps it.
  const tell = async (kind: 'read' | 'booked' | 'report') => {
    if (told[kind]) return;
    const r = await fetch(`/api/family/${id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind, token: ackToken(window.location.hash.slice(1)) }) });
    if (!r.ok && r.status !== 429) return;
    const next = { ...told, [kind]: true };
    setTold(next);
    try { localStorage.setItem(`told:${id}`, JSON.stringify(next)); } catch {}
  };

  const c = body ? conditionFor(body.gene) : null;
  // A report only adds one to a counter on the note; nothing about the relative is sent.
  const report = (
    <p className="mt-4 text-[13px]">
      {told.report
        ? <span role="status" className="text-ink-2">{t({ en: 'Reported. Thank you. The service counts reports; it still can’t read the note.', ar: 'تم الإبلاغ، شكراً لك. تَعُدّ الخدمة البلاغات، ولا تستطيع قراءة الرسالة.' })}</span>
        : <button onClick={() => tell('report')} className="min-h-11 text-ink-2 underline underline-offset-4">{t({ en: 'Report this note', ar: 'الإبلاغ عن هذه الرسالة' })}</button>}
    </p>
  );
  return (
    <main id="main" className="mx-auto max-w-xl px-6 py-10">
      <div className="flex items-center justify-between gap-3 text-ink-2">
        <div className="flex items-center gap-2"><Mark size={22} /><span className="text-[14px]">{t({ en: 'Two Keys: a note from your family', ar: 'مفتاحان: رسالة من عائلتك' })}</span></div>
        {/* The note is the same in both languages: the key stays in the fragment, which never reaches the server. */}
        <button onClick={() => window.location.assign(`/${lang === 'ar' ? 'en' : 'ar'}/r/${id}${window.location.hash}`)} lang={lang === 'ar' ? 'en' : 'ar'} className="min-h-11 rounded-[2px] border border-rule px-3 text-[14px] text-ink">{lang === 'ar' ? 'English' : 'العربية'}</button>
      </div>
      {err && <p role="alert" className="mt-8 border-s-4 border-alert bg-alert-2 px-4 py-3">{err}</p>}
      {err && found && report}
      {!body && !err && <div role="status" className="mt-8 h-40 animate-pulse bg-wool-2"><span className="sr-only">{t({ en: 'Loading…', ar: 'جارٍ التحميل…' })}</span></div>}
      {body && (
        <article className="mt-6">
          <div className="overflow-hidden rounded-[3px] border border-ink"><Sadu height={44} motifs={11} seed={4} /></div>
          <p className="mt-5 inline-flex min-h-8 items-center gap-2 rounded-[2px] border border-sage bg-sage-2 px-3 py-1 text-[13px] font-medium">
            <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden><path d="M3 8.5l3 3 7-7" stroke="currentColor" strokeWidth="1.8" fill="none" /></svg>
            {t({ en: 'Checked by the screening lab', ar: 'تحقّق منها مختبر الفحص' })}
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{t({ en: 'Before this note was made, the lab confirmed that the gene is in the sender’s own results, and signed what the note says.', ar: 'قبل إنشاء هذه الرسالة، أكّد المختبر أن الجين في نتائج المرسل نفسه، ووقّع على ما تقوله الرسالة.' })}</p>
          <h1 className="mt-5 text-[30px] font-semibold leading-tight tracking-tight">
            {t({ en: 'Someone in your family wanted you to know this.', ar: 'أراد أحد أفراد عائلتك إطلاعك على هذا.' })}
          </h1>
          <p className="mt-4 text-[17px] leading-relaxed">
            {body.chance === null
              ? t({ en: `A relative of yours found out they have a change in the ${body.gene} gene, on the X chromosome${c ? `, linked to ${c.name.en}` : ''}.`, ar: `تبيّن لأحد أقاربك أن لديه تغيّراً في جين ${body.gene} على الكروموسوم X${c ? `، المرتبط بـ${c.name.ar}` : ''}.` })
              : t({ en: `A relative of yours found out they are a healthy carrier of a change in the ${body.gene} gene${c ? `, linked to ${c.name.en}` : ''}.`, ar: `تبيّن لأحد أقاربك أنه يحمل تغيّراً في جين ${body.gene}${c ? ` المرتبط بـ${c.name.ar}` : ''}، وهو بصحة جيدة.` })}
          </p>
          {body.chance === null ? (
            <p className="mt-5 border-y border-ink py-4 text-[16px] leading-relaxed">
              {t({ en: 'This change is on the X chromosome. Men in the family may have the condition. Women in the family may carry it, and for some genes (for example G6PD, OTC, GLA and ABCD1) women who carry it can have symptoms of their own. Your own chance depends on how you are related and on who in the family carries it; a genetic counsellor can work it out with a simple test.', ar: 'هذا التغيّر على الكروموسوم X. قد يُصاب بالحالة رجال العائلة. وقد تحمله نساؤها، وفي بعض الجينات (مثل G6PD وOTC وGLA وABCD1) قد تظهر أعراض لدى النساء الحاملات له. ويعتمد احتمالك على صلة قرابتك وعلى من يحمله في العائلة، ويمكن للمرشد الوراثي حسابه بفحص بسيط.' })}
            </p>
          ) : (
          <div className="mt-6 grid grid-cols-2 border-y border-ink">
            <div className="border-e border-rule py-4 pe-4">
              <p className="text-[30px] font-semibold leading-tight tracking-tight"><bdi>{naturalFrequency(body.chance, lang)}</bdi></p>
              <p className="text-[13px] text-ink-2">{t({ en: `your chance of also carrying it, as their ${RELATION_NAME[body.relation].en}`, ar: `احتمال حملك لهذا التغيّر أيضاً، بصفتك ${RELATION_AS[body.relation]}` })}</p>
            </div>
            <div className="py-4 ps-4">
              <p className="text-[30px] font-semibold leading-tight tracking-tight text-ink-2"><bdi>{body.population !== null ? naturalFrequency(body.population, lang) : t({ en: 'not known', ar: 'غير معروف' })}</bdi></p>
              <p className="text-[13px] text-ink-2">{t({ en: 'for someone with no relative known to carry it', ar: 'لشخص لا يُعرف أن أحد أقاربه يحمل هذا التغيّر' })}</p>
            </div>
          </div>
          )}
          <p className="mt-5 text-[15px] leading-relaxed text-ink-2">
            {body.chance === null
              ? t({ en: 'A test can show whether you carry or have it. Your doctor or any premarital screening centre can arrange one at any time. Ask the genetic counsellor to look for your family’s exact change, as some tests miss some changes.', ar: 'يمكن لفحص أن يبيّن إن كان التغيّر لديك. ويمكن لطبيبك أو أي مركز للفحص قبل الزواج ترتيبه في أي وقت. ويمكن أن يُطلب من المرشد الوراثي البحث عن التغيّر المحدد في العائلة، فبعض الفحوص لا تكشف كل التغيّرات.' })
              : t({ en: 'Being a carrier is not a disease, and it usually doesn’t affect your own health. It matters if you plan a family with someone who carries the same gene. A carrier test is part of premarital screening, and your doctor or any premarital screening centre can arrange one at any time. Ask the genetic counsellor to look for your family’s exact change, as some tests miss some changes.', ar: 'حمل التغيّر ليس مرضاً، ولا يؤثر عادة في صحة حامله. ويهم عند التخطيط لتكوين أسرة مع شخص يحمل الجين نفسه. وفحص حاملي الصفة الوراثية جزء من الفحص قبل الزواج، ويمكن لطبيبك أو أي مركز للفحص قبل الزواج ترتيبه في أي وقت. ويمكن أن يُطلب من المرشد الوراثي البحث عن التغيّر المحدد في العائلة، فبعض الفحوص لا تكشف كل التغيّرات.' })}
          </p>
          {/* The one thing to do next: talk to someone who can arrange the test. */}
          <a href="https://www.doh.gov.ae/" target="_blank" rel="noreferrer" className="mt-6 flex min-h-12 w-full items-center justify-center rounded-[2px] bg-ink px-5 py-3.5 text-center text-[16px] font-medium text-wool">
            {t({ en: 'Talk to a genetic counsellor or find a screening centre', ar: 'تحدّث إلى مرشد وراثي أو اعثر على مركز للفحص' })}
          </a>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
            <span className="text-ink-2">{t({ en: 'Department of Health, Abu Dhabi: screening centres and counselling', ar: 'دائرة الصحة، أبوظبي: مراكز الفحص والإرشاد الوراثي' })}</span>
            {c && <a className="text-indigo underline underline-offset-2" href={c.source.url} target="_blank" rel="noreferrer">{c.source.label}</a>}
          </p>
          <div className="mt-8 border-t border-rule pt-5">
            <p className="text-[14px] font-medium">{t({ en: 'Do you want them to know? (optional)', ar: 'إعلام المرسل (اختياري): القرار لك وحدك.' })}</p>
            <p className="mt-1 text-[13px] text-ink-2">{t({ en: 'Only if you choose. They see a number go up, never your name. Nothing has been sent yet.', ar: 'فقط إن اخترت ذلك. يرى المرسل عدداً يزداد، ولا يرى اسمك أبداً. ولم يُرسل شيء بعد.' })}</p>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              <button onClick={() => tell('read')} disabled={told.read} className="min-h-11 rounded-[2px] border border-ink-3 px-4 py-2.5 text-[14px] disabled:opacity-60">
                {told.read ? t({ en: 'They’ll know you read it', ar: 'سيعرف المرسل أنك قرأتها' }) : t({ en: 'Let them know I read this', ar: 'إعلام المرسل بأنني قرأتها' })}
              </button>
              <button onClick={() => tell('booked')} disabled={told.booked} className="min-h-11 rounded-[2px] border border-ink-3 px-4 py-2.5 text-[14px] disabled:opacity-60">
                {told.booked ? t({ en: 'They’ll know you booked a test', ar: 'سيعرف المرسل أنك حجزت فحصاً' }) : t({ en: 'Let them know I booked a test', ar: 'إعلام المرسل بأنني حجزت فحصاً' })}
              </button>
            </div>
          </div>
          <p className="mt-8 border-t border-rule pt-4 text-[13px] leading-relaxed text-ink-2">
            {t({ en: 'Who sent this? They chose not to be named, and this service does not keep who they are: the letter was sealed on their phone before it reached us, and nothing stored with it names the sender. The buttons above only add one to an anonymous count that the sender can see.', ar: 'من أرسل هذا؟ اختار المرسل ألا يُذكر اسمه، وهذه الخدمة لا تحتفظ بهويته: خُتمت الرسالة على هاتفه قبل أن تصلنا، ولا شيء مما يُحفظ معها يسمّي المرسل. والزران أعلاه يضيفان واحداً فقط إلى عدد مجهول يراه المرسل.' })}
          </p>
          {report}
        </article>
      )}
    </main>
  );
}
