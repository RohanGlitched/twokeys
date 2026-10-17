'use client';

import type { Locale } from '@/i18n/locales';
import { latin } from './latin';

/* First stop for keyboard users on every page. Targets #main, and falls back to the page's first
   <main> so routes that render their own landmark without an id still work. Being on every page, it
   also names the Latin-only face that Arabic pages put ahead of Naskh (see globals.css). */
export function SkipLink({ lang }: { lang: Locale }) {
  return (
    <>
      <style>{`:root{--font-latin:${latin.style.fontFamily}}`}</style>
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
    </>
  );
}
