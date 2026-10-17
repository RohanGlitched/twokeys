'use client';
// The programme view for the health authority: counselling, understanding and family-cascade numbers.
// Live demo traffic comes from the weekly differentially private release (/api/metrics). The synthetic
// month is an emirate-wide illustration sized from the programme's published numbers (./synthetic),
// kept apart and always labelled.
import { useEffect, useState, type ReactNode } from 'react';
import type { Locale } from '@/i18n/locales';
import { SYNTHETIC_MONTH as S } from './synthetic';

type L = { en: string; ar: string };
type Cell = { value: number | null; suppressed: boolean };
interface Counselling { booked: Cell; contacted: Cell; overdue: Cell; withdrawn: Cell; referred: Cell; medianHoursToFirstContact: number | null; withinTarget: number | null; arabicShare: number | null }
type Understanding = Record<'en' | 'ar' | 'simple' | 'standard' | 'detailed', { people: number | null; allThreeRight: number | null }>;
interface Family { notes: Cell; readShared: Cell; booked: Cell }
type Source = 'live' | 'seededSynthetic';
interface M {
  week: number;
  privacy: { epsilonPerCount: number; epsilonThisRelease: number; epsilonPerPersonLifetime: number; releases: number; minimumCell: number; letterCap: number; refreshed: string };
  counselling: Record<Source, Counselling>;
  understanding: Record<Source, Understanding>;
  family: Record<Source, Family>;
}

const fmt = (lang: Locale) => new Intl.NumberFormat(lang === 'ar' ? 'ar-AE' : 'en-GB');

function Num({ c, lang }: { c: Cell; lang: Locale }) {
  if (c.suppressed || c.value === null) return <span className="text-ink-2" title={lang === 'ar' ? 'أقل من 5، محجوب' : 'Fewer than 5, hidden'}>{lang === 'ar' ? 'أقل من 5' : 'under 5'}</span>;
  return <>{fmt(lang).format(c.value)}</>;
}
const pct = (x: number | null, lang: Locale) => (x === null ? (lang === 'ar' ? 'محجوب' : 'hidden') : `${fmt(lang).format(Math.round(x * 100))}%`);

export function Programme({ lang }: { lang: Locale }) {
  const t = (l: L) => l[lang];
  const [m, setM] = useState<M | null>(null);
  const [src, setSrc] = useState<Source | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    fetch('/api/metrics').then((r) => r.json()).then((j: M) => {
      setM(j);
      // Open on live data once there is enough of it to show; otherwise on the labelled synthetic month.
      setSrc(j.counselling.live.booked.suppressed ? 'seededSynthetic' : 'live');
    }).catch(() => setFailed(true));
  }, []);
  if (failed) return <p className="text-[15px] text-ink-2">{t({ en: 'The numbers could not load. Reload the page.', ar: 'تعذّر تحميل الأرقام. أعد تحميل الصفحة.' })}</p>;
  if (!m || !src) return <div role="status" className="h-64 animate-pulse bg-wool-2 motion-reduce:animate-none"><span className="sr-only">Loading… / جارٍ التحميل…</span></div>;
  const synthetic = src === 'seededSynthetic';
  const c = m.counselling.live, f = m.family.live;
  const nf = fmt(lang);
  const share = (k: number, n: number) => `${nf.format(Math.round((100 * k) / n))}%`;
  const h = (x: number | null) => (x === null ? t({ en: 'hidden', ar: 'محجوب' }) : lang === 'ar' ? `${nf.format(x)} س` : `${x} h`);
  const big = (n: number) => <>{nf.format(n)}</>;
  const of = (k: number, n: number) => <>{nf.format(k)}<span className="text-[20px] font-normal text-ink-2">{lang === 'ar' ? ` من ${nf.format(n)}` : ` of ${nf.format(n)}`}</span></>;
  const notInDemo: L = { en: 'Not measured in the demo', ar: 'لا يُقاس في العرض' };
  const targets: L = { en: 'Targets: urgent 4 h, pregnancy 1 working day, routine 2 working days', ar: 'المهل: العاجل 4 س، والحمل يوم عمل، والروتيني يوما عمل' };
  const sc = S.counselling, sf = S.family, sk = S.cascade;
  // Same tiles in both views; each is labelled with what it counts, so "within target" (of those
  // reached) and "past target" (not yet reached) can't be read as contradicting each other.
  const tiles: { label: L; value: ReactNode; hint: L; key?: boolean }[] = synthetic ? [
    { label: { en: 'Couples with results this month', ar: 'أزواج وصلتهم نتائجهم هذا الشهر' }, value: big(S.couplesWithResults), hint: { en: `The lab reports ${S.couplesAtIncreasedChance} at increased chance (4.8%); the service never learns which`, ar: `يبلّغ المختبر أن ${nf.format(S.couplesAtIncreasedChance)} منهم باحتمال أعلى (4.8%)، ولا تعرف الخدمة أيهم` } },
    { label: { en: 'Counselling calls booked', ar: 'مكالمات استشارة محجوزة' }, value: big(sc.booked), hint: { en: `${sc.bookedByCouplesAtIncreasedChance} of the ${S.couplesAtIncreasedChance} couples at increased chance, plus ${sc.booked - sc.bookedByCouplesAtIncreasedChance} people asking about their own results`, ar: `${nf.format(sc.bookedByCouplesAtIncreasedChance)} من ${nf.format(S.couplesAtIncreasedChance)} زوجاً باحتمال أعلى، و${nf.format(sc.booked - sc.bookedByCouplesAtIncreasedChance)} أشخاص يسألون عن نتائجهم` } },
    { label: { en: 'Median time to first contact', ar: 'الوسيط حتى أول تواصل' }, value: h(sc.medianHoursToFirstContact), hint: { en: `Of the ${sc.reached} reached, ${sc.reachedWithinTarget} within target (${share(sc.reachedWithinTarget, sc.reached)}) and ${sc.reachedLate} late`, ar: `من ${nf.format(sc.reached)} تم التواصل معهم، ${nf.format(sc.reachedWithinTarget)} ضمن المهلة (${share(sc.reachedWithinTarget, sc.reached)}) و${nf.format(sc.reachedLate)} متأخرين` } },
    { label: { en: 'Not yet reached and past target, at month end', ar: 'لم يُتواصل معهم وتجاوزوا المهلة، في نهاية الشهر' }, value: big(sc.notYetReachedPastTarget), hint: targets },
    { label: { en: 'Referred to reproductive genetics or confirmation', ar: 'أحيلت إلى الوراثة الإنجابية أو التأكيد' }, value: big(sc.referred), hint: { en: 'A referral is an offer, not an outcome we count', ar: 'الإحالة عرض، وليست نتيجة نحصيها' } },
    { label: { en: 'Couples at increased chance who sent a family note', ar: 'أزواج باحتمال أعلى أرسلوا رسالة عائلية' }, value: of(sf.couplesSendingANote, S.couplesAtIncreasedChance), hint: { en: `${sf.notesSent} notes in all. Senders are counted by a one-way code, never by name`, ar: `${nf.format(sf.notesSent)} رسالة إجمالاً. يُحتسب المرسلون برمز أحادي الاتجاه، لا بالاسم أبداً` } },
    { label: { en: 'Relatives who said they booked a test', ar: 'أقارب أخبروا بأنهم حجزوا فحصاً' }, value: big(sf.relativesSaidBooked), hint: { en: 'Only if the relative chose to say so', ar: 'فقط إن اختار القريب الإخبار بذلك' } },
    { key: true, label: { en: 'Pilot primary outcome: married relatives listed at enrolment who had a carrier test within 6 months', ar: 'النتيجة الرئيسية للتجربة: أقارب متزوجون سُجّلوا عند الانضمام وأجروا فحص الصفة الوراثية خلال 6 أشهر' }, value: of(sk.relativesTestedWithin6Months, sk.marriedRelativesListed), hint: { en: `${sk.cohort.en}, ${sk.couplesEnrolled} couples (${share(sk.relativesTestedWithin6Months, sk.marriedRelativesListed)}). From lab records in both trial arms, not from the app`, ar: `${sk.cohort.ar}، ${nf.format(sk.couplesEnrolled)} زوجاً (${share(sk.relativesTestedWithin6Months, sk.marriedRelativesListed)}). من سجلات المختبر في ذراعي التجربة، لا من التطبيق` } },
  ] : [
    { label: { en: 'Couples with results this week', ar: 'أزواج وصلتهم نتائجهم هذا الأسبوع' }, value: '—', hint: { en: 'Comes from the lab, not from this demo', ar: 'يأتي من المختبر، لا من هذا العرض' } },
    { label: { en: 'Counselling calls booked', ar: 'مكالمات استشارة محجوزة' }, value: <Num c={c.booked} lang={lang} />, hint: { en: 'Each with an itemised, versioned, logged consent', ar: 'كل منها بموافقة مفصّلة ومرقّمة ومسجّلة' } },
    { label: { en: 'Reached within target', ar: 'تم التواصل ضمن المهلة' }, value: pct(c.withinTarget, lang), hint: { en: 'Share of those already reached; medians are not published for live data', ar: 'نسبة من تم التواصل معهم؛ ولا تُنشر الوسيطات للبيانات الفعلية' } },
    { label: { en: 'Not yet reached and past target', ar: 'لم يُتواصل معهم وتجاوزوا المهلة' }, value: <Num c={c.overdue} lang={lang} />, hint: targets },
    { label: { en: 'Referred to reproductive genetics or confirmation', ar: 'أحيلت إلى الوراثة الإنجابية أو التأكيد' }, value: <Num c={c.referred} lang={lang} />, hint: { en: 'A referral is an offer, not an outcome we count', ar: 'الإحالة عرض، وليست نتيجة نحصيها' } },
    { label: { en: 'Family notes sent', ar: 'رسائل عائلية مرسلة' }, value: <Num c={f.notes} lang={lang} />, hint: { en: 'Senders unknown to the service', ar: 'المرسلون مجهولون للخدمة' } },
    { label: { en: 'Relatives who said they booked a test', ar: 'أقارب أخبروا بأنهم حجزوا فحصاً' }, value: <Num c={f.booked} lang={lang} />, hint: { en: 'Only if the relative chose to say so', ar: 'فقط إن اختار القريب الإخبار بذلك' } },
    { key: true, label: { en: 'Pilot primary outcome: married relatives listed at enrolment who had a carrier test within 6 months', ar: 'النتيجة الرئيسية للتجربة: أقارب متزوجون سُجّلوا عند الانضمام وأجروا فحص الصفة الوراثية خلال 6 أشهر' }, value: '—', hint: notInDemo },
  ];
  type Row = { people: number | null; allThreeRight: number | null };
  const u: Record<'en' | 'ar' | 'simple' | 'standard' | 'detailed', Row> = synthetic
    ? (Object.fromEntries(Object.entries(S.understanding).map(([k, v]) => [k, { people: v.people, allThreeRight: v.allThreeRight / v.people }])) as Record<'en' | 'ar' | 'simple' | 'standard' | 'detailed', Row>)
    : m.understanding.live;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t({ en: 'Which data', ar: 'أي بيانات' })}>
        {([['live', { en: 'Live demo traffic', ar: 'استخدام العرض الفعلي' }], ['seededSynthetic', { en: 'Synthetic month (illustration)', ar: 'شهر افتراضي (للتوضيح)' }]] as const).map(([k, l]) => (
          <button key={k} aria-pressed={src === k} onClick={() => setSrc(k)} className={`rounded-[2px] border px-3.5 py-2 text-[14px] ${src === k ? 'border-ink bg-ink text-wool' : 'border-ink-3 text-ink-2 hover:border-ink'}`}>{t(l)}</button>
        ))}
        <span className="ms-auto text-[12px] text-ink-2">{synthetic ? t({ en: `Synthetic month: ${S.month.en}, all 22 centres`, ar: `شهر افتراضي: ${S.month.ar}، كل المراكز الـ22` }) : t({ en: `Release for last week (${m.privacy.releases} so far), published weekly`, ar: `إصدار الأسبوع الماضي (${m.privacy.releases} حتى الآن)، يُنشر أسبوعياً` })}</span>
      </div>
      <p className={`mt-3 border-s-4 px-3 py-2 text-[13px] leading-relaxed ${synthetic ? 'border-camel bg-paper' : 'border-sage bg-paper'}`}>
        {synthetic
          ? t({ en: `Synthetic: a made-up month for the whole emirate (all 22 centres, ${S.couplesWithResults} couples with results, ${S.couplesAtIncreasedChance} of them at increased chance), sized from the programme’s published numbers. Values are exact; a real release adds privacy noise of about ±10 to each count, so numbers this small are read over a quarter. These are not real people or results.`, ar: `افتراضي: شهر مختلق للإمارة كلها (كل المراكز الـ22، و${nf.format(S.couplesWithResults)} زوج وصلتهم نتائجهم، منهم ${nf.format(S.couplesAtIncreasedChance)} باحتمال أعلى)، بأحجام مأخوذة من أرقام البرنامج المنشورة. القيم دقيقة؛ ويضيف الإصدار الحقيقي ضجيج خصوصية بنحو ±10 لكل عدد، لذا تُقرأ الأعداد بهذا الصغر على مدى ربع سنة. هذه ليست أشخاصاً أو نتائج حقيقية.` })
          : t({ en: 'Live: what people using this demo have actually done (synthetic identities, real clicks). Small numbers stay hidden until there are at least 5.', ar: 'فعلي: ما قام به مستخدمو هذا العرض فعلاً (هويات افتراضية ونقرات حقيقية). وتبقى الأعداد الصغيرة محجوبة حتى تبلغ 5 على الأقل.' })}
      </p>

      <div className="mt-5 grid gap-px border border-ink bg-ink sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((x) => (
          <div key={x.label.en} className={x.key ? 'bg-paper p-5' : 'bg-wool p-5'}>
            <p className="text-[13px] text-ink-2">{t(x.label)}</p>
            <p className="mt-2 text-[40px] font-semibold leading-none tracking-tight">{x.value}</p>
            <p className="mt-2 text-[12px] text-ink-2">{t(x.hint)}</p>
          </div>
        ))}
      </div>
      {synthetic ? (
        <p className="mt-3 text-[13px] text-ink-2">{t({ en: `Booked in Arabic: ${share(sc.bookedInArabic, sc.booked)}. Consent withdrawn: ${sc.withdrawn}. Every booking is accounted for: ${sc.reached} reached, ${sc.notYetReachedPastTarget} not yet reached, ${sc.withdrawn} withdrawn.`, ar: `حُجز بالعربية: ${share(sc.bookedInArabic, sc.booked)}. سُحبت الموافقة: ${nf.format(sc.withdrawn)}. وكل حجز محسوب: ${nf.format(sc.reached)} تم التواصل معهم، و${nf.format(sc.notYetReachedPastTarget)} لم يُتواصل معه بعد، و${nf.format(sc.withdrawn)} سحب موافقته.` })}</p>
      ) : c.arabicShare !== null && (
        <p className="mt-3 text-[13px] text-ink-2">{t({ en: `Booked in Arabic: ${pct(c.arabicShare, 'en')}. Consent withdrawn: `, ar: `حُجز بالعربية: ${pct(c.arabicShare, 'ar')}. سُحبت الموافقة: ` })}<Num c={c.withdrawn} lang={lang} />.</p>
      )}

      <h2 className="mt-14 text-[26px] font-semibold tracking-tight">{t({ en: 'Understanding, by language and reading level', ar: 'الفهم بحسب اللغة ومستوى القراءة' })}</h2>
      <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-ink-2">{t({ en: 'Share of people who answered all three teach-back questions right first time. Equity means these bars should look the same in Arabic and English, and at every reading level. A gap is a signal to rewrite that version.', ar: 'نسبة من أجابوا عن أسئلة التحقق الثلاثة إجابة صحيحة من المحاولة الأولى. والعدالة تعني أن تتشابه هذه الأشرطة بالعربية والإنجليزية وفي كل مستوى قراءة، وأي فجوة إشارة لإعادة كتابة تلك النسخة.' })}</p>
      <div className="mt-6 grid gap-3">
        {([['ar', { en: 'Arabic', ar: 'العربية' }], ['en', { en: 'English', ar: 'الإنجليزية' }], ['simple', { en: 'Simple', ar: 'مبسّط' }], ['standard', { en: 'Standard', ar: 'عادي' }], ['detailed', { en: 'Detailed', ar: 'مفصّل' }]] as const).map(([k, label]) => {
          const x = u[k];
          return (
            <div key={k} className="grid grid-cols-[96px_1fr_120px] items-center gap-4 text-[14px]">
              <span>{t(label)}</span>
              <div className="h-3 bg-wool-2"><div className="h-3 bg-sage" style={{ width: x.allThreeRight === null ? 0 : `${x.allThreeRight * 100}%` }} /></div>
              <span className="text-end text-ink-2">{pct(x.allThreeRight, lang)}{x.people !== null && <span className="text-[12px]">{t({ en: ` of ${x.people}`, ar: ` من ${fmt(lang).format(x.people)}` })}</span>}</span>
            </div>
          );
        })}
      </div>

      <div className="mt-14 grid gap-8 border-t-[1.5px] border-ink pt-8 md:grid-cols-2">
        <div>
          <h2 className="text-[22px] font-semibold tracking-tight">{t({ en: 'How these numbers protect people', ar: 'كيف تحمي هذه الأرقام الناس' })}</h2>
          <ul className="mt-3 list-disc space-y-2 ps-5 text-[14px] leading-relaxed text-ink-2">
            <li>{t({ en: `Each person counts once: their first teach-back, their first booking, and at most ${m.privacy.letterCap} family notes ever. Every count carries exact random noise (differential privacy, ε = ${m.privacy.epsilonPerCount} per count; ε = ${m.privacy.epsilonThisRelease} in this release).`, ar: `يُحتسب كل شخص مرة واحدة: أول اختبار فهم، وأول حجز، و${m.privacy.letterCap} رسائل عائلية على الأكثر طوال الوقت. ويحمل كل عدد ضجيجاً عشوائياً دقيقاً (الخصوصية التفاضلية، ε = ${m.privacy.epsilonPerCount} لكل عدد؛ وε = ${m.privacy.epsilonThisRelease} في هذا الإصدار).` })}</li>
            <li>{t({ en: `Groups smaller than ${m.privacy.minimumCell} are hidden, and rates and medians appear only above that size.`, ar: `تُحجب المجموعات الأصغر من ${m.privacy.minimumCell}، ولا تظهر النسب والوسيطات إلا فوق هذا الحجم.` })}</li>
            <li>{t({ en: `Each weekly release counts only that week’s records and is written once to a ledger, so later releases can’t be averaged against it. A person is counted once ever for bookings and teach-back, and for at most five family notes. Asking again returns the same numbers. So the guarantee for any one person is ε = ${m.privacy.epsilonPerPersonLifetime} for life, however many releases there are.`, ar: `يحتسب كل إصدار أسبوعي سجلات ذلك الأسبوع فقط ويُكتب مرة واحدة في سجل دائم، فلا يمكن حساب متوسطه مع إصدارات لاحقة. ويُحتسب الشخص مرة واحدة فقط في الحجوزات واختبار الفهم، وفي خمس رسائل عائلية على الأكثر. وإعادة الطلب تعيد الأرقام نفسها. لذا فضمان أي شخص هو ε = ${m.privacy.epsilonPerPersonLifetime} مدى الحياة، مهما كثرت الإصدارات.` })}</li>
            <li>{t({ en: 'Medians are shown only for the synthetic month: they can’t be noised safely at this scale. Counsellors see their exact queue on the desk; only these published numbers are noised.', ar: 'تظهر الوسيطات للشهر الافتراضي فقط، إذ لا يمكن إضافة الضجيج إليها بأمان على هذا النطاق. ويرى المرشدون قائمتهم الدقيقة في المكتب، ولا يُضاف الضجيج إلا لهذه الأرقام المنشورة.' })}</li>
            <li>{t({ en: 'The service never learns which couples share a gene unless they book. The comparison happens on their phones; the lab names matches only to the two people paired.', ar: 'لا تعرف الخدمة أي زوجين يتشاركان جيناً إلا إذا حجزا. فالمقارنة تجري على هاتفيهما، ولا يسمّي المختبر التطابق إلا للشخصين المقترنين.' })}</li>
          </ul>
        </div>
        <div>
          <h2 className="text-[22px] font-semibold tracking-tight">{t({ en: 'Never counted', ar: 'لا يُحصى أبداً' })}</h2>
          <p className="mt-3 text-[14px] leading-relaxed text-ink-2">{t({ en: 'Marriages, called off or not. Pregnancy decisions. Individual results. Which couples are at increased chance. Success is measured by whether couples were reached, understood, and offered care, never by any personal choice they made.', ar: 'الزيجات، أُلغيت أم لا. وقرارات الحمل. والنتائج الفردية. وأي الأزواج باحتمال أعلى. يُقاس النجاح بوصول الأزواج وفهمهم وعرض الرعاية عليهم، ولا يُقاس أبداً بأي خيار شخصي اتخذوه.' })}</p>
        </div>
      </div>
    </div>
  );
}
