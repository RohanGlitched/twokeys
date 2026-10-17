'use client';
import { useEffect, useState } from 'react';
import type { Locale } from '@/i18n/locales';

type L = { en: string; ar: string };
type Cell = { value: number | null; suppressed: boolean };
interface M {
  privacy: { epsilon: number; minimumCell: number };
  counselling: { booked: Cell; contacted: Cell; overdue: Cell; withdrawn: Cell; medianHoursToFirstContact: number | null; referred: Cell; medianDaysToReferral: number | null; arabicShare: number | null };
  understanding: Record<'en' | 'ar' | 'simple' | 'standard' | 'detailed', { people: Cell; allThreeRight: number | null }>;
  family: { notes: Cell; opened: Cell; booked: Cell };
}

function Num({ c, lang }: { c: Cell; lang: Locale }) {
  if (c.suppressed || c.value === null) return <span className="text-ink-3" title={lang === 'ar' ? 'أقل من 5، محجوب' : 'Fewer than 5, suppressed'}>{'<5'}</span>;
  return <>{c.value.toLocaleString(lang === 'ar' ? 'ar-AE' : 'en-US')}</>;
}
const pct = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`);

export function Programme({ lang }: { lang: Locale }) {
  const t = (l: L) => l[lang];
  const [m, setM] = useState<M | null>(null);
  useEffect(() => { fetch('/api/metrics').then((r) => r.json()).then(setM).catch(() => {}); }, []);
  if (!m) return <div className="h-64 animate-pulse bg-wool-2" />;
  const tiles: { label: L; value: React.ReactNode; hint: L }[] = [
    { label: { en: 'Counselling calls booked', ar: 'مكالمات استشارة محجوزة' }, value: <Num c={m.counselling.booked} lang={lang} />, hint: { en: 'Each with an itemised, logged consent', ar: 'كل منها بموافقة مفصّلة ومسجلة' } },
    { label: { en: 'Median time to first contact', ar: 'الوسيط حتى أول تواصل' }, value: m.counselling.medianHoursToFirstContact === null ? '—' : `${Math.round(m.counselling.medianHoursToFirstContact)} h`, hint: { en: 'Target: within 2 working days', ar: 'الهدف: خلال يومي عمل' } },
    { label: { en: 'Overdue right now', ar: 'متأخرة الآن' }, value: <Num c={m.counselling.overdue} lang={lang} />, hint: { en: 'Past the 2-working-day target', ar: 'تجاوزت هدف يومي العمل' } },
    { label: { en: 'Referred to reproductive genetics or confirmation', ar: 'أحيلت إلى الوراثة الإنجابية أو التأكيد' }, value: <Num c={m.counselling.referred} lang={lang} />, hint: { en: m.counselling.medianDaysToReferral === null ? 'Median time to referral: —' : `Median ${m.counselling.medianDaysToReferral.toFixed(1)} days from booking`, ar: m.counselling.medianDaysToReferral === null ? 'الوسيط حتى الإحالة: —' : `الوسيط ${m.counselling.medianDaysToReferral.toFixed(1)} يوم من الحجز` } },
    { label: { en: 'Family notes sent', ar: 'رسائل عائلية مرسلة' }, value: <Num c={m.family.notes} lang={lang} />, hint: { en: 'Senders unknown to the service', ar: 'المرسلون مجهولون للخدمة' } },
    { label: { en: 'Relatives who booked a test', ar: 'أقارب حجزوا فحصاً' }, value: <Num c={m.family.booked} lang={lang} />, hint: { en: 'Counted without names', ar: 'تُحصى دون أسماء' } },
  ];
  return (
    <div>
      <div className="grid gap-px border border-ink bg-ink sm:grid-cols-2 lg:grid-cols-3">
        {tiles.map((x) => (
          <div key={x.label.en} className="bg-wool p-5">
            <p className="text-[13px] text-ink-2">{t(x.label)}</p>
            <p className="mt-2 text-[40px] font-semibold leading-none tracking-tight">{x.value}</p>
            <p className="mt-2 text-[12px] text-ink-3">{t(x.hint)}</p>
          </div>
        ))}
      </div>

      <h2 className="mt-14 text-[26px] font-semibold tracking-tight">{t({ en: 'Understanding, by language and reading level', ar: 'الفهم بحسب اللغة ومستوى القراءة' })}</h2>
      <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-2">{t({ en: 'Share of people who answered all three teach-back questions correctly. Equity means these bars should look the same in Arabic and English, and at every reading level.', ar: 'نسبة من أجابوا على أسئلة إعادة الشرح الثلاثة إجابة صحيحة. والعدالة تعني أن تتشابه هذه الأشرطة بالعربية والإنجليزية وفي كل مستوى قراءة.' })}</p>
      <div className="mt-6 grid gap-3">
        {([['ar', { en: 'Arabic', ar: 'العربية' }], ['en', { en: 'English', ar: 'الإنجليزية' }], ['simple', { en: 'Simple', ar: 'مبسّط' }], ['standard', { en: 'Standard', ar: 'عادي' }], ['detailed', { en: 'Detailed', ar: 'مفصّل' }]] as const).map(([k, label]) => {
          const u = m.understanding[k];
          return (
            <div key={k} className="grid grid-cols-[110px_1fr_90px] items-center gap-4 text-[14px]">
              <span>{t(label)}</span>
              <div className="h-3 bg-wool-2"><div className="h-3 bg-sage" style={{ width: u.allThreeRight === null ? 0 : `${u.allThreeRight * 100}%` }} /></div>
              <span className="text-end text-ink-2">{u.allThreeRight === null ? <span title="suppressed">n &lt; 5</span> : pct(u.allThreeRight)}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-14 grid gap-8 border-t-[1.5px] border-ink pt-8 md:grid-cols-2">
        <div>
          <h2 className="text-[22px] font-semibold tracking-tight">{t({ en: 'How these numbers protect people', ar: 'كيف تحمي هذه الأرقام الناس' })}</h2>
          <ul className="mt-3 space-y-2 text-[14px] leading-relaxed text-ink-2">
            <li>{t({ en: `Every count carries random noise (differential privacy, ε = ${m.privacy.epsilon}), so no single person changes what you see.`, ar: `يحمل كل عدد ضجيجاً عشوائياً (الخصوصية التفاضلية، ε = ${m.privacy.epsilon})، فلا يغيّر شخص واحد ما تراه.` })}</li>
            <li>{t({ en: `Groups smaller than ${m.privacy.minimumCell} are hidden.`, ar: `تُحجب المجموعات الأصغر من ${m.privacy.minimumCell}.` })}</li>
            <li>{t({ en: 'The service never learns which couples share a gene: the comparison happens on their phones. It knows only those who chose to book.', ar: 'لا تعرف الخدمة أبداً أي زوجين يتشاركان جيناً، فالمقارنة تجري على هاتفيهما. ولا تعرف إلا من اختار الحجز.' })}</li>
          </ul>
        </div>
        <div>
          <h2 className="text-[22px] font-semibold tracking-tight">{t({ en: 'Never counted', ar: 'لا يُحصى أبداً' })}</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-2">{t({ en: 'Marriages, cancelled or not. Individual results. Which couples are at increased chance. The challenge is explicit that success must not rest on any single personal choice, and this view is built so it can’t.', ar: 'الزيجات، ملغاة أو غير ملغاة. والنتائج الفردية. وأي الأزواج باحتمال أعلى. فالتحدي صريح بأن النجاح يجب ألا يقوم على أي خيار شخصي واحد، وهذا العرض مبني بحيث لا يستطيع ذلك.' })}</p>
        </div>
      </div>
    </div>
  );
}
