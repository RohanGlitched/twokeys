// The phase-1 pilot in one screen: design, size, primary outcome, timeline and price. The numbers match
// BUSINESS.md (pilot design and three-year plan); change them there first.
import type { Locale } from '@/i18n/locales';

type L = { en: string; ar: string };

const ROWS: { term: L; body: L }[] = [
  {
    term: { en: 'Design', ar: 'التصميم' },
    body: {
      en: 'Randomised, 1:1: usual care, or usual care plus Two Keys. Randomised by extended family, so related couples land in the same arm. Only couples with new results join (at all 22 centres), because older results have already been explained and families may already have talked.',
      ar: 'تجربة عشوائية بنسبة 1:1: الرعاية المعتادة، أو الرعاية المعتادة مع مفتاحين. التوزيع بحسب العائلة الممتدة، فيقع الأزواج الأقارب في الذراع نفسها. ولا ينضم إلا الأزواج ذوو النتائج الجديدة (في كل المراكز الـ22)، لأن النتائج الأقدم شُرحت بالفعل وربما تحدثت الأسر فيها.',
    },
  },
  {
    term: { en: 'Size', ar: 'الحجم' },
    body: {
      en: 'About 145 couples are newly found at increased chance in six months of recruitment. If three in four agree, about 110 join: 55 per arm, with about 660 married relatives listed. That detects a rise from 20% to 35% of relatives tested (80% power, 5% significance), assuming relatives in one family correlate at 0.25. If fewer agree, recruitment runs two months longer, as registered in advance.',
      ar: 'يُكتشف نحو 145 زوجاً باحتمال أعلى خلال ستة أشهر من التسجيل. وإن وافق ثلاثة من كل أربعة ينضم نحو 110: أي 55 في كل ذراع، مع نحو 660 قريباً متزوجاً مسجّلاً. ويكفي ذلك لكشف ارتفاع نسبة الأقارب الذين أجروا الفحص من 20% إلى 35% (قوة 80%، ودلالة 5%)، بافتراض ارتباط قدره 0.25 بين أقارب العائلة الواحدة. وإن قلّت الموافقات يمتد التسجيل شهرين، كما سُجّل مسبقاً.',
    },
  },
  {
    term: { en: 'Primary outcome', ar: 'النتيجة الرئيسية' },
    body: {
      en: 'Married relatives of reproductive age, and their spouses, listed from a family tree drawn at enrolment in both arms, who have a carrier test within six months. Read from lab records (a read-only Malaffi extract), not from the app. The pilot pays for a targeted test of the family’s known change for relatives in both arms, because married relatives are outside the premarital mandate.',
      ar: 'الأقارب المتزوجون في سن الإنجاب وأزواجهم، المسجّلون من شجرة عائلة تُرسم عند الانضمام في الذراعين، الذين يجرون فحص الصفة الوراثية خلال ستة أشهر. ويُقرأ ذلك من سجلات المختبر (مستخرج من ملفي للقراءة فقط)، لا من التطبيق. وتدفع التجربة كلفة فحص موجّه للتغيّر المعروف في العائلة لأقارب الذراعين، لأن الأقارب المتزوجين خارج إلزام فحص ما قبل الزواج.',
    },
  },
  {
    term: { en: 'Understanding', ar: 'الفهم' },
    body: {
      en: 'Target: 15 percentage points more people with good knowledge than in usual care, on an 8-item knowledge measure adapted from the Multidimensional Measure of Informed Choice and validated in Arabic and English before the pilot starts.',
      ar: 'الهدف: زيادة 15 نقطة مئوية في نسبة من لديهم معرفة جيدة مقارنة بالرعاية المعتادة، بمقياس معرفة من 8 أسئلة مقتبس من المقياس متعدد الأبعاد للاختيار المستنير، ويُتحقق من صلاحيته بالعربية والإنجليزية قبل بدء التجربة.',
    },
  },
  {
    term: { en: 'Timeline', ar: 'الجدول الزمني' },
    body: {
      en: 'Months 0–6: approvals (DoH sandbox, ethics, data protection impact assessment, UAE hosting, security audit, content sign-off by the operator’s counsellors). Months 6–12: recruitment. Months 12–18: follow-up and analysis. Months 18–30: matching across labs. From month 30: procurement and all centres.',
      ar: 'الأشهر 0 إلى 6: الموافقات (بيئة الدائرة التجريبية، والأخلاقيات، وتقييم أثر حماية البيانات، والاستضافة في الإمارات، وتدقيق الأمان، واعتماد المحتوى من مرشدي الجهة المشغّلة). الأشهر 6 إلى 12: التسجيل. الأشهر 12 إلى 18: المتابعة والتحليل. الأشهر 18 إلى 30: المطابقة بين المختبرات. ومن الشهر 30: الشراء وكل المراكز.',
    },
  },
  {
    term: { en: 'Price', ar: 'السعر' },
    body: {
      en: 'No licence fee during the pilot unless the operator signs a paid pilot (AED 150,000 for months 6–18). After procurement: AED 200,000 a year plus AED 30 per screened couple, licensed into the operator’s screening contract, with a quarter of the yearly fee at risk against uptime, notification time, the knowledge margin and the share of couples who send a family note.',
      ar: 'لا رسوم ترخيص أثناء التجربة ما لم توقّع الجهة المشغّلة على تجربة مدفوعة (150,000 درهم للأشهر 6 إلى 18). وبعد الشراء: 200,000 درهم سنوياً و30 درهماً لكل زوجين يُفحصان، ضمن عقد الفحص لدى الجهة المشغّلة، مع ربط ربع الرسم السنوي بمدة التشغيل، وزمن الإشعار، وفارق المعرفة، ونسبة الأزواج الذين يرسلون رسالة عائلية.',
    },
  },
];

export function Pilot({ lang }: { lang: Locale }) {
  const t = (l: L) => l[lang];
  return (
    <section id="pilot" className="mt-20 border-t-[1.5px] border-ink pt-8">
      <h2 className="text-[clamp(24px,2.6vw,32px)] font-semibold tracking-tight">{t({ en: 'The pilot', ar: 'التجربة' })}</h2>
      <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-ink-2">
        {t({ en: 'How the numbers above would be tested against usual care before anything is bought. Every input below is an assumption the pilot measures.', ar: 'كيف تُختبر الأرقام أعلاه مقابل الرعاية المعتادة قبل أي شراء. وكل مدخل أدناه افتراض تقيسه التجربة.' })}
      </p>
      <dl className="mt-6 grid gap-px border border-ink bg-ink md:grid-cols-2">
        {ROWS.map((r) => (
          <div key={r.term.en} className="bg-wool p-5">
            <dt className="text-[13px] font-semibold uppercase tracking-wide text-ink-2">{t(r.term)}</dt>
            <dd className="mt-2 text-[15px] leading-relaxed">{t(r.body)}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
