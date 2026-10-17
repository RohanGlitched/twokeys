import { notFound } from 'next/navigation';
import { hasLocale } from '@/i18n/locales';
import { LetterView } from '@/components/family/LetterView';

export const metadata = { title: 'A note from your family', robots: { index: false } };

export default async function LetterPage({ params }: PageProps<'/[lang]/r/[id]'>) {
  const { lang, id } = await params;
  if (!hasLocale(lang)) notFound();
  return <LetterView lang={lang} id={id} />;
}
