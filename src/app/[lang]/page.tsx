import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasLocale, type Locale } from '@/i18n/locales';
import { Footer, Nav } from '@/components/site/Chrome';
import { HeroWeave } from '@/components/landing/HeroWeave';
import { Diamond, Person } from '@/components/glyphs';
import { Sadu } from '@/components/Sadu';

type L = { en: string; ar: string };

const FACTS: { n: L; label: L; src: string; href: string }[] = [
  { n: { en: '1 in 13', ar: '1 من 13' }, label: { en: 'couples in Dubai’s first 1,000 screened carried the same gene (79, or 7.9%, including alpha-thalassaemia)', ar: 'من أول ألف زوج فُحصوا في دبي يحملان الجين نفسه (79 زوجاً أو 7.9%، بما فيه ألفا ثلاسيميا)' }, src: 'Nature Medicine 2026', href: 'https://www.nature.com/articles/s41591-026-04251-7' },
  { n: { en: '565', ar: '565' }, label: { en: 'of 11,748 Abu Dhabi couples screened 2022 to July 2026 had an increased chance (4.8%)', ar: 'من 11,748 زوجاً فُحصوا في أبوظبي بين 2022 ويوليو 2026 كان لديهم احتمال أعلى (4.8%)' }, src: 'DoH, via Gulf News', href: 'https://gulfnews.com/uae/health/abu-dhabi-genetic-screening-flags-565-incompatible-cases-among-couples-1.500697261' },
  { n: { en: '0.1', ar: '0.1' }, label: { en: 'genetic counsellors per million people in the Arab region (US: 12)', ar: 'مرشد وراثي لكل مليون شخص في المنطقة العربية (الولايات المتحدة: 12)' }, src: 'J Genet Couns 2021', href: 'https://pmc.ncbi.nlm.nih.gov/articles/PMC8611926' },
];

const GAPS: { title: L; body: L }[] = [
  { title: { en: 'A result reaches the family before it reaches understanding', ar: 'تصل النتيجة إلى العائلة قبل أن يصل الفهم' },
    body: { en: 'Today one partner’s carrier status can travel to the other, and to both families, before anyone has explained that being a carrier is not a disease. The challenge asks for the opposite: no exposure of one family member’s information without permission.', ar: 'اليوم قد تنتقل حالة أحد الشريكين إلى الآخر وإلى العائلتين قبل أن يشرح أحد أن من يحمل تغيّراً جينياً ليس مريضاً. والتحدي يطلب العكس: ألا تُكشف معلومات أي فرد دون إذنه.' } },
  { title: { en: 'Too few people to explain it', ar: 'قلة من يشرحون' },
    body: { en: 'Abu Dhabi has trained hundreds of physicians to counsel because specialists are scarce. Every couple still needs the same careful explanation, in their language, at their reading level.', ar: 'درّبت أبوظبي مئات الأطباء على الاستشارة لندرة المتخصصين. ولا يزال كل زوجين يحتاجان الشرح الدقيق نفسه، بلغتهما وبمستوى قراءتهما.' } },
  { title: { en: 'Relatives rarely hear about it', ar: 'نادراً ما يعلم الأقارب' },
    body: { en: 'In consanguineous families relatives share variants, yet in one US study only 6% of first-degree relatives went on to be tested. People hesitate to name themselves.', ar: 'في العائلات ذات القرابة يتشارك الأقارب المتغيرات، ومع ذلك لم يُفحص في إحدى الدراسات الأمريكية إلا 6% من الأقارب من الدرجة الأولى. يتردد الناس في كشف أنفسهم.' } },
];

const LEARNS: { who: L; learns: L; never: L }[] = [
  { who: { en: 'Each partner', ar: 'كل شريك' }, learns: { en: 'The genes they both carry, explained', ar: 'الجينات التي يحملانها معاً، مع شرحها' }, never: { en: 'Any other gene the other carries, or how many', ar: 'أي جين آخر يحمله الآخر، أو عددها' } },
  { who: { en: 'The relay server', ar: 'خادم الوسيط' }, learns: { en: 'That two phones exchanged three encrypted messages', ar: 'أن هاتفين تبادلا ثلاث رسائل مشفّرة' }, never: { en: 'Any gene, any token, or the result', ar: 'أي جين أو رمز أو النتيجة' } },
  { who: { en: 'The lab', ar: 'المختبر' }, learns: { en: 'That this couple paired, and the match it confirms (it already holds both results, as today)', ar: 'أن هذين الزوجين اقترنا، والتطابق الذي يؤكده (فهو يملك النتيجتين أصلاً، كما اليوم)' }, never: { en: 'Anything new about either person', ar: 'أي شيء جديد عن أي منهما' } },
  { who: { en: 'A counsellor', ar: 'المرشد الوراثي' }, learns: { en: 'Only the items a person ticked when booking', ar: 'البنود التي اختارها الشخص عند الحجز فقط' }, never: { en: 'Anything after consent is withdrawn', ar: 'أي شيء بعد سحب الموافقة' } },
  { who: { en: 'Relatives', ar: 'الأقارب' }, learns: { en: 'A gene and their own chance of carrying it', ar: 'الجين واحتمال أن يحملوه' }, never: { en: 'Who sent the note', ar: 'من أرسل الرسالة' } },
  { who: { en: 'The health system', ar: 'النظام الصحي' }, learns: { en: 'Counts: understanding, uptake, time to referral', ar: 'أعداد: الفهم، والإقبال، وزمن الإحالة' }, never: { en: 'Any individual, or any marriage decision', ar: 'أي فرد، أو أي قرار زواج' } },
];

export default async function Home({ params }: PageProps<'/[lang]'>) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = (l: L) => l[lang];
  return (
    <>
      <Nav lang={lang} />
      <main id="main">
        {/* hero */}
        <section className="mx-auto grid max-w-[1240px] items-center gap-12 px-6 pb-16 pt-6 md:grid-cols-[5fr_6fr] md:px-8 md:pt-10">
          <div>
            <h1 className="text-[clamp(38px,4.6vw,64px)] font-semibold leading-[1.04] tracking-[-0.035em]">
              {t({ en: 'Know what you could pass on together.', ar: 'اعرفا ما قد تنقلانه معاً.' })}
            </h1>
            <p className="mt-6 max-w-[34em] text-[18px] leading-relaxed text-ink-2">
              {t({ en: 'Every carrier result understood, acted on in time, and passed safely to relatives, without needing more counsellors. A couple compares results inside their own phones and learns only the genes they both carry, explained in plain Arabic or English, with a genetic counsellor one tap away. Neither learns any other gene the other carries, and their families learn nothing.', ar: 'كل نتيجة لحمل الصفة الوراثية مفهومة، ويُتصرف بها في وقتها، وتصل بأمان إلى الأقارب، دون الحاجة إلى مزيد من المرشدين. يقارن الزوجان النتائج داخل هاتفيهما ولا يعرفان إلا الجينات التي يحملانها معاً، مشروحة بعربية أو إنجليزية واضحة، والمرشد الوراثي على بُعد ضغطة. ولا يعرف أي منهما أي جين آخر يحمله الآخر، ولا تعرف العائلتان شيئاً.' })}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href={`/${lang}/demo`} className="rounded-[2px] bg-ink px-5 py-3.5 text-[16px] font-medium text-wool">{t({ en: 'Try it with two phones', ar: 'جرّبه بهاتفين' })}</Link>
              <Link href={`/${lang}/how`} className="rounded-[2px] border-[1.5px] border-ink px-5 py-3.5 text-[16px] font-medium">{t({ en: 'See how it works', ar: 'شاهد كيف يعمل' })}</Link>
            </div>
          </div>
          <HeroWeave lang={lang} />
        </section>

        {/* figures */}
        <section className="mx-auto max-w-[1240px] px-6 md:px-8">
          <div className="grid border-t-[1.5px] border-ink md:grid-cols-3">
            {FACTS.map((f) => (
              <div key={f.src} className="border-b border-rule py-6 md:border-b-0 md:pe-8">
                <p className="text-[44px] font-semibold leading-none tracking-tight">{t(f.n)}</p>
                <p className="mt-3 text-[15px] leading-snug text-ink-2">{t(f.label)}</p>
                <a href={f.href} target="_blank" rel="noreferrer" className="mt-2 inline-block text-[12px] text-ink-2 underline underline-offset-2">{f.src}</a>
              </div>
            ))}
          </div>
        </section>

        {/* the gap */}
        <section className="mx-auto mt-24 max-w-[1240px] px-6 md:px-8">
          <h2 className="max-w-3xl text-[clamp(28px,3vw,40px)] font-semibold leading-tight tracking-tight">
            {t({ en: 'The UAE screens every Emirati couple before marriage. What happens after the result is the hard part.', ar: 'تفحص الإمارات كل زوجين إماراتيين قبل الزواج. والجزء الصعب هو ما يحدث بعد النتيجة.' })}
          </h2>
          <div className="mt-10 grid gap-10 md:grid-cols-3">
            {GAPS.map((g, i) => (
              <article key={i} className="border-t border-ink pt-5">
                <h3 className="text-[19px] font-semibold leading-snug">{t(g.title)}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{t(g.body)}</p>
              </article>
            ))}
          </div>
        </section>

        {/* how */}
        <section className="mt-24 bg-ink py-20 text-wool">
          <div className="mx-auto max-w-[1240px] px-6 md:px-8">
            <h2 className="max-w-3xl text-[clamp(28px,3vw,40px)] font-semibold leading-tight tracking-tight">
              {t({ en: 'Two keys open one answer. Neither key opens anything else.', ar: 'مفتاحان يفتحان جواباً واحداً، ولا يفتح أي منهما شيئاً آخر.' })}
            </h2>
            <ol className="mt-12 grid gap-10 md:grid-cols-3">
              {[
                { t: { en: 'The lab issues one-time tokens', ar: 'يُصدر المختبر رموزاً لمرة واحدة' }, b: { en: 'For this pairing only, the lab turns each gene a person carries into a token only it can make. Nobody can invent a gene they don’t carry or reuse someone else’s.', ar: 'لهذا الاقتران فقط، يحوّل المختبر كل جين يحمله الشخص إلى رمز لا يصنعه غيره. لا يستطيع أحد اختراع جين لا يحمله أو استعمال رموز غيره.' } },
                { t: { en: 'Each phone locks its list', ar: 'يقفل كل هاتف قائمته' }, b: { en: 'Each phone scrambles its tokens with a secret it never shares, pads the list so its length reveals nothing, and sends it through the relay, encrypted.', ar: 'يخلط كل هاتف رموزه بسرّ لا يشاركه، ويحشو القائمة كي لا يكشف طولها شيئاً، ويرسلها عبر الوسيط مشفّرة.' } },
                { t: { en: 'Only the shared genes match', ar: 'لا يتطابق إلا المشترك' }, b: { en: 'Each phone adds its own lock to the other’s list, with a proof that it locked honestly. Items both carry end up identical; everything else stays random noise. The lab then confirms the match from its own records and names only the shared genes.', ar: 'يضيف كل هاتف قفله إلى قائمة الآخر، مع إثبات أنه أقفلها بأمانة. فتتطابق العناصر المشتركة، ويبقى الباقي ضجيجاً عشوائياً. ثم يؤكد المختبر التطابق من سجلاته ولا يسمّي إلا الجينات المشتركة.' } },
              ].map((s, i) => (
                <li key={i} className="border-t border-wool/30 pt-5">
                  <span className="font-mono text-[13px] text-wool/60">{i + 1}</span>
                  <h3 className="mt-2 text-[20px] font-semibold">{t(s.t)}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-wool/80">{t(s.b)}</p>
                </li>
              ))}
            </ol>
            <div className="mt-12 overflow-hidden rounded-[3px] border border-wool/40"><Sadu tone="dark" height={60} motifs={17} lit={[8]} seed={2} /></div>
            <p className="mt-4 max-w-3xl text-[14px] leading-relaxed text-wool/70">
              {t({ en: 'This is authorised private set intersection (De Cristofaro and Tsudik), with the lab as the trusted issuer: a partner can’t probe by pretending to carry extra genes, the problem Baldi et al. (2011) raised. Abu Dhabi’s Responsible AI Standard names secure multi-party computation as a privacy technique; this is one.', ar: 'هذا تقاطع مجموعات خاص مخوَّل (De Cristofaro وTsudik)، والمختبر هو الجهة الموثوقة التي تصدر الرموز: لا يستطيع الشريك التجسس بادعاء حمل جينات إضافية، وهي المشكلة التي طرحها Baldi وآخرون (2011). ويسمّي معيار الذكاء الاصطناعي المسؤول في أبوظبي الحوسبة الآمنة متعددة الأطراف تقنيةً للخصوصية، وهذه إحداها.' })}
            </p>
          </div>
        </section>

        {/* who learns what */}
        <section id="learns" className="mx-auto mt-24 max-w-[1240px] px-6 md:px-8">
          <h2 className="text-[clamp(28px,3vw,40px)] font-semibold tracking-tight">{t({ en: 'Who learns what', ar: 'من يعرف ماذا' })}</h2>
          {/* Cards on phones, a table from tablet up. */}
          <ul className="mt-8 divide-y divide-rule border-y-[1.5px] border-ink md:hidden">
            {LEARNS.map((r) => (
              <li key={r.who.en} className="py-4">
                <p className="text-[16px] font-semibold">{t(r.who)}</p>
                <p className="mt-1 text-[15px]"><span className="text-ink-2">{t({ en: 'Learns: ', ar: 'يعرف: ' })}</span>{t(r.learns)}</p>
                <p className="mt-1 text-[15px]"><span className="text-ink-2">{t({ en: 'Never learns: ', ar: 'لا يعرف أبداً: ' })}</span>{t(r.never)}</p>
              </li>
            ))}
          </ul>
          <div className="mt-8 hidden md:block">
            <table className="w-full border-t-[1.5px] border-ink text-[15px]">
              <thead><tr className="text-start text-[13px] text-ink-2">
                <th scope="col" className="py-3 text-start font-normal">{t({ en: 'Who', ar: 'من' })}</th>
                <th scope="col" className="py-3 text-start font-normal">{t({ en: 'Learns', ar: 'يعرف' })}</th>
                <th scope="col" className="py-3 text-start font-normal">{t({ en: 'Never learns', ar: 'لا يعرف أبداً' })}</th>
              </tr></thead>
              <tbody>
                {LEARNS.map((r) => (
                  <tr key={r.who.en} className="border-t border-rule align-top">
                    <th scope="row" className="py-3.5 pe-6 text-start font-medium">{t(r.who)}</th>
                    <td className="py-3.5 pe-6">{t(r.learns)}</td>
                    <td className="py-3.5 text-ink-2">{t(r.never)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* the result */}
        <section className="mx-auto mt-24 grid max-w-[1240px] items-center gap-12 px-6 md:grid-cols-2 md:px-8">
          <div>
            <h2 className="text-[clamp(28px,3vw,40px)] font-semibold leading-tight tracking-tight">{t({ en: 'A result people can understand on their own', ar: 'نتيجة يفهمها الناس بأنفسهم' })}</h2>
            <p className="mt-4 text-[16px] leading-relaxed text-ink-2">
              {t({ en: 'Chances are drawn the way a counsellor sketches them: four pregnancies, one affected, two carriers, one neither. Every explanation comes in simple, standard and detailed versions, in Arabic and English, and says plainly what is risk and what is diagnosis. The words avoid “incompatible”; the couple is “a couple with an increased chance”.', ar: 'تُرسم الاحتمالات كما يرسمها المرشد الوراثي: أربع حالات حمل: طفل مصاب، وطفلان يحملان التغيّر دون إصابة، وطفل لا يحمل التغيّر. ويأتي كل شرح بمستوى مبسّط وعادي ومفصّل، بالعربية والإنجليزية، ويوضح ما هو احتمال وما هو تشخيص. وتتجنب الكلمات «غير متوافقين»؛ فهما «زوجان باحتمال أعلى».' })}
            </p>
            <ul className="mt-6 space-y-2 text-[15px]">
              <li>{t({ en: 'Couple-level by default, as Dubai’s own programme reports it. Couples who prefer full openness can choose it together: the lab shows each partner’s full results only once both have asked.', ar: 'على مستوى الزوجين افتراضياً، كما يبلّغ برنامج دبي نفسه. ومن يفضّل الانفتاح الكامل يستطيع اختياره معاً: لا يعرض المختبر النتائج الكاملة لكل منهما إلا بعد أن يطلبها الاثنان.' })}</li>
              <li>{t({ en: 'Your own full results whenever you ask: your right under Decree-Law 49/2023.', ar: 'نتائجك الكاملة متى طلبتها: حقك بموجب المرسوم بقانون 49/2023.' })}</li>
              <li>{t({ en: 'X-linked results go to each person first, privately, before any pairing. Only when hers and his match does the couple see it together, after each has read their own.', ar: 'تصل نتائج الكروموسوم X إلى كل شخص أولاً، بخصوصية، قبل أي اقتران. ولا يراها الزوجان معاً إلا إذا تطابقت نتيجتها ونتيجته، وبعد أن يقرأ كل منهما نتيجته.' })}</li>
            </ul>
          </div>
          <div className="rounded-[3px] border border-madder bg-paper p-6">
            <p className="text-[13px] text-ink-2">{t({ en: 'Congenital adrenal hyperplasia · CYP21A2', ar: 'تضخم الغدة الكظرية الخلقي · CYP21A2' })}</p>
            <div className="mt-4 flex gap-4">{(['affected', 'carrier', 'carrier', 'clear'] as const).map((k, i) => <Diamond key={i} fill={k} size={56} />)}</div>
            <p className="mt-4 text-[17px] leading-relaxed">{t({ en: 'In each pregnancy: 1 in 4 that the child has the condition, 2 in 4 a healthy carrier, 1 in 4 neither.', ar: 'في كل حمل: 1 من 4 أن يصاب الطفل، و2 من 4 أن يحمل التغيّر وهو سليم، و1 من 4 ألا يحمل أي نسخة متغيرة.' })}</p>
            <p className="mt-2 text-[14px] text-ink-2">{t({ en: 'Treatable with daily medicine; found by newborn screening.', ar: 'قابل للعلاج بدواء يومي، ويُكشف بفحص حديثي الولادة.' })}</p>
          </div>
        </section>

        {/* care path */}
        <section className="mx-auto mt-24 max-w-[1240px] px-6 md:px-8">
          <h2 className="max-w-3xl text-[clamp(28px,3vw,40px)] font-semibold leading-tight tracking-tight">{t({ en: 'From result to care, with a person at every decision', ar: 'من النتيجة إلى الرعاية، مع إنسان عند كل قرار' })}</h2>
          <div className="mt-10 grid gap-8 md:grid-cols-4">
            {[
              { h: { en: 'Options, unranked', ar: 'خيارات بلا ترتيب' }, b: { en: 'Go ahead, test in pregnancy, IVF with embryo testing (Thiqa-covered with approval), reconsider plans together, kafala or no children, or talk first. Equal weight, no advice.', ar: 'المضي، أو الفحص أثناء الحمل، أو أطفال الأنابيب مع فحص الأجنة (يغطيه برنامج ثقة بموافقة مسبقة)، أو إعادة النظر في الخطط معاً، أو الكفالة أو عدم الإنجاب، أو التحدث أولاً. بالوزن نفسه، دون نصيحة.' } },
              { h: { en: 'Questions, answered from sources', ar: 'أسئلة تُجاب من المصادر' }, b: { en: 'An AI explainer answers only from vetted facts, has its numbers checked against them, refuses to probe a partner or decide for anyone, and hands distress to a person the same day. Anyone can ask a person instead.', ar: 'شارح بالذكاء الاصطناعي يجيب من حقائق موثوقة فقط، وتُطابق أرقامه معها، ويرفض التجسس على الشريك أو القرار عن أحد، ويحيل الضيق إلى إنسان في اليوم نفسه. ويمكن لأي شخص أن يسأل إنساناً بدلاً منه.' } },
              { h: { en: 'A counsellor, on the clock', ar: 'مرشد وراثي في الموعد' }, b: { en: 'Booking shares only what you tick. The desk tracks time to first contact, referral and documented closure, with a tamper-evident audit trail.', ar: 'الحجز يشارك ما تختاره فقط. ويتتبع المكتب زمن التواصل الأول والإحالة والإغلاق الموثق، مع سجل تدقيق يكشف أي عبث.' } },
              { h: { en: 'Relatives, without names', ar: 'الأقارب دون أسماء' }, b: { en: 'Sealed notes tell a cousin or sibling their own chance of carrying the same change. The service can’t read them or tell who sent them.', ar: 'رسائل مختومة تخبر ابن العم أو الأخ باحتمال حمله للتغيّر نفسه. ولا تستطيع الخدمة قراءتها أو معرفة مرسلها.' } },
            ].map((s, i) => (
              <article key={i} className="border-t border-ink pt-5">
                <h3 className="text-[18px] font-semibold">{t(s.h)}</h3>
                <p className="mt-2.5 text-[15px] leading-relaxed text-ink-2">{t(s.b)}</p>
              </article>
            ))}
          </div>
          <div className="mt-10 flex flex-wrap gap-3">
            <Link href={`/${lang}/desk`} className="rounded-[2px] border-[1.5px] border-ink px-5 py-3 text-[15px] font-medium">{t({ en: 'Open the counsellor desk', ar: 'افتح مكتب المرشد الوراثي' })}</Link>
            <Link href={`/${lang}/programme`} className="rounded-[2px] border-[1.5px] border-ink px-5 py-3 text-[15px] font-medium">{t({ en: 'See the programme view', ar: 'شاهد عرض البرنامج' })}</Link>
          </div>
        </section>

        {/* what we measure */}
        <section className="mx-auto mt-24 max-w-[1240px] px-6 md:px-8">
          <div className="grid gap-12 border-t-[1.5px] border-ink pt-10 md:grid-cols-[1fr_1.4fr]">
            <h2 className="text-[clamp(28px,3vw,40px)] font-semibold leading-tight tracking-tight">{t({ en: 'What we count, and what we never will', ar: 'ما نقيسه، وما لن نقيسه أبداً' })}</h2>
            <div>
              <ul className="grid gap-3 text-[16px] sm:grid-cols-2">
                {[
                  { en: 'Understanding, by a three-question teach-back', ar: 'الفهم، بإعادة الشرح في ثلاثة أسئلة' },
                  { en: 'Counselling uptake and time to first contact', ar: 'الإقبال على الاستشارة وزمن التواصل الأول' },
                  { en: 'Time from result to referral', ar: 'الزمن من النتيجة إلى الإحالة' },
                  { en: 'Relatives who book a test after a note', ar: 'الأقارب الذين يحجزون فحصاً بعد الرسالة' },
                  { en: 'Equity across Arabic and English, and reading levels', ar: 'العدالة بين العربية والإنجليزية ومستويات القراءة' },
                  { en: 'Privacy: nothing shared without a logged consent', ar: 'الخصوصية: لا مشاركة دون موافقة مسجلة' },
                ].map((m) => <li key={m.en} className="flex gap-2.5"><span className="mt-2 h-2 w-2 shrink-0 rotate-45 bg-sage" />{t(m)}</li>)}
              </ul>
              <p className="mt-6 border-s-2 border-madder ps-4 text-[15px] leading-relaxed text-ink-2">
                {t({ en: 'We never count marriages called off. The challenge says success must not rest on any single personal choice, and a couple’s decision is theirs.', ar: 'لا نحصي الزيجات الملغاة أبداً. فالتحدي ينص على ألا يقوم النجاح على أي خيار شخصي واحد، وقرار الزوجين لهما.' })}
              </p>
            </div>
          </div>
        </section>

        {/* path to pilot */}
        <section className="mx-auto mt-24 max-w-[1240px] px-6 md:px-8">
          <h2 className="max-w-3xl text-[clamp(28px,3vw,40px)] font-semibold leading-tight tracking-tight">{t({ en: 'Built to sit inside the programme Abu Dhabi already runs', ar: 'مصمم ليعمل داخل البرنامج القائم في أبوظبي' })}</h2>
          <div className="mt-10 grid gap-8 md:grid-cols-3">
            {[
              { h: { en: 'Inputs it reuses', ar: 'مدخلات يعيد استخدامها' }, b: { en: 'The DoH premarital panel results already flowing through Malaffi; UAE Pass sign-in; the 22 screening centres and their trained physicians.', ar: 'نتائج لوحة الفحص قبل الزواج التي تمر عبر «ملفي»؛ وتسجيل الدخول بالهوية الرقمية؛ ومراكز الفحص الـ22 وأطباؤها المدرّبون.' } },
              { h: { en: 'Where it runs', ar: 'أين يعمل' }, b: { en: 'Demo: Vercel and Amazon Bedrock in Sydney, synthetic data only. Production: hosted in the UAE, as Decree-Law 49/2023 and the health data law require. Amazon Nova Pro is offered in AWS’s UAE region (not yet tested there), and the safety layer works with any model.', ar: 'العرض: Vercel وAmazon Bedrock في سيدني، ببيانات افتراضية فقط. الإنتاج: استضافة داخل الإمارات كما يشترط المرسوم بقانون 49/2023 وقانون البيانات الصحية. ويُتاح Amazon Nova Pro في منطقة AWS في الإمارات (لم يُختبر هناك بعد)، وتعمل طبقة الأمان مع أي نموذج.' } },
              { h: { en: 'A gated path to a pilot', ar: 'طريق مرحلي إلى التجربة' }, b: { en: 'First the DoH sandbox, ethics approval, a DPIA and an independent crypto audit. Then a pilot of the explainer and family notes with couples already found at increased chance, against a measured baseline. Lab tokens and Malaffi follow at three or four centres. A licensed provider operates it; DoH sees only counts.', ar: 'أولاً بيئة الدائرة التجريبية وموافقة أخلاقيات البحث وتقييم أثر حماية البيانات وتدقيق تشفير مستقل. ثم تجربة للشارح ورسائل العائلة مع أزواج تبيّن أن لديهم احتمالاً أعلى، مقارنة بخط أساس مُقاس. ثم رموز المختبر وملف «ملفي» في ثلاثة أو أربعة مراكز. يشغّله مزوّد مرخّص، ولا ترى الدائرة إلا الأعداد.' } },
            ].map((s, i) => (
              <article key={i} className="rounded-[3px] border border-ink bg-paper p-5">
                <h3 className="text-[18px] font-semibold">{t(s.h)}</h3>
                <p className="mt-2.5 text-[15px] leading-relaxed text-ink-2">{t(s.b)}</p>
              </article>
            ))}
          </div>
        </section>

        {/* cast */}
        <section className="mx-auto mt-24 max-w-[1240px] px-6 md:px-8">
          <div className="grid items-center gap-10 rounded-[3px] border-[1.5px] border-ink p-8 md:grid-cols-[1.3fr_1fr]">
            <div>
              <h2 className="text-[clamp(26px,2.6vw,34px)] font-semibold tracking-tight">{t({ en: 'Four couples are waiting in the demo', ar: 'أربعة أزواج بانتظارك في العرض' })}</h2>
              <p className="mt-3 text-[16px] leading-relaxed text-ink-2">{t({ en: 'First cousins who share a gene, an unrelated couple who share none, double first cousins who share one full and one milder match, and second cousins whose two milder changes are not reported as a match. All synthetic, all running the real protocol.', ar: 'أبناء عمومة يتشاركان جيناً، وزوجان بلا قرابة لا يتشاركان شيئاً، وأبناء عمومة وخؤولة يتشاركان تطابقاً كاملاً وآخر أخف، وأبناء عمومة من الدرجة الثانية لا يُبلَّغ عن تغيّريهما الأخفين كتطابق. كلهم افتراضيون، وكلهم يعملون بالبروتوكول الحقيقي.' })}</p>
              <Link href={`/${lang}/demo`} className="mt-6 inline-block rounded-[2px] bg-ink px-5 py-3.5 text-[16px] font-medium text-wool">{t({ en: 'Try it with two phones', ar: 'جرّبه بهاتفين' })}</Link>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-5" aria-hidden>
              {['F', 'M', 'F', 'M', 'F', 'M', 'F', 'M'].map((s, i) => <Person key={i} sex={s as 'F' | 'M'} carrier color={s === 'F' ? 'var(--indigo)' : 'var(--camel)'} size={40} />)}
            </div>
          </div>
        </section>
      </main>
      <Footer lang={lang} />
    </>
  );
}

export type { Locale };
