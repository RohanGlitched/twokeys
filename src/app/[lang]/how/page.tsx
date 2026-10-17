import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasLocale } from '@/i18n/locales';
import { Footer, Nav } from '@/components/site/Chrome';
import { Theatre } from '@/components/how/Theatre';

export const metadata = { title: 'How it works' };
type L = { en: string; ar: string };

const PROPS: { h: L; b: L }[] = [
  { h: { en: 'No forged genes', ar: 'لا جينات مزوّرة' }, b: { en: 'Only the lab can make a token. A partner can’t add genes they don’t carry to fish for the other’s results; Baldi et al. (2011) named this as the open problem in private genetic matching.', ar: 'لا يصنع الرمز إلا المختبر. فلا يستطيع الشريك إضافة جينات لا يحملها للتجسس على نتائج الآخر، وقد سمّى Baldi وآخرون (2011) هذا المشكلة المفتوحة في المطابقة الجينية الخاصة.' } },
  { h: { en: 'No reuse', ar: 'لا إعادة استخدام' }, b: { en: 'Tokens are bound to one pairing. A friend’s card, or an old pairing, matches nothing.', ar: 'الرموز مرتبطة باقتران واحد. فبطاقة صديق أو اقتران قديم لا يطابق شيئاً.' } },
  { h: { en: 'No counting', ar: 'لا عدّ' }, b: { en: 'Every list has 64 entries, so nobody learns how many genes the other carries.', ar: 'كل قائمة فيها 64 عنصراً، فلا يعرف أحد عدد جينات الآخر.' } },
  { h: { en: 'Mild changes stay quiet', ar: 'التغيّرات الخفيفة تبقى هادئة' }, b: { en: 'Tags mean a severe change matches a mild one, but two mild changes (like two GJB2 p.Val37Ile) never raise an alarm.', ar: 'الوسوم تجعل التغيّر الشديد يطابق الخفيف، لكن تغيّرين خفيفين (مثل GJB2 p.Val37Ile مرتين) لا يثيران إنذاراً أبداً.' } },
  { h: { en: 'X-linked handled with care', ar: 'معالجة دقيقة لكروموسوم X' }, b: { en: 'A woman’s X-linked carrier result matters for sons whatever her partner carries, so it is hers alone; it only matches if he is affected.', ar: 'نتيجة المرأة الحاملة على الكروموسوم X تهم أبناءها أياً كان شريكها، فهي لها وحدها، ولا تتطابق إلا إذا كان مصاباً.' } },
  { h: { en: 'A relay that can’t read', ar: 'وسيط لا يستطيع القراءة' }, b: { en: 'Messages are encrypted with a key that lives only in the shared link. Three words on both screens catch a swapped link.', ar: 'الرسائل مشفّرة بمفتاح لا يوجد إلا في الرابط المشترك. وتكشف ثلاث كلمات على الشاشتين أي رابط مُبدّل.' } },
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

        <section className="mt-20 grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-[clamp(26px,2.8vw,36px)] font-semibold tracking-tight">{t({ en: 'What it doesn’t do', ar: 'ما لا يفعله' })}</h2>
            <ul className="mt-5 space-y-3 text-[15px] leading-relaxed text-ink-2">
              <li>{t({ en: 'A match is a match: if you share a gene, your partner learns you carry it. That is the information the couple needs.', ar: 'التطابق تطابق: إن تشاركتما جيناً فسيعرف شريكك أنك تحمله. وهذه هي المعلومة التي يحتاجها الزوجان.' })}</li>
              <li>{t({ en: 'It trusts the lab, which already holds both results and learns that the two paired. In the UAE the programme already tests couples together.', ar: 'يثق بالمختبر الذي يملك النتيجتين أصلاً ويعرف أنهما اقترنا. وفي الإمارات يفحص البرنامج الأزواج معاً أصلاً.' })}</li>
              <li>{t({ en: 'It assumes both phones follow the protocol (semi-honest). A phone can hide its own genes or stop early; it can’t learn more than the match.', ar: 'يفترض أن الهاتفين يتبعان البروتوكول. قد يخفي هاتف جيناته أو يتوقف مبكراً، لكنه لا يعرف أكثر من التطابق.' })}</li>
              <li>{t({ en: 'It is a prototype and has not been independently audited.', ar: 'إنه نموذج أولي ولم يُدقّق بشكل مستقل.' })}</li>
            </ul>
          </div>
          <div className="rounded-[3px] border border-ink bg-paper p-6">
            <h2 className="text-[20px] font-semibold">{t({ en: 'Under the hood', ar: 'من الداخل' })}</h2>
            <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-5 gap-y-2.5 text-[14px]">
              <dt className="text-ink-3">{t({ en: 'Group', ar: 'الزمرة' })}</dt><dd>ristretto255 (RFC 9496), @noble/curves</dd>
              <dt className="text-ink-3">{t({ en: 'Tokens', ar: 'الرموز' })}</dt><dd>hash-to-group (RFC 9380) of HMAC-SHA-256(lab key, session ‖ tag ‖ gene)</dd>
              <dt className="text-ink-3">{t({ en: 'Matching', ar: 'المطابقة' })}</dt><dd>{t({ en: 'Diffie–Hellman PSI, 64-entry padded sets, CSPRNG shuffles', ar: 'PSI بطريقة ديفي-هيلمان، مجموعات محشوة من 64 عنصراً، خلط عشوائي آمن' })}</dd>
              <dt className="text-ink-3">{t({ en: 'Relay', ar: 'الوسيط' })}</dt><dd>{t({ en: 'AES-GCM, key from HKDF over the link secret; write-once slots; 10-minute expiry', ar: 'AES-GCM بمفتاح مشتق عبر HKDF من سر الرابط؛ خانات تُكتب مرة واحدة؛ انتهاء بعد 10 دقائق' })}</dd>
              <dt className="text-ink-3">{t({ en: 'Tests', ar: 'الاختبارات' })}</dt><dd><Link className="underline" href={`/${lang}/proof`}>{t({ en: 'see Proof', ar: 'انظر الإثبات' })}</Link></dd>
            </dl>
          </div>
        </section>
      </main>
      <Footer lang={lang} />
    </>
  );
}
