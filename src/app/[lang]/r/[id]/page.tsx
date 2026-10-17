import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { hasLocale } from '@/i18n/locales';
import { LetterView } from '@/components/family/LetterView';

export const metadata = { title: 'A note from your family', robots: { index: false } };

async function Letter({ params }: { params: PageProps<'/[lang]/r/[id]'>['params'] }) {
  const { lang, id } = await params;
  if (!hasLocale(lang)) notFound();
  return <LetterView lang={lang} id={id} />;
}

export default function LetterPage({ params }: PageProps<'/[lang]/r/[id]'>) {
  return (
    <Suspense fallback={<main className="mx-auto max-w-xl px-6 py-10"><div className="h-40 animate-pulse bg-wool-2" /></main>}>
      <Letter params={params} />
    </Suspense>
  );
}
