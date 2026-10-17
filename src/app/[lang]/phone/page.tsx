import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { hasLocale } from '@/i18n/locales';
import { COUPLES, PEOPLE, publicPerson } from '@/lib/people';
import { PhoneRoute } from '@/components/phone/PhoneRoute';

export const metadata = { title: 'Phone' };

export default async function PhonePage({ params }: PageProps<'/[lang]/phone'>) {
  const { lang } = await params;
  if (!hasLocale(lang)) notFound();
  return (
    <Suspense fallback={<div className="p-6 text-ink-3">…</div>}>
      <PhoneRoute lang={lang} people={PEOPLE.map(publicPerson)} couples={COUPLES} />
    </Suspense>
  );
}
