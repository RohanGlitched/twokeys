import { notFound } from 'next/navigation';
import { hasLocale } from '@/i18n/locales';
import { Footer, Nav } from '@/components/site/Chrome';
import { Programme } from '@/components/programme/Programme';

export const metadata = { title: 'Programme view' };

export default async function ProgrammePage({ params }: PageProps<'/[lang]/programme'>) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const ar = lang === 'ar';
  return (
    <>
      <Nav lang={lang} path="/programme" />
      <main className="mx-auto max-w-[1240px] px-6 pb-10 pt-6 md:px-8">
        <p className="text-[13px] text-ink-3">{ar ? 'للجهة الصحية · بيانات حية من هذا العرض' : 'For the health authority · live from this demo'}</p>
        <h1 className="mt-1 max-w-3xl text-[clamp(30px,3.4vw,44px)] font-semibold leading-tight tracking-tight">
          {ar ? 'هل يفهم الناس نتائجهم ويصلون إلى الرعاية في الوقت؟' : 'Do people understand their results, and reach care in time?'}
        </h1>
        <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-ink-2">
          {ar ? 'هذه الأرقام حية من هذا العرض، بما فيها الحالات الافتراضية المزروعة ومن يجرّبه الآن. لا تُظهر أي فرد.' : 'These numbers are live from this demo, including its seeded synthetic cases and anyone trying it now. None of them shows a person.'}
        </p>
        <div className="mt-10"><Programme lang={lang} /></div>
      </main>
      <Footer lang={lang} />
    </>
  );
}
