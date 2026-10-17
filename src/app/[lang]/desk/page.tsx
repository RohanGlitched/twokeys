import { notFound } from 'next/navigation';
import { hasLocale } from '@/i18n/locales';
import { Desk } from '@/components/desk/Desk';
import { titled } from '@/i18n/meta';

export const generateMetadata = titled('Counsellor desk', 'مكتب المستشار', { robots: { index: false } });

export default async function DeskPage({ params }: PageProps<'/[lang]/desk'>) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return <Desk lang={lang} />;
}
