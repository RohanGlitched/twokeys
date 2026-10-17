import { notFound } from 'next/navigation';
import { hasLocale } from '@/i18n/locales';
import { COUPLES, PEOPLE } from '@/lib/people';
import { TwoPhones } from '@/components/demo/TwoPhones';
import { titled } from '@/i18n/meta';

export const generateMetadata = titled('Try it with two phones', 'جرّبه بهاتفين');

export default async function DemoPage({ params }: PageProps<'/[lang]/demo'>) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const ar = lang === 'ar';
  const names = Object.fromEntries(PEOPLE.map((p) => [p.id, p.name]));
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-[34px] font-semibold tracking-tight">{ar ? 'جرّبه بهاتفين' : 'Try it with two phones'}</h1>
      <p className="mt-2 max-w-2xl text-[16px] leading-relaxed text-ink-2">
        {ar ? 'كل هاتف أدناه تطبيق منفصل يعمل بالبروتوكول الحقيقي عبر المختبر والوسيط الحقيقيين. اقرأ الكلمات الثلاث على الهاتفين، ثم اضغط «قارن» على كل منهما.'
          : 'Each phone below is a separate app running the real protocol through the real lab and relay. Check that both show the same three words, then press Compare on each.'}
      </p>
      <div className="mt-8"><TwoPhones lang={lang} couples={COUPLES} names={names} /></div>
    </main>
  );
}
