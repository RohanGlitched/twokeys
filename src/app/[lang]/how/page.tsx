import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasLocale } from '@/i18n/locales';
import { Footer, Nav } from '@/components/site/Chrome';
import { Theatre } from '@/components/how/Theatre';
import { titled } from '@/i18n/meta';

export const generateMetadata = titled('How it works', 'كيف يعمل');
type L = { en: string; ar: string };

const PROPS: { h: L; b: L }[] = [
  { h: { en: 'No forged genes', ar: 'لا جينات مزوّرة' }, b: { en: 'Only the lab can make a token, so a partner can’t add genes they don’t carry to fish for the other’s results. This is authorised PSI (De Cristofaro and Tsudik, 2009), with the lab as the trusted issuer.', ar: 'لا يصنع الرمز إلا المختبر، فلا يستطيع الشريك إضافة جينات لا يحملها للتجسس على نتائج الآخر. هذا هو PSI المخوَّل (De Cristofaro وTsudik، 2009)، والمختبر هو الجهة الموثوقة التي تصدر الرموز.' } },
  { h: { en: 'No reuse', ar: 'لا إعادة استخدام' }, b: { en: 'Tokens are bound to one pairing and its two seats. Each seat is claimed once, atomically; a friend’s card or an old pairing matches nothing.', ar: 'الرموز مرتبطة باقتران واحد وبمقعديه. يُحجز كل مقعد مرة واحدة فقط، ولا يطابق شيئاً بطاقةُ صديق أو اقترانٌ قديم.' } },
  { h: { en: 'Honest locking, proved', ar: 'قفل أمين، مُثبت' }, b: { en: 'Every locked list comes with a short proof (batched Chaum–Pedersen, as in RFC 9497) that one secret locked every entry. A phone that cheats is rejected before anything is compared.', ar: 'تصل كل قائمة مقفلة مع إثبات قصير (Chaum–Pedersen مجمّع، كما في RFC 9497) أن سراً واحداً أقفل كل العناصر. ويُرفض الهاتف الغشاش قبل أي مقارنة.' } },
  { h: { en: 'No counting', ar: 'لا عدّ' }, b: { en: 'Every list has 64 entries, so nobody learns how many genes the other carries.', ar: 'كل قائمة فيها 64 عنصراً، فلا يعرف أحد عدد جينات الآخر.' } },
  { h: { en: 'Severity-aware matching', ar: 'مطابقة تراعي الشدة' }, b: { en: 'Role tags mean a serious change matches a milder one, which is shown as a milder-form chance, while two milder changes (like two GJB2 p.Val37Ile) are not reported as a match.', ar: 'تجعل الوسوم التغيّر الشديد يطابق التغيّر الأخف، ويُعرض ذلك كاحتمال لشكل أخف، بينما لا يُبلَّغ عن تغيّرين أخفين (مثل GJB2 p.Val37Ile مرتين) كتطابق.' } },
  { h: { en: 'X-linked results reach the woman', ar: 'نتائج كروموسوم X تصل إلى المرأة' }, b: { en: 'A woman’s X-linked carrier result matters for her sons whatever her partner carries, so it comes to her as a personal result, never only through a pairing.', ar: 'نتيجة المرأة التي تحمل تغيّراً على الكروموسوم X تهم أبناءها أياً كان شريكها، لذا تصلها كنتيجة شخصية، لا عبر الاقتران وحده.' } },
];

type Row = { who: L; learns: L; cannot: L; how: L };
const THREATS: Row[] = [
  { who: { en: 'Your partner', ar: 'شريكك' },
    learns: { en: 'The genes you both carry (that is the point), and that you took part.', ar: 'الجينات التي تحملانها معاً (وهذا هو الغرض)، وأنك شاركت.' },
    cannot: { en: 'Any gene only you carry, or how many you carry, unless you both choose to see everything.', ar: 'أي جين تحمله وحدك، أو عدد جيناتك، إلا إذا اخترتما معاً رؤية كل شيء.' },
    how: { en: 'Lab-only tokens, padded lists, proofs on every lock', ar: 'رموز لا يصنعها إلا المختبر، وقوائم محشوة، وإثبات لكل قفل' } },
  { who: { en: 'A modified phone', ar: 'هاتف معدَّل' },
    learns: { en: 'No more than an honest phone. It can refuse to finish.', ar: 'لا أكثر من الهاتف الأمين، ويمكنه رفض الإكمال.' },
    cannot: { en: 'Fake a match, hide one, or show its partner a wrong result: the lab recomputes the match itself.', ar: 'تزوير تطابق أو إخفاؤه أو عرض نتيجة خاطئة على الشريك: فالمختبر يعيد حساب التطابق بنفسه.' },
    how: { en: 'Proof checks; lab-confirmed reveal; disagreement is flagged', ar: 'فحص الإثبات، وكشف يؤكده المختبر، وتنبيه عند الاختلاف' } },
  { who: { en: 'The relay', ar: 'الوسيط' },
    learns: { en: 'That two devices exchanged a few kilobytes, and when.', ar: 'أن جهازين تبادلا بضعة كيلوبايتات، ومتى.' },
    cannot: { en: 'Read anything: messages are encrypted with a key that never reaches a server.', ar: 'قراءة أي شيء: فالرسائل مشفّرة بمفتاح لا يصل إلى أي خادم.' },
    how: { en: 'AES-GCM, key in the link #fragment; write-once slots; 10-minute expiry', ar: 'AES-GCM بمفتاح في جزء الرابط بعد #، وخانات تُكتب مرة، وانتهاء بعد 10 دقائق' } },
  { who: { en: 'The lab (single-lab setting, today)', ar: 'المختبر (مختبر واحد، اليوم)' },
    learns: { en: 'That these two people paired. It already holds both results, so it could compute the match itself.', ar: 'أن هذين الشخصين اقترنا. وهو يملك النتيجتين أصلاً، فيستطيع حساب التطابق بنفسه.' },
    cannot: { en: 'Nothing new about either person. It is trusted, as it is today.', ar: 'لا شيء جديد عن أي منهما. فهو موثوق، كما هو اليوم.' },
    how: { en: 'Trust, audit, and law (Decree-Law 49/2023)', ar: 'الثقة والتدقيق والقانون (المرسوم بقانون 49/2023)' } },
  { who: { en: 'A counsellor', ar: 'المستشار' },
    learns: { en: 'Only what a person ticked when booking, under a named account; every view is logged.', ar: 'ما اختاره الشخص عند الحجز فقط، عبر حساب مسمّى، وكل اطلاع مسجَّل.' },
    cannot: { en: 'See a partner’s own results, or anything after consent is withdrawn.', ar: 'رؤية نتائج الشريك الخاصة، أو أي شيء بعد سحب الموافقة.' },
    how: { en: 'Itemised versioned consent; HMAC-keyed audit chain; erase and seal on withdrawal', ar: 'موافقة مفصّلة ومرقّمة، وسلسلة تدقيق بمفتاح HMAC، ومسح وختم عند السحب' } },
  { who: { en: 'A health-authority analyst', ar: 'محلل في الجهة الصحية' },
    learns: { en: 'Hourly aggregate counts with random noise; groups under 5 hidden.', ar: 'أعداد إجمالية كل ساعة مع ضجيج عشوائي، وتُحجب المجموعات الأصغر من 5.' },
    cannot: { en: 'Any individual, which couples share a gene, or any marriage or pregnancy decision.', ar: 'أي فرد، أو أي زوجين يتشاركان جيناً، أو أي قرار زواج أو حمل.' },
    how: { en: 'Differential privacy, cached release, budget shown', ar: 'الخصوصية التفاضلية، وإصدار محفوظ، وميزانية معلنة' } },
  { who: { en: 'Anyone else on the internet', ar: 'أي شخص آخر على الإنترنت' },
    learns: { en: 'Nothing about a person.', ar: 'لا شيء عن أي شخص.' },
    cannot: { en: 'Get tokens or results without signing in, or take a seat in someone’s pairing.', ar: 'الحصول على رموز أو نتائج دون تسجيل الدخول، أو حجز مقعد في اقتران غيره.' },
    how: { en: 'Signed identity (UAE PASS in production), atomic seats, rate limits', ar: 'هوية موقّعة (UAE PASS في الإنتاج)، ومقاعد ذرية، وحدود للطلبات' } },
];

export default async function HowPage({ params }: PageProps<'/[lang]/how'>) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = (l: L) => l[lang];
  return (
    <>
      <Nav lang={lang} path="/how" />
      <main className="mx-auto max-w-[1240px] px-6 pt-6 md:px-8">
        <h1 className="max-w-3xl text-[clamp(32px,3.6vw,48px)] font-semibold leading-tight tracking-tight">{t({ en: 'How two phones find a shared gene without showing anything else', ar: 'كيف يجد هاتفان جيناً مشتركاً دون أن يكشفا أي شيء آخر' })}</h1>
        <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-ink-2">{t({ en: 'This runs the real protocol in your browser, with a throwaway lab key. Every value below is the actual value.', ar: 'يشغّل هذا البروتوكول الحقيقي في متصفحك بمفتاح مختبر مؤقت. كل قيمة أدناه هي القيمة الفعلية.' })}</p>
        <section className="mt-10 border-t-[1.5px] border-ink pt-8"><Theatre lang={lang} /></section>

        <section className="mt-20">
          <h2 className="text-[clamp(26px,2.8vw,36px)] font-semibold tracking-tight">{t({ en: 'What the design guarantees', ar: 'ما يضمنه التصميم' })}</h2>
          <div className="mt-8 grid gap-8 md:grid-cols-3">
            {PROPS.map((p) => (
              <article key={p.h.en} className="border-t border-ink pt-4">
                <h3 className="text-[18px] font-semibold">{t(p.h)}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{t(p.b)}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-20" aria-labelledby="threats">
          <h2 id="threats" className="text-[clamp(26px,2.8vw,36px)] font-semibold tracking-tight">{t({ en: 'Who could learn what', ar: 'من قد يعرف ماذا' })}</h2>
          <p className="mt-3 max-w-3xl text-[16px] leading-relaxed text-ink-2">{t({ en: 'A threat model, one row per party. Each claim is phrased so it can be checked against the code and the tests on the Proof page.', ar: 'نموذج تهديد، صف لكل طرف. وصيغت كل عبارة بحيث يمكن التحقق منها في الشيفرة والاختبارات في صفحة الإثبات.' })}</p>
          <div className="mt-6 overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-[14px]">
              <thead>
                <tr className="border-b-[1.5px] border-ink text-start">
                  <th scope="col" className="py-2.5 pe-4 text-start font-semibold">{t({ en: 'Who', ar: 'من' })}</th>
                  <th scope="col" className="py-2.5 pe-4 text-start font-semibold">{t({ en: 'Can learn', ar: 'يمكنه أن يعرف' })}</th>
                  <th scope="col" className="py-2.5 pe-4 text-start font-semibold">{t({ en: 'Cannot', ar: 'لا يستطيع' })}</th>
                  <th scope="col" className="py-2.5 text-start font-semibold">{t({ en: 'Enforced by', ar: 'يُفرض عبر' })}</th>
                </tr>
              </thead>
              <tbody>
                {THREATS.map((r) => (
                  <tr key={r.who.en} className="border-b border-rule align-top">
                    <th scope="row" className="py-3 pe-4 text-start font-medium">{t(r.who)}</th>
                    <td className="py-3 pe-4 leading-relaxed text-ink-2">{t(r.learns)}</td>
                    <td className="py-3 pe-4 leading-relaxed text-ink-2">{t(r.cannot)}</td>
                    <td className="py-3 leading-relaxed text-ink-2">{t(r.how)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-20 grid gap-10 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
          <div>
            <h2 className="text-[clamp(26px,2.8vw,36px)] font-semibold tracking-tight">{t({ en: 'Why private matching, if the lab holds both results?', ar: 'لماذا المطابقة الخاصة إن كان المختبر يملك النتيجتين؟' })}</h2>
            <p className="mt-4 text-[16px] leading-relaxed text-ink-2">{t({ en: 'In Abu Dhabi today one lab tests both partners, so the lab is trusted and the protocol protects each person from their partner and from everyone in between. The same protocol matters more where no single party holds both results:', ar: 'في أبوظبي اليوم يفحص مختبر واحد الشريكين، فالمختبر موثوق، ويحمي البروتوكول كل شخص من شريكه ومن كل من في الطريق. ويزداد أهمية حيث لا تملك جهة واحدة النتيجتين:' })}</p>
            <ul className="mt-4 list-disc space-y-2.5 ps-5 text-[16px] leading-relaxed text-ink-2">
              <li>{t({ en: 'Partners tested by different authorities: Abu Dhabi and Dubai, the federal programme, or a lab abroad for a non-Emirati spouse. Each lab issues tokens for its own patient only, and no one ever holds both.', ar: 'شريكان فُحصا لدى جهات مختلفة: أبوظبي ودبي، أو البرنامج الاتحادي، أو مختبر في الخارج لزوج غير إماراتي. يصدر كل مختبر رموزاً لمريضه فقط، ولا يملك أحد النتيجتين أبداً.' })}</li>
              <li>{t({ en: 'A reusable results card: test once, compare later with a future partner without retesting.', ar: 'بطاقة نتائج قابلة لإعادة الاستخدام: فحص مرة واحدة ثم مقارنة لاحقاً مع شريك مستقبلي دون إعادة الفحص.' })}</li>
              <li>{t({ en: 'Private and IVF clinics comparing donors or partners across labs.', ar: 'عيادات خاصة وعيادات أطفال الأنابيب تقارن متبرعين أو شركاء عبر مختبرات مختلفة.' })}</li>
            </ul>
            <p className="mt-4 text-[14px] leading-relaxed text-ink-2">{t({ en: 'Cross-lab matching needs the labs to agree one token scheme (a shared or jointly computed token key). That is designed for, not built.', ar: 'تتطلب المطابقة بين المختبرات أن تتفق على نظام رموز واحد (مفتاح رموز مشترك أو محسوب بشكل مشترك). وهذا مصمَّم له، لكنه غير مبني بعد.' })}</p>
          </div>
          <div>
            <h2 className="text-[clamp(22px,2.2vw,28px)] font-semibold tracking-tight">{t({ en: 'What it doesn’t do', ar: 'ما لا يفعله' })}</h2>
            <ul className="mt-4 list-disc space-y-3 ps-5 text-[15px] leading-relaxed text-ink-2">
              <li>{t({ en: 'A match is a match: if you share a gene, your partner learns you carry it. That is the information the couple needs.', ar: 'التطابق تطابق: إن تشاركتما جيناً فسيعرف شريكك أنك تحمله. وهذه هي المعلومة التي يحتاجها الزوجان.' })}</li>
              <li>{t({ en: 'It matches genes, not exact variants. Where the exact pair matters (CAH non-classic alleles, alpha-globin cis or trans, HbS with HbC), the result says so and a counsellor confirms.', ar: 'يطابق الجينات لا المتغيرات بدقة. وحيث يهم الزوج الدقيق (أليلات CAH غير التقليدية، أو ألفا غلوبين على الكروموسوم نفسه أو المقابل، أو HbS مع HbC) تقول النتيجة ذلك ويؤكده المستشار.' })}</li>
              <li>{t({ en: 'Booking a counsellor stores, on the server, exactly what you tick. You can withdraw it.', ar: 'حجز المستشار يحفظ على الخادم ما تختاره بالضبط، ويمكنك سحبه.' })}</li>
              <li>{t({ en: 'It is a prototype and has not been independently audited. A crypto audit and penetration test come before any pilot.', ar: 'إنه نموذج أولي ولم يُدقّق بشكل مستقل. ويسبق أي تجربة تدقيقُ تشفير واختبار اختراق.' })}</li>
            </ul>
          </div>
        </section>

        <section className="mt-20 rounded-[3px] border border-ink bg-paper p-6">
          <h2 className="text-[20px] font-semibold">{t({ en: 'Under the hood', ar: 'من الداخل' })}</h2>
          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 text-[14px]">
            <dt className="text-ink-2">{t({ en: 'Group', ar: 'الزمرة' })}</dt><dd dir="ltr" className="text-start">ristretto255 (RFC 9496), @noble/curves</dd>
            <dt className="text-ink-2">{t({ en: 'Tokens', ar: 'الرموز' })}</dt><dd dir="ltr" className="text-start">hash-to-group (RFC 9380) of HMAC-SHA-256(lab key, session ‖ role tag ‖ gene)</dd>
            <dt className="text-ink-2">{t({ en: 'Matching', ar: 'المطابقة' })}</dt><dd>{t({ en: 'Diffie–Hellman PSI, 64-entry padded sets, CSPRNG shuffles', ar: 'PSI بطريقة ديفي-هيلمان، مجموعات محشوة من 64 عنصراً، خلط عشوائي آمن' })}</dd>
            <dt className="text-ink-2">{t({ en: 'Proofs', ar: 'الإثباتات' })}</dt><dd>{t({ en: 'Batched Chaum–Pedersen DLEQ on every locked list (RFC 9497 style)', ar: 'إثبات DLEQ مجمّع بطريقة Chaum–Pedersen لكل قائمة مقفلة (على نمط RFC 9497)' })}</dd>
            <dt className="text-ink-2">{t({ en: 'Result', ar: 'النتيجة' })}</dt><dd>{t({ en: 'The lab recomputes the match for the two seated people and names only shared genes; the phone’s own answer must agree', ar: 'يعيد المختبر حساب التطابق للشخصين المقترنين ولا يسمّي إلا الجينات المشتركة، ويجب أن تتفق إجابة الهاتف معه' })}</dd>
            <dt className="text-ink-2">{t({ en: 'Relay', ar: 'الوسيط' })}</dt><dd>{t({ en: 'AES-GCM, key from HKDF over the link secret; write-once slots; 10-minute expiry', ar: 'AES-GCM بمفتاح مشتق عبر HKDF من سر الرابط؛ خانات تُكتب مرة واحدة؛ انتهاء بعد 10 دقائق' })}</dd>
            <dt className="text-ink-2">{t({ en: 'Tests', ar: 'الاختبارات' })}</dt><dd><Link className="underline" href={`/${lang}/proof`}>{t({ en: 'see Proof', ar: 'انظر الإثبات' })}</Link></dd>
          </dl>
        </section>
      </main>
      <Footer lang={lang} />
    </>
  );
}
