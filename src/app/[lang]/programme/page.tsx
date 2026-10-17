import { notFound } from 'next/navigation';
import { hasLocale } from '@/i18n/locales';
import { Footer, Nav } from '@/components/site/Chrome';
import { Programme } from '@/components/programme/Programme';
import { titled } from '@/i18n/meta';

export const generateMetadata = titled('Programme view', 'عرض البرنامج');

export default async function ProgrammePage({ params }: PageProps<'/[lang]/programme'>) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  const ar = lang === 'ar';
  return (
    <>
      <Nav lang={lang} path="/programme" />
      <main className="mx-auto max-w-[1240px] px-6 pb-10 pt-6 md:px-8">
        <p className="text-[13px] text-ink-2">{ar ? 'للجهة الصحية' : 'For the health authority'}</p>
        <h1 className="mt-1 max-w-3xl text-[clamp(30px,3.4vw,44px)] font-semibold leading-tight tracking-tight">
          {ar ? 'هل يفهم الناس نتائجهم ويصلون إلى الرعاية في الوقت؟' : 'Do people understand their results, and reach care in time?'}
        </h1>
        <p className="mt-3 max-w-2xl text-[16px] leading-relaxed text-ink-2">
          {ar ? 'ما يحدث فعلاً عند من يجرّب هذا العرض، وإلى جانبه شهر افتراضي موسوم بوضوح يبيّن شكل العرض على نطاق واسع. لا يُظهر أي رقم فرداً بعينه.' : 'What is actually happening as people try this demo, next to a clearly labelled synthetic month that shows the view at scale. No number shows a person.'}
        </p>
        <div className="mt-10"><Programme lang={lang} /></div>
      </main>
      <Footer lang={lang} />
    </>
  );
}
