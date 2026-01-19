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

  const cookieValue =
    req.cookies.get(COOKIE_KEY)?.value ??
    req.cookies.get(LEGACY_COOKIE_KEY)?.value ??
    req.cookies.get(NEXT_LOCALE_COOKIE)?.value;
  const preferred = normalizeLocale(cookieValue);

  // Respect explicit locale routes (shareable URLs).
  // Only redirect when the request is for the default locale (unprefixed routes like '/').
  const pathnameLower = pathname.toLowerCase();
  const localeInPath: Locale | null =
    pathnameLower === '/hi' || pathnameLower.startsWith('/hi/')
      ? 'hi'
      : pathnameLower === '/gu' || pathnameLower.startsWith('/gu/')
        ? 'gu'
        : pathnameLower === '/en' || pathnameLower.startsWith('/en/')
          ? 'en'
          : null;

  // When URL explicitly sets locale, keep NEXT_LOCALE aligned so Next doesn't mis-detect.
  if (localeInPath) {
    const res = NextResponse.next();
    res.cookies.set(NEXT_LOCALE_COOKIE, localeInPath, { path: '/', maxAge: 60 * 60 * 24 * 365 });
    // Also persist our app preference cookies for consistency.
    res.cookies.set(COOKIE_KEY, localeInPath, { path: '/', maxAge: 60 * 60 * 24 * 365 });
    res.cookies.set(LEGACY_COOKIE_KEY, localeInPath, { path: '/', maxAge: 60 * 60 * 24 * 365 });
    return res;
  }

  if (!preferred) return NextResponse.next();

  const current = normalizeLocale(url.locale) ?? 'en';
  if (preferred === current) return NextResponse.next();
  if (current !== 'en') return NextResponse.next();

  const next = url.clone();
  next.locale = preferred;
  const res = NextResponse.redirect(next);
  res.cookies.set(NEXT_LOCALE_COOKIE, preferred, { path: '/', maxAge: 60 * 60 * 24 * 365 });
  return res;
}

export const config = {
  matcher: ['/((?!_next|api|.*\\..*).*)'],
};
