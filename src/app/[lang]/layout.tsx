import type { Metadata } from 'next';
import { Alexandria, IBM_Plex_Mono, Noto_Naskh_Arabic } from 'next/font/google';
import { notFound } from 'next/navigation';
import '../globals.css';
import { hasLocale, LOCALES } from '@/i18n/locales';
import { SkipLink } from '@/components/site/SkipLink';

const alexandria = Alexandria({ variable: '--font-alexandria', subsets: ['latin', 'arabic'], weight: ['300', '400', '500', '600', '700'] });
const naskh = Noto_Naskh_Arabic({ variable: '--font-naskh', subsets: ['arabic'], weight: ['400', '500', '600'] });
const mono = IBM_Plex_Mono({ variable: '--font-plex-mono', subsets: ['latin'], weight: ['400', '500'] });

export async function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

export async function generateMetadata({ params }: LayoutProps<'/[lang]'>): Promise<Metadata> {
  const { lang } = await params;
  const ar = lang === 'ar';
  return {
    title: { default: ar ? 'مفتاحان' : 'Two Keys', template: ar ? '%s · مفتاحان' : '%s · Two Keys' },
    description: ar
      ? 'يقارن الزوجان نتائج الفحص الجيني قبل الزواج داخل هاتفيهما، فيعرفان الجينات المشتركة فقط، ويبقى كل ما عداها خاصاً بكل منهما.'
      : "A couple compares carrier results inside their own phones: they learn only the genes they both carry, and everything else stays private.",
  };
}

export default async function RootLayout({ children, params }: LayoutProps<'/[lang]'>) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <html lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'} className={`${alexandria.variable} ${naskh.variable} ${mono.variable}`}>
      <body className="min-h-dvh">
        <SkipLink lang={lang} />
        {children}
      </body>
    </html>
  );
}
