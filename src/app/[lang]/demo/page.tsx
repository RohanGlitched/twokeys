import { notFound } from 'next/navigation';
import { hasLocale } from '@/i18n/locales';
import { COUPLES, PEOPLE } from '@/lib/people';
import { personalFindings } from '@/lib/lab';
import { Footer, Nav } from '@/components/site/Chrome';
import { TwoPhones } from '@/components/demo/TwoPhones';
import { titled } from '@/i18n/meta';

export const generateMetadata = titled('Try it with two phones', 'جرّبه بهاتفين');

export default async function DemoPage({ params }: PageProps<'/[lang]/demo'>) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const ar = lang === 'ar';
  const names = Object.fromEntries(PEOPLE.map((p) => [p.id, p.name]));
  // Only who is a woman and who has a result of their own to read first: never what anyone carries.
  const female = PEOPLE.filter((p) => p.sex === 'F').map((p) => p.id);
  const personal = PEOPLE.filter((p) => personalFindings(p.sex, p.findings).length > 0).map((p) => p.id);
  return (
    <>
      <Nav lang={lang} path="/demo" />
      <main id="main" className="mx-auto max-w-6xl px-6 pb-10 pt-4 md:pt-6">
        <h1 className="text-[clamp(28px,3vw,34px)] font-semibold tracking-tight">{ar ? 'جرّبه بهاتفين' : 'Try it with two phones'}</h1>
        <p className="mt-1.5 max-w-3xl text-[15px] leading-relaxed text-ink-2">
          {ar ? 'كل هاتف أدناه تطبيق منفصل يعمل بالبروتوكول الحقيقي عبر المختبر والوسيط الحقيقيين.'
            : 'Each phone below is a separate app running the real protocol through the real lab and relay.'}
        </p>
        <div className="mt-5"><TwoPhones lang={lang} couples={COUPLES} names={names} female={female} personal={personal} /></div>
      </main>
      <Footer lang={lang} />
    </>
  );
}
