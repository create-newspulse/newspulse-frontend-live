import { NextRequest, NextResponse } from 'next/server';

const COOKIE_KEY = 'np_locale';
const LEGACY_COOKIE_KEY = 'np_lang';
const NEXT_LOCALE_COOKIE = 'NEXT_LOCALE';

const LOCALES = ['en', 'hi', 'gu'] as const;
type Locale = (typeof LOCALES)[number];

function normalizeLocale(raw: unknown): Locale | null {
  const v = String(raw || '').toLowerCase().trim();
  if (v === 'en' || v === 'hi' || v === 'gu') return v;
  if (v === 'english') return 'en';
  if (v === 'hindi') return 'hi';
  if (v === 'gujarati') return 'gu';
  return null;
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl;

  // Skip API and Next internals. (Also skip files with extensions like .png, .js, .css, etc.)
  const pathname = url.pathname;
  if (pathname.startsWith('/api') || pathname.startsWith('/_next')) {
    return NextResponse.next();
  }
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) {
    return NextResponse.next();
  }

  // Respect explicit locale routes (shareable URLs).
  const pathnameLower = pathname.toLowerCase();
  const localeInPath: Locale | null =
    pathnameLower === '/hi' || pathnameLower.startsWith('/hi/')
      ? 'hi'
      : pathnameLower === '/gu' || pathnameLower.startsWith('/gu/')
        ? 'gu'
        : pathnameLower === '/en' || pathnameLower.startsWith('/en/')
          ? 'en'
          : null;

  // Canonicalize English: /en/* -> /*
  if (localeInPath === 'en') {
    const out = url.clone();
    out.pathname = pathname.replace(/^\/(en)(?=\/|$)/i, '') || '/';
    const res = NextResponse.redirect(out);
    res.cookies.set(NEXT_LOCALE_COOKIE, 'en', { path: '/', maxAge: 60 * 60 * 24 * 365 });
    // Keep app cookies consistent as well.
    res.cookies.set(COOKIE_KEY, 'en', { path: '/', maxAge: 60 * 60 * 24 * 365 });
    res.cookies.set(LEGACY_COOKIE_KEY, 'en', { path: '/', maxAge: 60 * 60 * 24 * 365 });
    return res;
  }

  // When URL explicitly sets locale, keep NEXT_LOCALE aligned so Next doesn't mis-detect.
  if (localeInPath) {
    const res = NextResponse.next();
    res.cookies.set(NEXT_LOCALE_COOKIE, localeInPath, { path: '/', maxAge: 60 * 60 * 24 * 365 });
    // Also persist our app preference cookies for consistency.
    res.cookies.set(COOKIE_KEY, localeInPath, { path: '/', maxAge: 60 * 60 * 24 * 365 });
    res.cookies.set(LEGACY_COOKIE_KEY, localeInPath, { path: '/', maxAge: 60 * 60 * 24 * 365 });
    return res;
  }

  // IMPORTANT: URL prefix is the source of truth.
  // Unprefixed routes must always be English (/) regardless of stored preference.
  const res = NextResponse.next();
  res.cookies.set(NEXT_LOCALE_COOKIE, 'en', { path: '/', maxAge: 60 * 60 * 24 * 365 });
  return res;
}

export const config = {
  matcher: ['/((?!_next|api|.*\\..*).*)'],
};
