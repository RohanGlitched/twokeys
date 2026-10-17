'use client';
// A family note, opened on the relative's phone with the key in the link's #fragment. The relative
// alone decides whether the sender may know that it was read, or that a test was booked.
import { useEffect, useState } from 'react';
import type { Locale } from '@/i18n/locales';
import { conditionFor } from '@/lib/conditions';
import { openLetter, per100, type LetterBody, type Relation } from '@/lib/letters';
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

export function LetterView({ lang, id }: { lang: Locale; id: string }) {
  const t = (l: L) => l[lang];
  const [body, setBody] = useState<LetterBody | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [told, setTold] = useState<{ read?: boolean; booked?: boolean }>({});

  useEffect(() => {
    const key = window.location.hash.slice(1);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser-only value, read once after hydration
    if (!key) { setErr(t({ en: 'This link is incomplete. Ask for the full link.', ar: 'هذا الرابط ناقص. اطلب الرابط كاملاً.' })); return; }
    (async () => {
      try {
        const r = await fetch(`/api/family/${id}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setBody(await openLetter(j.c, key));
        try { setTold(JSON.parse(localStorage.getItem(`told:${id}`) ?? '{}')); } catch {}
      } catch (e) {
        setErr(e instanceof Error && e.message ? e.message : t({ en: 'This letter could not be opened.', ar: 'تعذّر فتح هذه الرسالة.' }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Each acknowledgement is sent once per device, and only when the relative taps it.
  const tell = async (kind: 'read' | 'booked') => {
    if (told[kind]) return;
    const r = await fetch(`/api/family/${id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind }) });
    if (!r.ok && r.status !== 429) return;
    const next = { ...told, [kind]: true };
    setTold(next);
    try { localStorage.setItem(`told:${id}`, JSON.stringify(next)); } catch {}
  };

  const c = body ? conditionFor(body.gene) : null;
  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <div className="flex items-center gap-2 text-ink-2"><Mark size={22} /><span className="text-[14px]">{t({ en: 'Two Keys: a note from your family', ar: 'مفتاحان: رسالة من عائلتك' })}</span></div>
      {err && <p role="alert" className="mt-8 border-s-4 border-madder bg-madder-2 px-4 py-3">{err}</p>}
      {!body && !err && <div className="mt-8 h-40 animate-pulse bg-wool-2" />}
      {body && (
        <article className="mt-6">
          <div className="overflow-hidden rounded-[3px] border border-ink"><Sadu height={44} motifs={11} seed={4} /></div>
          <h1 className="mt-6 text-[30px] font-semibold leading-tight tracking-tight">
            {t({ en: 'Someone in your family wanted you to know this.', ar: 'أراد أحد أفراد عائلتك أن تعرف هذا.' })}
          </h1>
          <p className="mt-4 text-[17px] leading-relaxed">
            {t({ en: `A relative of yours found out they are a healthy carrier of a change in the ${body.gene} gene${c ? `, linked to ${c.name.en}` : ''}.`, ar: `تبيّن لأحد أقاربك أنه يحمل تغيّراً في جين ${body.gene}${c ? ` المرتبط بـ${c.name.ar}` : ''}، وهو بصحة جيدة.` })}
          </p>
          {body.chance === null ? (
            <p className="mt-5 border-y border-ink py-4 text-[16px] leading-relaxed">
              {t({ en: 'This change is on the X chromosome. Women in the family may carry it without symptoms, and men in the family may have the condition. Your own chance depends on how you are related and on who in the family carries it; a genetic counsellor can work it out with a simple test.', ar: 'هذا التغيّر على الكروموسوم X. قد تحمله نساء العائلة دون أعراض، وقد يُصاب به رجالها. ويعتمد احتمالك على صلة قرابتك وعلى من يحمله في العائلة، ويمكن للمرشد الوراثي حسابه بفحص بسيط.' })}
            </p>
          ) : (
          <div className="mt-6 grid grid-cols-2 border-y border-ink">
            <div className="border-e border-rule py-4 pe-4">
              <p className="text-[30px] font-semibold leading-tight tracking-tight"><bdi>{per100(body.chance, lang)}</bdi></p>
              <p className="text-[13px] text-ink-2">{t({ en: `your chance of also carrying it, as their ${RELATION_NAME[body.relation].en}`, ar: `احتمال أن تكون حاملاً لهذا التغيّر أيضاً، بصفتك ${RELATION_AS[body.relation]}` })}</p>
            </div>
            <div className="py-4 ps-4">
              <p className="text-[30px] font-semibold leading-tight tracking-tight text-ink-2"><bdi>{body.population !== null ? per100(body.population, lang) : t({ en: 'not known', ar: 'غير معروف' })}</bdi></p>
              <p className="text-[13px] text-ink-2">{t({ en: 'for someone with no relative known to carry it', ar: 'لشخص لا يُعرف أن أحد أقاربه يحمل هذا التغيّر' })}</p>
            </div>
          </div>
          )}
          <p className="mt-5 text-[15px] leading-relaxed text-ink-2">
            {t({ en: 'Being a carrier is not a disease, and it usually doesn’t affect your own health. It matters if you plan a family with someone who carries the same gene. A carrier test is part of premarital screening, and your doctor or any premarital screening centre can arrange one at any time. Ask the genetic counsellor to look for your family’s exact change, as some tests miss some changes.', ar: 'أن تكون حاملاً للتغيّر لا يعني أنك مريض، ولا يؤثر عادة في صحتك. ويهم إذا خططت لتكوين أسرة مع شخص يحمل الجين نفسه. وفحص حاملي الصفة الوراثية جزء من الفحص قبل الزواج، ويمكن لطبيبك أو أي مركز للفحص قبل الزواج ترتيبه في أي وقت. واطلب من المرشد الوراثي أن يسأل عن التغيّر المحدد في عائلتك، فبعض الفحوص لا تكشف كل التغيّرات.' })}
          </p>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
            <a className="text-indigo underline underline-offset-2" href="https://www.doh.gov.ae/" target="_blank" rel="noreferrer">{t({ en: 'Department of Health, Abu Dhabi', ar: 'دائرة الصحة، أبوظبي' })}</a>
            {c && <a className="text-indigo underline underline-offset-2" href={c.source.url} target="_blank" rel="noreferrer">{c.source.label}</a>}
          </p>
          <div className="mt-8 border-t border-ink pt-5">
            <p className="text-[15px] font-medium">{t({ en: 'Do you want them to know?', ar: 'هل تريد أن يعرف من أرسلها؟' })}</p>
            <p className="mt-1 text-[13px] text-ink-2">{t({ en: 'Only if you choose. They see a number go up, never your name. Nothing has been sent yet.', ar: 'فقط إن اخترت ذلك. يرى المرسل عدداً يزداد، ولا يرى اسمك أبداً. ولم يُرسل شيء بعد.' })}</p>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              <button onClick={() => tell('read')} disabled={told.read} className="rounded-[2px] border border-ink px-4 py-3 text-[15px] font-medium disabled:opacity-60">
                {told.read ? t({ en: 'They’ll know you read it', ar: 'سيعرف المرسل أنك قرأتها' }) : t({ en: 'Let them know I read this', ar: 'أخبر المرسل أنني قرأتها' })}
              </button>
              <button onClick={() => tell('booked')} disabled={told.booked} className="rounded-[2px] bg-ink px-4 py-3 text-[15px] font-medium text-wool disabled:opacity-60">
                {told.booked ? t({ en: 'They’ll know you booked a test', ar: 'سيعرف المرسل أنك حجزت فحصاً' }) : t({ en: 'Let them know I booked a test', ar: 'أخبر المرسل أنني حجزت فحصاً' })}
              </button>
            </div>
          </div>
          <p className="mt-8 border-t border-rule pt-4 text-[13px] leading-relaxed text-ink-2">
            {t({ en: 'Who sent this? They chose not to be named, and this service does not know who they are: the letter was sealed on their phone before it reached us. The buttons above only add one to an anonymous count that the sender can see.', ar: 'من أرسل هذا؟ اختار المرسل ألا يُذكر اسمه، وهذه الخدمة لا تعرف هويته: خُتمت الرسالة على هاتفه قبل أن تصلنا. والزران أعلاه يضيفان واحداً فقط إلى عدد مجهول يراه المرسل.' })}
          </p>
        </article>
      )}
    </main>
  );
}
