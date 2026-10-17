import { notFound } from 'next/navigation';
import { hasLocale } from '@/i18n/locales';
import { Footer, Nav } from '@/components/site/Chrome';
import tests from '../../../../data/tests.json';
import calibration from '../../../../data/calibration.json';
import evalAsk from '../../../../data/eval-ask.json';
import { titled } from '@/i18n/meta';

export const generateMetadata = titled('Proof', 'الإثبات');
type L = { en: string; ar: string };

const pct = (x: number, d = 1) => `${(x * 100).toFixed(d)}%`;
const REL: Record<string, L> = {
  unrelated: { en: 'Not related', ar: 'لا قرابة' }, 'first-cousins': { en: 'First cousins', ar: 'أبناء عمومة درجة أولى' },
  'double-first-cousins': { en: 'Double first cousins', ar: 'أبناء عمومة وخؤولة' }, 'second-cousins': { en: 'Second cousins', ar: 'أبناء عمومة درجة ثانية' },
};

const SOURCES: { what: L; owner: string; rights: L; personal: L; href: string }[] = [
  { what: { en: 'Variant frequencies, Middle Eastern group', ar: 'ترددات المتغيرات، المجموعة الشرق أوسطية' }, owner: 'gnomAD v4.1, Broad Institute', rights: { en: 'CC0; no re-identification', ar: 'CC0؛ دون إعادة تعريف' }, personal: { en: 'None (aggregate)', ar: 'لا (مجمّعة)' }, href: 'https://gnomad.broadinstitute.org/' },
  { what: { en: 'Pathogenic variant classifications', ar: 'تصنيف المتغيرات الممرضة' }, owner: 'ClinVar, NCBI', rights: { en: 'Public domain, attribution requested', ar: 'ملكية عامة، مع طلب الإسناد' }, personal: { en: 'None', ar: 'لا' }, href: 'https://www.ncbi.nlm.nih.gov/clinvar/' },
  { what: { en: 'Emirati gene carrier frequencies', ar: 'نسب من يحملون التغيّرات الجينية بين الإماراتيين' }, owner: 'Jain et al., Genet Med Open 2025', rights: { en: 'Published aggregate figures, cited', ar: 'أرقام مجمّعة منشورة، مع الإسناد' }, personal: { en: 'None (aggregate)', ar: 'لا (مجمّعة)' }, href: 'https://doi.org/10.1016/j.gimo.2025.103446' },
  { what: { en: 'Carrier screening gene list (113 genes)', ar: 'قائمة جينات الفحص (113 جيناً)' }, owner: 'ACMG, Gregg et al. 2021', rights: { en: 'Gene names, cited', ar: 'أسماء الجينات، مع الإسناد' }, personal: { en: 'None', ar: 'لا' }, href: 'https://doi.org/10.1038/s41436-021-01203-z' },
  { what: { en: 'Condition explanations', ar: 'شرح الحالات' }, owner: 'MedlinePlus Genetics, US NLM', rights: { en: 'US government work, linked', ar: 'عمل حكومي أمريكي، مع الرابط' }, personal: { en: 'None', ar: 'لا' }, href: 'https://medlineplus.gov/genetics/' },
  { what: { en: 'Screening outcomes used for calibration', ar: 'نتائج الفحص المستخدمة للمعايرة' }, owner: 'Alblooshi et al., Nature Medicine 2026; M42 and DoH', rights: { en: 'Published figures, cited', ar: 'أرقام منشورة، مع الإسناد' }, personal: { en: 'None', ar: 'لا' }, href: 'https://www.nature.com/articles/s41591-026-04251-7' },
  { what: { en: 'People, results and desk cases in the demo', ar: 'الأشخاص والنتائج والحالات في العرض' }, owner: 'Two Keys (synthetic)', rights: { en: 'Ours; invented for the demo', ar: 'لنا؛ مختلقة للعرض' }, personal: { en: 'None: no real person', ar: 'لا: لا يوجد شخص حقيقي' }, href: '#' },
];

const LIMITS: L[] = [
  { en: 'All people and results are synthetic. No patient data was used or needed.', ar: 'كل الأشخاص والنتائج افتراضية. لم تُستخدم بيانات مرضى ولم تكن ضرورية.' },
  { en: 'The protocol is semi-honest and unaudited. A phone can drop its own genes or stop early; it cannot learn more than the match.', ar: 'البروتوكول شبه أمين وغير مُدقّق. قد يُسقط هاتف جيناته أو يتوقف مبكراً، لكنه لا يعرف أكثر من التطابق.' },
  { en: 'Gene-level matching needs clinical curation for exceptions (alpha-globin cis/trans, HbS/HbC, hypomorphic alleles). We flag these for counsellors rather than resolve them.', ar: 'المطابقة على مستوى الجين تحتاج تنقيحاً سريرياً للاستثناءات (ألفا غلوبين، HbS/HbC، المتغيرات الضعيفة). نُبرزها للمستشار بدلاً من حسمها.' },
  { en: 'The demo runs outside the UAE on synthetic data. A real deployment needs UAE hosting, DoH licensing (Decree-Law 49/2023 Art. 28) and a National Genomic Database feed (Art. 26).', ar: 'يعمل العرض خارج الإمارات على بيانات افتراضية. ويحتاج النشر الحقيقي استضافة في الإمارات وترخيص الدائرة (المادة 28) وربطاً بقاعدة البيانات الجينومية الوطنية (المادة 26).' },
  { en: 'Teach-back questions are a proxy for understanding, not a validated instrument; a pilot would use a validated comprehension measure.', ar: 'أسئلة إعادة الشرح مؤشر تقريبي للفهم وليست أداة معتمدة؛ وستستخدم التجربة أداة فهم معتمدة.' },
  { en: 'Explainer answers are graded by another model; judges should read the examples. A licensed counsellor reviews every case before any clinical step.', ar: 'تُقيَّم إجابات الشارح بنموذج آخر؛ وننصح بقراءة الأمثلة. ويراجع مستشار مرخّص كل حالة قبل أي خطوة سريرية.' },
];

interface Summary { cases: number; safe: number; helpful: number; directive: number; partner_leak: number; invented: number; wrong: number; stigmatising: number; religious_ruling: number }

export default async function ProofPage({ params }: PageProps<'/[lang]/proof'>) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = (l: L) => l[lang];
  const tr = tests as unknown as { numPassedTests: number; numFailedTests: number; testResults: { name: string; assertionResults: { title: string; status: string; duration: number }[] }[] };
  const cal = calibration as unknown as {
    genesModelled: number; genesFromLiterature: number; genesFromGnomad: number; couplesPerType: number; mixedPopulationAtRisk: number;
    byType: Record<string, { rate: number; ci: [number, number] }>; targets: { label: string; value: number; ci?: number[]; source: string }[];
    geneShare: { gene: string; shareOfMatches: number; observedM42: number | null }[]; mix: Record<string, number>;
  };
  const ev = evalAsk as unknown as { models: { product: string; comparison: string; judge: string }; summary: Record<string, Summary> };
  const configs: [string, L][] = [['twokeys', { en: 'Two Keys (Nova Pro + guardrails)', ar: 'مفتاحان (Nova Pro مع الضوابط)' }], ['raw-nova', { en: 'Same model, no guardrails', ar: 'النموذج نفسه دون ضوابط' }], ['raw-claude', { en: 'Claude Sonnet 4.5, no guardrails', ar: 'Claude Sonnet 4.5 دون ضوابط' }]];
  const failKeys: [keyof Summary, L][] = [['directive', { en: 'Told the couple what to do', ar: 'أملى على الزوجين القرار' }], ['partner_leak', { en: 'Leaked or guessed partner data', ar: 'كشف بيانات الشريك أو خمّنها' }], ['invented', { en: 'Invented a fact or number', ar: 'اختلق حقيقة أو رقماً' }], ['wrong', { en: 'Contradicted the facts', ar: 'ناقض الحقائق' }], ['stigmatising', { en: 'Stigmatising wording', ar: 'صياغة واصمة' }], ['religious_ruling', { en: 'Gave a religious ruling', ar: 'أصدر حكماً شرعياً' }]];
  const max = Math.max(cal.mixedPopulationAtRisk, ...cal.targets.map((x) => x.value), ...Object.values(cal.byType).map((b) => b.rate));

  return (
    <>
      <Nav lang={lang} path="/proof" />
      <main className="mx-auto max-w-[1240px] px-6 pt-6 md:px-8">
        <h1 className="max-w-3xl text-[clamp(32px,3.6vw,48px)] font-semibold leading-tight tracking-tight">{t({ en: 'Everything we claim, and how we checked it', ar: 'كل ما ندّعيه، وكيف تحققنا منه' })}</h1>
        <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-ink-2">{t({ en: 'Each section below is generated from a script in the repository, so anyone can re-run it.', ar: 'كل قسم أدناه مولّد من سكربت في المستودع، فيمكن لأي شخص إعادة تشغيله.' })}</p>

        {/* tests */}
        <section className="mt-14 border-t-[1.5px] border-ink pt-8">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="text-[clamp(24px,2.6vw,32px)] font-semibold tracking-tight">{t({ en: 'The protocol and the risk engine', ar: 'البروتوكول ومحرك المخاطر' })}</h2>
            <p className="text-[15px]"><span className="text-[28px] font-semibold text-sage">{tr.numPassedTests}</span> / {tr.numPassedTests + tr.numFailedTests} {t({ en: 'tests pass', ar: 'اختبارات ناجحة' })}</p>
          </div>
          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {tr.testResults.map((f) => (
              <ul key={f.name} className="divide-y divide-rule border-y border-rule text-[14px]">
                {f.assertionResults.map((a) => (
                  <li key={a.title} className="flex items-start justify-between gap-3 py-2.5">
                    <span><span className={a.status === 'passed' ? 'text-sage' : 'text-madder'}>{a.status === 'passed' ? '✓' : '✗'}</span> {a.title}</span>
                    <span className="shrink-0 font-mono text-[12px] text-ink-3">{(a.duration / 1000).toFixed(1)} s</span>
                  </li>
                ))}
              </ul>
            ))}
          </div>
          <p className="mt-3 text-[13px] text-ink-3">{t({ en: 'Plus an end-to-end test that pairs two phones through the real lab and relay routes (tests/pairing.int.test.ts).', ar: 'إضافة إلى اختبار شامل يقرن هاتفين عبر مسارات المختبر والوسيط الحقيقية (tests/pairing.int.test.ts).' })}</p>
        </section>

        {/* calibration */}
        <section className="mt-20 border-t-[1.5px] border-ink pt-8">
          <h2 className="max-w-3xl text-[clamp(24px,2.6vw,32px)] font-semibold tracking-tight">{t({ en: 'Does the model reproduce what UAE screening found?', ar: 'هل يعيد النموذج إنتاج ما وجده الفحص في الإمارات؟' })}</h2>
          <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-ink-2">
            {t({ en: `We built ${cal.couplesPerType.toLocaleString()} synthetic couples per family type from published Emirati carrier frequencies (${cal.genesFromLiterature} genes) and gnomAD (${cal.genesFromGnomad} genes), with real pedigrees: first cousins share grandparents, and so on. The marriage mix follows Dubai’s 2025 finding that 28% of couples were related. Then we asked how many couples carry the same gene.`, ar: `بنينا ${cal.couplesPerType.toLocaleString()} زوجين افتراضيين لكل نوع عائلة من ترددات الحمل الإماراتية المنشورة (${cal.genesFromLiterature} جيناً) وgnomAD (${cal.genesFromGnomad} جيناً)، بأشجار عائلة حقيقية: أبناء العم يتشاركون الأجداد، وهكذا. ويتبع مزيج الزيجات ما وجدته دبي في 2025 أن 28% من الأزواج أقارب. ثم سألنا: كم زوجاً يحمل الجين نفسه؟` })}
          </p>
          <div className="mt-8 grid gap-3">
            {[{ label: { en: 'Model: mixed population', ar: 'النموذج: مجتمع مختلط' }, value: cal.mixedPopulationAtRisk, ci: undefined as number[] | undefined, model: true },
              ...Object.entries(cal.byType).map(([k, v]) => ({ label: { en: `Model: ${REL[k]?.en ?? k}`, ar: `النموذج: ${REL[k]?.ar ?? k}` }, value: v.rate, ci: v.ci, model: true })),
              ...cal.targets.map((x) => ({ label: { en: `Observed: ${x.label}`, ar: `المرصود: ${x.label}` }, value: x.value, ci: x.ci, model: false }))].map((row, i) => (
              <div key={i} className="grid grid-cols-1 items-center gap-2 text-[14px] md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)_70px]">
                <span className={row.model ? '' : 'text-ink-2'}>{t(row.label)}</span>
                <div className="relative h-4 bg-wool-2">
                  <div className={`h-4 ${row.model ? 'bg-ink' : 'bg-camel'}`} style={{ width: `${(row.value / max) * 100}%` }} />
                  {row.ci && <div className="absolute top-1/2 h-px bg-ink-2" style={{ insetInlineStart: `${(row.ci[0] / max) * 100}%`, width: `${((row.ci[1] - row.ci[0]) / max) * 100}%` }} />}
                </div>
                <span className="text-end font-medium">{pct(row.value)}</span>
              </div>
            ))}
          </div>
          <p className="mt-4 max-w-3xl text-[14px] leading-relaxed text-ink-2">
            {t({ en: 'Read the mixed-population bar against Dubai’s couples outside alpha-thalassaemia (alpha-globin deletions are invisible to exome data, so we model them separately). The cousin bars show why consanguinity matters: the same genes, several times the chance.', ar: 'قارن شريط المجتمع المختلط بأزواج دبي خارج الثلاسيميا ألفا (حذوفات ألفا غلوبين لا تظهر في بيانات الإكسوم، فنمذجها منفصلة). وتبيّن أشرطة الأقارب لماذا تهم القرابة: الجينات نفسها، واحتمال أضعاف.' })}
          </p>
          <h3 className="mt-10 text-[18px] font-semibold">{t({ en: 'Which genes the model says couples will share, against Abu Dhabi’s observed list', ar: 'الجينات التي يتوقع النموذج أن يتشاركها الأزواج، مقابل القائمة المرصودة في أبوظبي' })}</h3>
          <table className="mt-3 w-full max-w-2xl text-[14px]">
            <thead><tr className="border-b border-ink text-[12px] text-ink-3"><th className="py-2 text-start font-normal">{t({ en: 'Gene', ar: 'الجين' })}</th><th className="py-2 text-end font-normal">{t({ en: 'Model share of matches', ar: 'حصة النموذج من التطابقات' })}</th><th className="py-2 text-end font-normal">{t({ en: 'Observed (M42/DoH)', ar: 'المرصود (M42/الدائرة)' })}</th></tr></thead>
            <tbody>{cal.geneShare.slice(0, 10).map((g) => (
              <tr key={g.gene} className="border-b border-rule"><td className="py-2 font-mono">{g.gene}</td><td className="py-2 text-end">{pct(g.shareOfMatches)}</td><td className="py-2 text-end text-ink-2">{g.observedM42 === null ? '—' : pct(g.observedM42, 0)}</td></tr>
            ))}</tbody>
          </table>
          <p className="mt-3 max-w-3xl text-[13px] leading-relaxed text-ink-3">{t({ en: 'Where they differ we say so. HBB ranks high in the model but is absent from the observed top genes, likely because haemoglobin disorders are screened separately in Abu Dhabi; CYP21A2’s published frequency includes non-classic alleles, which overstates classic CAH.', ar: 'حيث يختلفان نقول ذلك. يحتل HBB مرتبة عالية في النموذج لكنه غائب عن القائمة المرصودة، على الأرجح لأن اضطرابات الهيموغلوبين تُفحص منفصلة في أبوظبي؛ والتردد المنشور لـ CYP21A2 يشمل متغيرات غير تقليدية، ما يبالغ في تقدير الشكل التقليدي.' })}</p>
        </section>

        {/* explainer eval */}
        <section className="mt-20 border-t-[1.5px] border-ink pt-8">
          <h2 className="max-w-3xl text-[clamp(24px,2.6vw,32px)] font-semibold tracking-tight">{t({ en: 'Is the explainer safe? 60 hard questions, in Arabic and English', ar: 'هل الشارح آمن؟ 60 سؤالاً صعباً بالعربية والإنجليزية' })}</h2>
          <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-ink-2">{t({ en: 'Comprehension questions, but also attempts to learn a partner’s results, requests to decide for the couple, religious and termination questions, prompt injections, number traps and a crisis message. Each answer was graded by an independent model against the vetted facts.', ar: 'أسئلة فهم، ومحاولات لمعرفة نتائج الشريك، وطلبات للقرار عن الزوجين، وأسئلة شرعية وعن إنهاء الحمل، وحقن أوامر، وأفخاخ أرقام، ورسالة أزمة. وقيّم نموذج مستقل كل إجابة مقابل الحقائق الموثوقة.' })}</p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[720px] text-[14px]">
              <thead><tr className="border-b border-ink text-[12px] text-ink-3">
                <th className="py-2 text-start font-normal" />
                {configs.map(([k, l]) => <th key={k} className={`py-2 text-end font-normal ${k === 'twokeys' ? 'text-ink' : ''}`}>{t(l)}</th>)}
              </tr></thead>
              <tbody>
                <tr className="border-b border-rule"><td className="py-2.5 font-medium">{t({ en: 'Safe answers', ar: 'إجابات آمنة' })}</td>
                  {configs.map(([k]) => <td key={k} className={`py-2.5 text-end text-[18px] font-semibold ${k === 'twokeys' ? 'text-sage' : ''}`}>{ev.summary[k]?.safe ?? '—'} / {ev.summary[k]?.cases ?? '—'}</td>)}</tr>
                {failKeys.map(([fk, l]) => (
                  <tr key={fk} className="border-b border-rule"><td className="py-2 text-ink-2">{t(l)}</td>
                    {configs.map(([k]) => <td key={k} className={`py-2 text-end ${(ev.summary[k]?.[fk] ?? 0) > 0 ? 'text-madder' : 'text-ink-3'}`}>{ev.summary[k]?.[fk] ?? '—'}</td>)}</tr>
                ))}
                <tr><td className="py-2 text-ink-2">{t({ en: 'Helpful (answered or redirected sensibly)', ar: 'مفيدة (أجابت أو أحالت بشكل معقول)' })}</td>
                  {configs.map(([k]) => <td key={k} className="py-2 text-end">{ev.summary[k]?.helpful ?? '—'}</td>)}</tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[12px] text-ink-3">{t({ en: `Product model ${ev.models.product}; comparison ${ev.models.comparison}; judge ${ev.models.judge}. Full answers in data/eval-ask.json.`, ar: `نموذج المنتج ${ev.models.product}؛ المقارنة ${ev.models.comparison}؛ الحكم ${ev.models.judge}. الإجابات كاملة في data/eval-ask.json.` })}</p>
        </section>

        {/* sources */}
        <section id="sources" className="mt-20 border-t-[1.5px] border-ink pt-8">
          <h2 className="text-[clamp(24px,2.6vw,32px)] font-semibold tracking-tight">{t({ en: 'Data sources and rights', ar: 'مصادر البيانات وحقوقها' })}</h2>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[760px] text-[14px]">
              <thead><tr className="border-b border-ink text-[12px] text-ink-3">
                <th className="py-2 text-start font-normal">{t({ en: 'Data', ar: 'البيانات' })}</th><th className="py-2 text-start font-normal">{t({ en: 'Owner', ar: 'المالك' })}</th>
                <th className="py-2 text-start font-normal">{t({ en: 'Rights', ar: 'الحقوق' })}</th><th className="py-2 text-start font-normal">{t({ en: 'Personal data', ar: 'بيانات شخصية' })}</th>
              </tr></thead>
              <tbody>{SOURCES.map((s) => (
                <tr key={s.owner} className="border-b border-rule align-top">
                  <td className="py-2.5 pe-4">{s.href === '#' ? t(s.what) : <a href={s.href} target="_blank" rel="noreferrer" className="underline underline-offset-2">{t(s.what)}</a>}</td>
                  <td className="py-2.5 pe-4 text-ink-2">{s.owner}</td><td className="py-2.5 pe-4 text-ink-2">{t(s.rights)}</td><td className="py-2.5 text-ink-2">{t(s.personal)}</td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        </section>

        {/* limits */}
        <section className="mt-20 border-t-[1.5px] border-ink pt-8">
          <h2 className="text-[clamp(24px,2.6vw,32px)] font-semibold tracking-tight">{t({ en: 'Assumptions and limits', ar: 'الافتراضات والحدود' })}</h2>
          <ul className="mt-5 grid gap-4 md:grid-cols-2">{LIMITS.map((l) => <li key={l.en} className="border-s-2 border-ink ps-4 text-[15px] leading-relaxed text-ink-2">{t(l)}</li>)}</ul>
        </section>
      </main>
      <Footer lang={lang} />
    </>
  );
}
