import { NextResponse, type NextRequest } from 'next/server';

const LOCALES = ['en', 'ar'] as const;

/** Sends a bare path to its language: Arabic when the browser prefers it, otherwise English. */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`))) return;
  const prefersArabic = /^\s*ar\b/i.test(request.headers.get('accept-language') ?? '');
  const url = request.nextUrl.clone();
  url.pathname = `/${prefersArabic ? 'ar' : 'en'}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
