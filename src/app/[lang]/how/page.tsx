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
  { h: { en: 'Both people confirm who joined', ar: 'يؤكد الطرفان هوية من انضم' }, b: { en: 'Each seat is claimed once, atomically. The person who made the link sees the joiner’s signed-in name first and confirms it; only then does the joiner see whose link it was and confirm in turn. The lab issues no tokens until both have said yes, so someone who photographed the code learns no name and no result.', ar: 'يُحجز كل مقعد مرة واحدة فقط. يرى صاحب الرابط اسم من انضم أولاً ويؤكده، وعندها فقط يرى المنضم صاحب الرابط ويؤكده بدوره. ولا يصدر المختبر أي رمز حتى يوافق الاثنان، فمن صوّر الرمز لا يعرف اسماً ولا نتيجة.' } },
  { h: { en: 'Honest re-locking, proved', ar: 'إعادة قفل أمينة، مُثبتة' }, b: { en: 'Each phone proves to the lab that its first lock used one secret on exactly the tokens it was issued; the lab signs that lock, and the partner checks the signature. Every re-lock then comes with a short proof (batched Chaum–Pedersen, as in RFC 9497) that the same secret was used. A cheating phone is rejected at either step.', ar: 'يثبت كل هاتف للمختبر أن قفله الأول استخدم سراً واحداً على الرموز التي أُعطيت له بالضبط، فيوقّع المختبر ذلك القفل ويتحقق الشريك من التوقيع. ثم تصل كل إعادة قفل مع إثبات قصير (Chaum–Pedersen مجمّع، كما في RFC 9497) أن السر نفسه استُخدم. ويُرفض الهاتف الغاش في أي من الخطوتين.' } },
  { h: { en: 'No counting', ar: 'لا عدّ' }, b: { en: 'The lab hands every phone exactly 64 tokens, real ones hidden among decoys in a lab-keyed order, and the same list every time it is asked, so neither the partner nor anyone holding the phone learns how many findings there are.', ar: 'يعطي المختبر كل هاتف 64 رمزاً بالضبط، تختبئ الحقيقية بين رموز تمويهية بترتيب يحدده مفتاح المختبر، والقائمة نفسها في كل مرة، فلا يعرف الشريك ولا من يحمل الهاتف عدد النتائج.' } },
  { h: { en: 'Severity-aware matching', ar: 'مطابقة تراعي الشدة' }, b: { en: 'Role tags grade a shared gene as a full match, a milder match (one milder change) or a low-concern match (two milder changes). One trade-off: for a shared gene, your partner learns whether your change is the milder one, because the chance depends on it.', ar: 'تصنّف الوسوم الجين المشترك كتطابق كامل أو أخف (تغيّر أخف لدى أحدكما) أو منخفض الأثر (تغيّران أخفان). ومقابل ذلك: في الجين المشترك يعرف شريكك إن كان تغيّرك هو الأخف، لأن الاحتمال يعتمد عليه.' } },
  { h: { en: 'X-linked results reach the person', ar: 'نتائج كروموسوم X تصل إلى صاحبها' }, b: { en: 'An X-linked result matters whoever the partner is (a woman’s sons; a man’s own health and daughters), so it comes to the person as a personal result, never only through a pairing.', ar: 'تهم نتيجة الكروموسوم X أياً كان الشريك (أبناء المرأة، وصحة الرجل وبناته)، لذا تصل إلى صاحبها كنتيجة شخصية، لا عبر الاقتران وحده.' } },
];

type Row = { who: L; learns: L; cannot: L; how: L };
const THREATS: Row[] = [
  { who: { en: 'Your partner', ar: 'شريكك' },
    learns: { en: 'The genes you both carry and whether each change is the milder one (that is the point), and that you took part.', ar: 'الجينات التي تحملانها معاً وهل التغيّر هو الأخف (وهذا هو الغرض)، وأنك شاركت.' },
    cannot: { en: 'Any gene only you carry, or how many you carry, unless you both choose to see everything.', ar: 'أي جين تحمله وحدك، أو عدد جيناتك، إلا إذا اخترتما معاً رؤية كل شيء.' },
    how: { en: 'Lab-only tokens, 64 per phone with decoys, proofs on re-locks', ar: 'رموز لا يصنعها إلا المختبر، 64 لكل هاتف مع رموز تمويهية، وإثبات لإعادة القفل' } },
  { who: { en: 'Someone who sees the pairing code', ar: 'من يرى رمز الاقتران' },
    learns: { en: 'Nothing: not even the name of the person who shared it, unless that person confirms them by name.', ar: 'لا شيء، ولا حتى اسم صاحب الرمز، إلا إذا أكده صاحب الرمز بالاسم.' },
    cannot: { en: 'Take a seat silently: the lab issues no tokens until both seated people confirm each other.', ar: 'حجز مقعد خفية: فلا يصدر المختبر أي رمز حتى يؤكد الطرفان بعضهما.' },
    how: { en: 'Atomic seats; creator confirms first; tokens only after both confirm', ar: 'مقاعد ذرية، ويؤكد صاحب الرابط أولاً، ولا رموز إلا بعد تأكيد الطرفين' } },
  { who: { en: 'A modified phone', ar: 'هاتف معدَّل' },
    learns: { en: 'No more than an honest phone. It can refuse to finish.', ar: 'لا أكثر من الهاتف الأمين، ويمكنه رفض الإكمال.' },
    cannot: { en: 'Fake a match, hide one, or show its partner a wrong result: its first lock is attested by the lab, its re-locks are proved, and the lab names a gene only when both phones’ comparisons and its own records agree. Otherwise nothing is named.', ar: 'تزوير تطابق أو إخفاؤه أو عرض نتيجة خاطئة على الشريك: فقفله الأول يشهد عليه المختبر، وإعادة القفل مُثبتة، ولا يسمّي المختبر جيناً إلا إذا اتفقت مقارنتا الهاتفين مع سجلاته، وإلا فلا يُسمّى شيء.' },
    how: { en: 'Lab-attested first lock; proofs on re-locks; names only on agreement', ar: 'قفل أول يشهد عليه المختبر، وإثبات لإعادة القفل، وتسمية عند الاتفاق فقط' } },
  { who: { en: 'The relay', ar: 'الوسيط' },
    learns: { en: 'That two devices exchanged a few kilobytes, and when.', ar: 'أن جهازين تبادلا بضعة كيلوبايتات، ومتى.' },
    cannot: { en: 'Read anything: messages are encrypted with a key that never reaches a server.', ar: 'قراءة أي شيء: فالرسائل مشفّرة بمفتاح لا يصل إلى أي خادم.' },
    how: { en: 'AES-GCM, key in the link #fragment; write-once slots; unreadable after 10 minutes, deleted by the database within 48 hours', ar: 'AES-GCM بمفتاح في جزء الرابط بعد #، وخانات تُكتب مرة، ولا تُقرأ بعد 10 دقائق وتحذفها قاعدة البيانات خلال 48 ساعة' } },
  { who: { en: 'The lab (single-lab setting, today)', ar: 'المختبر (مختبر واحد، اليوم)' },
    learns: { en: 'That these two people paired, and the match it names: it computes the match from its own records, as it can today, since it already holds both results. Who paired with whom is kept for one day.', ar: 'أن هذين الشخصين اقترنا، والتطابق الذي يسمّيه: فهو يحسب التطابق من سجلاته كما يستطيع اليوم، إذ يملك النتيجتين أصلاً. ويُحفظ من اقترن بمن ليوم واحد.' },
    cannot: { en: 'Nothing new about either person. It is trusted, as it is today. In this demo the lab and the relay run on one server; in production they are separate operators.', ar: 'لا شيء جديد عن أي منهما، فهو موثوق كما هو اليوم. وفي هذا العرض يعمل المختبر والوسيط على خادم واحد، وفي الإنتاج يشغّلهما طرفان منفصلان.' },
    how: { en: 'Trust, audit, and law (Decree-Law 49/2023)', ar: 'الثقة والتدقيق والقانون (المرسوم بقانون 49/2023)' } },
  { who: { en: 'A genetic counsellor', ar: 'المرشد الوراثي' },
    learns: { en: 'Only what a person ticked when booking; the shared genes come from the lab. The queue shows names, clocks and counts only; every case opened and every queue read is logged.', ar: 'ما اختاره الشخص عند الحجز فقط، والجينات المشتركة يحددها المختبر. وتعرض القائمة الأسماء والمواعيد والأعداد فقط، وتُسجَّل كل حالة تُفتح وكل قراءة للقائمة.' },
    cannot: { en: 'See a partner’s own results, or what was shared after consent is withdrawn. Demo: one passcode with a chosen name; production: per-clinician sign-in.', ar: 'رؤية نتائج الشريك الخاصة، أو ما شُورك بعد سحب الموافقة. في العرض: رمز مرور واحد مع اسم يُختار؛ وفي الإنتاج: دخول لكل طبيب.' },
    how: { en: 'Itemised consent; keyed and sealed audit chain (anchored outside the database in production); summaries-only queue; sign-in locked after 20 failures an hour', ar: 'موافقة مفصّلة، وسلسلة تدقيق بمفتاح وختم (تُثبَّت خارج قاعدة البيانات في الإنتاج)، وقائمة بملخصات فقط، وقفل الدخول بعد 20 محاولة فاشلة في الساعة' } },
  { who: { en: 'A health-authority analyst', ar: 'محلل في الجهة الصحية' },
    learns: { en: 'Weekly aggregate counts with random noise, each person counted once and in one week only; groups under 5 hidden.', ar: 'أعداد إجمالية أسبوعية مع ضجيج عشوائي، يُحتسب فيها كل شخص مرة واحدة وفي أسبوع واحد؛ وتُحجب المجموعات الأصغر من 5.' },
    cannot: { en: 'Any individual, which couples share a gene, or any marriage or pregnancy decision.', ar: 'أي فرد، أو أي زوجين يتشاركان جيناً، أو أي قرار زواج أو حمل.' },
    how: { en: 'Exact discrete Laplace noise, per-person caps, one release per week of records, ε = 3 per person for life', ar: 'ضجيج لابلاس متقطع دقيق، وحدود لكل شخص، وإصدار واحد لكل أسبوع من السجلات، وε = 3 لكل شخص مدى الحياة' } },
  { who: { en: 'Anyone else on the internet', ar: 'أي شخص آخر على الإنترنت' },
    learns: { en: 'In this demo, anyone may sign in as any synthetic person; there are no real people. In production, nothing about a person.', ar: 'في هذا العرض يمكن لأي شخص الدخول باسم أي شخص افتراضي، ولا يوجد أشخاص حقيقيون. وفي الإنتاج: لا شيء عن أي شخص.' },
    cannot: { en: 'In production: get tokens or results without UAE PASS, or join someone’s pairing without being confirmed.', ar: 'في الإنتاج: الحصول على رموز أو نتائج دون UAE PASS، أو الانضمام إلى اقتران غيره دون تأكيده.' },
    how: { en: 'Signed identity (UAE PASS in production), atomic seats, named confirmation, rate limits', ar: 'هوية موقّعة (UAE PASS في الإنتاج)، ومقاعد ذرية، وتأكيد بالاسم، وحدود للطلبات' } },
];

export default async function HowPage({ params }: PageProps<'/[lang]/how'>) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const t = (l: L) => l[lang];
  return (
    <>
      <Nav lang={lang} path="/how" />
      <main className="mx-auto max-w-[1240px] px-6 pt-6 md:px-8">
        <h1 className="max-w-3xl text-[clamp(32px,3.6vw,48px)] font-semibold leading-tight tracking-tight">{t({ en: 'How two phones and a lab find a shared gene without showing anything else', ar: 'كيف يجد هاتفان ومختبر جيناً مشتركاً دون كشف أي شيء آخر' })}</h1>
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
            <dt className="text-ink-2">{t({ en: 'Matching', ar: 'المطابقة' })}</dt><dd>{t({ en: 'Diffie–Hellman PSI; 64 tokens per seat in a lab-keyed order, identical on every request; CSPRNG shuffles on the phone', ar: 'PSI بطريقة ديفي-هيلمان؛ 64 رمزاً لكل مقعد بترتيب يحدده مفتاح المختبر، ثابتة في كل طلب؛ وخلط عشوائي آمن على الهاتف' })}</dd>
            <dt className="text-ink-2">{t({ en: 'Proofs', ar: 'الإثباتات' })}</dt><dd>{t({ en: 'First lock: DLEQ proof to the lab, which signs it (Ed25519) for the partner. Re-locks: batched Chaum–Pedersen DLEQ (RFC 9497 style)', ar: 'القفل الأول: إثبات DLEQ للمختبر الذي يوقّعه (Ed25519) للشريك. وإعادة القفل: إثبات DLEQ مجمّع بطريقة Chaum–Pedersen (على نمط RFC 9497)' })}</dd>
            <dt className="text-ink-2">{t({ en: 'Result', ar: 'النتيجة' })}</dt><dd>{t({ en: 'Each phone reports its matched tokens; the lab names the shared genes only if both reports equal its own computation, and names nothing otherwise', ar: 'يبلغ كل هاتف عن رموزه المتطابقة؛ ولا يسمّي المختبر الجينات المشتركة إلا إذا ساوى البلاغان حسابه، ولا يسمّي شيئاً غير ذلك' })}</dd>
            <dt className="text-ink-2">{t({ en: 'Relay', ar: 'الوسيط' })}</dt><dd>{t({ en: 'AES-GCM, key from HKDF over the link secret; write-once slots; unreadable after 10 minutes, deleted by the database within 48 hours', ar: 'AES-GCM بمفتاح مشتق عبر HKDF من سر الرابط؛ خانات تُكتب مرة واحدة؛ لا تُقرأ بعد 10 دقائق وتُحذف خلال 48 ساعة' })}</dd>
            <dt className="text-ink-2">{t({ en: 'Tests', ar: 'الاختبارات' })}</dt><dd><Link className="underline" href={`/${lang}/proof`}>{t({ en: 'see Proof', ar: 'انظر الإثبات' })}</Link></dd>
          </dl>
        </section>
      </main>
      <Footer lang={lang} />
    </>
  );
}
