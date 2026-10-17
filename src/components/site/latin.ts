import localFont from 'next/font/local';

/**
 * Alexandria's Latin subset under its own family name (OFL; the same file next/font/google serves),
 * for Arabic pages: listed ahead of Naskh, it draws only Latin letters, digits and punctuation, and
 * never claims Arabic letters or the joiners between them. No metric fallback face, since a local
 * fallback font would cover Arabic too and pre-empt Naskh.
 */
export const latin = localFont({
  src: './alexandria-latin.woff2',
  weight: '100 900',
  display: 'swap',
  adjustFontFallback: false,
  fallback: [],
  declarations: [{ prop: 'unicode-range', value: 'U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2013-2014, U+2018-201E, U+2022, U+2026, U+20AC, U+2122, U+2212' }],
});
