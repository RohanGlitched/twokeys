import { notFound } from 'next/navigation';
import { hasLocale } from '@/i18n/locales';
import { Desk } from '@/components/desk/Desk';

export const metadata = { title: 'Counsellor desk', robots: { index: false } };

export default async function DeskPage({ params }: PageProps<'/[lang]/desk'>) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return <Desk lang={lang} />;
}
