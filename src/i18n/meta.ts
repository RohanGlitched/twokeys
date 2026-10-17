import type { Metadata } from 'next';

/** A page title in both languages; the layout's template adds the product name. */
export function titled(en: string, ar: string, extra: Metadata = {}) {
  return async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
    const { lang } = await params;
    return { title: lang === 'ar' ? ar : en, ...extra };
  };
}
