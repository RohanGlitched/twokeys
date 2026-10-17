import Link from 'next/link';

export default async function Home({ params }: PageProps<'/[lang]'>) {
  const { lang } = await params;
  return (
    <main className="mx-auto max-w-5xl px-8 py-16">
      <h1 className="text-5xl font-semibold tracking-tight">{lang === 'ar' ? 'مفتاحان' : 'Two Keys'}</h1>
      <p className="mt-6 text-ink-2"><Link href={`/${lang}/demo`}>Demo</Link></p>
    </main>
  );
}
