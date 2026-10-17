export const LOCALES = ['en', 'ar'] as const;
export type Locale = (typeof LOCALES)[number];
export const hasLocale = (l: string): l is Locale => (LOCALES as readonly string[]).includes(l);
