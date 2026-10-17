'use client';
import { useEffect, useState } from 'react';
import type { Locale } from '@/i18n/locales';
import { conditionFor } from '@/lib/conditions';
import { oneIn, openLetter, type LetterBody, type Relation } from '@/lib/letters';
import { Mark } from '@/components/glyphs';
import { Sadu } from '@/components/Sadu';

type L = { en: string; ar: string };
export const RELATION_NAME: Record<Relation, L> = {
  sibling: { en: 'brother or sister', ar: 'أخ أو أخت' },
  parent: { en: 'parent', ar: 'أحد الوالدين' },
  child: { en: 'son or daughter', ar: 'ابن أو ابنة' },
  'half-sibling': { en: 'half-brother or half-sister', ar: 'أخ أو أخت غير شقيق' },
  'aunt-uncle': { en: 'aunt or uncle', ar: 'عم أو عمة أو خال أو خالة' },
  'niece-nephew': { en: 'niece or nephew', ar: 'ابن أو ابنة أخ أو أخت' },
  'first-cousin': { en: 'first cousin', ar: 'ابن عم أو خال من الدرجة الأولى' },
};

export function LetterView({ lang, id }: { lang: Locale; id: string }) {
  const t = (l: L) => l[lang];
  const [body, setBody] = useState<LetterBody | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [booked, setBooked] = useState(false);

  useEffect(() => {
    const key = window.location.hash.slice(1);
    if (!key) { setErr(t({ en: 'This link is incomplete. Ask for the full link.', ar: 'هذا الرابط ناقص. اطلب الرابط كاملاً.' })); return; }
    (async () => {
      try {
        const r = await fetch(`/api/family/${id}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j.error);
        setBody(await openLetter(j.c, key));
        fetch(`/api/family/${id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'opened' }) });
      } catch (e) {
        setErr(e instanceof Error && e.message ? e.message : t({ en: 'This letter could not be opened.', ar: 'تعذّر فتح هذه الرسالة.' }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const book = async () => {
    await fetch(`/api/family/${id}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: 'booked' }) });
    setBooked(true);
  };

  const c = body ? conditionFor(body.gene) : null;
  return (
    <main className="mx-auto max-w-xl px-6 py-10">
      <div className="flex items-center gap-2 text-ink-2"><Mark size={22} /><span className="text-[14px]">{t({ en: 'Two Keys · a note from your family', ar: 'مفتاحان · رسالة من عائلتك' })}</span></div>
      {err && <p role="alert" className="mt-8 border-l-4 border-madder bg-madder-2 px-4 py-3">{err}</p>}
      {!body && !err && <div className="mt-8 h-40 animate-pulse bg-wool-2" />}
      {body && (
        <article className="mt-6">
          <div className="overflow-hidden rounded-[3px] border border-ink"><Sadu height={44} motifs={11} seed={4} /></div>
          <h1 className="mt-6 text-[30px] font-semibold leading-tight tracking-tight">
            {t({ en: 'Someone in your family wanted you to know this.', ar: 'أراد أحد أفراد عائلتك أن تعرف هذا.' })}
          </h1>
          <p className="mt-4 text-[17px] leading-relaxed">
            {t({ en: `They found out they are a healthy carrier of a change in the ${body.gene} gene${c ? `, linked to ${c.name.en}` : ''}.`, ar: `علموا أنهم حاملون أصحاء لتغيّر في جين ${body.gene}${c ? `، المرتبط بـ${c.name.ar}` : ''}.` })}
          </p>
          <div className="mt-6 grid grid-cols-2 border-y border-ink">
            <div className="border-e border-rule py-4 pe-4">
              <p className="text-[34px] font-semibold tracking-tight">{oneIn(body.chance)}</p>
              <p className="text-[13px] text-ink-2">{t({ en: `your chance of carrying it, as their ${RELATION_NAME[body.relation].en}`, ar: `احتمال أن تحمله، بصفتك ${RELATION_NAME[body.relation].ar}` })}</p>
            </div>
            <div className="py-4 ps-4">
              <p className="text-[34px] font-semibold tracking-tight text-ink-2">{body.population ? oneIn(body.population) : '—'}</p>
              <p className="text-[13px] text-ink-2">{t({ en: 'for someone with no relative known to carry it', ar: 'لشخص ليس له قريب معروف بحمله' })}</p>
            </div>
          </div>
          <p className="mt-5 text-[15px] leading-relaxed text-ink-2">
            {t({ en: 'Being a carrier is not a disease, and it does not affect your own health. It matters if you plan a family with someone who carries the same gene. A carrier test is part of premarital screening, and a doctor can arrange one at any time.', ar: 'الحمل الجيني ليس مرضاً، ولا يؤثر على صحتك. ويهم إذا خططت لتكوين أسرة مع شخص يحمل الجين نفسه. فحص الحمل الجيني جزء من الفحص قبل الزواج، ويمكن للطبيب ترتيبه في أي وقت.' })}
          </p>
          {c && <a className="mt-3 inline-block text-[13px] text-indigo underline underline-offset-2" href={c.source.url} target="_blank" rel="noreferrer">{c.source.label}</a>}
          <div className="mt-8 flex flex-col gap-3">
            <button onClick={book} disabled={booked} className="rounded-[2px] bg-ink px-5 py-4 text-[16px] font-medium text-wool disabled:opacity-60">
              {booked ? t({ en: 'Thank you. Noted, without your name.', ar: 'شكراً. سُجّل ذلك من دون اسمك.' }) : t({ en: 'I’ve booked a carrier test', ar: 'حجزت فحص الحمل الجيني' })}
            </button>
          </div>
          <p className="mt-8 border-t border-rule pt-4 text-[13px] leading-relaxed text-ink-3">
            {t({ en: 'Who sent this? They chose not to be named, and this service does not know who they are: the letter was sealed on their phone before it reached us. Tapping the button only adds one to an anonymous count they can see.', ar: 'من أرسل هذا؟ اختار المرسل ألا يُذكر اسمه، وهذه الخدمة لا تعرف هويته: خُتمت الرسالة على هاتفه قبل أن تصلنا. والضغط على الزر يضيف واحداً إلى عدد مجهول يراه المرسل فقط.' })}
          </p>
        </article>
      )}
    </main>
  );
}
