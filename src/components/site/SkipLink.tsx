'use client';

import type { Locale } from '@/i18n/locales';

/* First stop for keyboard users on every page. Targets #main, and falls back to the page's first
   <main> so routes that render their own landmark without an id still work. */
export function SkipLink({ lang }: { lang: Locale }) {
  return (
    <a
      href="#main"
      onClick={(e) => {
        const main = document.getElementById('main') ?? document.querySelector('main');
        if (!main) return;
        e.preventDefault();
        if (!main.hasAttribute('tabindex')) main.setAttribute('tabindex', '-1');
        main.focus({ preventScroll: true });
        main.scrollIntoView();
      }}
      className="sr-only focus:not-sr-only focus:fixed focus:start-3 focus:top-3 focus:z-50 focus:rounded-[2px] focus:border focus:border-ink focus:bg-paper focus:px-4 focus:py-2 focus:text-[14px] focus:text-ink"
    >
      {lang === 'ar' ? 'تخطَّ إلى المحتوى' : 'Skip to content'}
    </a>
  );
}
