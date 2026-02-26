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
  // IMPORTANT: with Next i18n enabled, middleware may receive `nextUrl.pathname`
  // with the locale prefix stripped, while `nextUrl.locale` still reflects the
  // requested locale. Rely on `nextUrl.locale` to avoid redirect loops.
  const pathnameLower = pathname.toLowerCase();
  const localeFromPrefix: Locale | null =
    pathnameLower === '/hi' || pathnameLower.startsWith('/hi/')
      ? 'hi'
      : pathnameLower === '/gu' || pathnameLower.startsWith('/gu/')
        ? 'gu'
        : pathnameLower === '/en' || pathnameLower.startsWith('/en/')
          ? 'en'
          : null;

  const nextLocale = normalizeLocale(url.locale);
  const nextDefaultLocale = normalizeLocale(url.defaultLocale) || 'en';

  const localeInPath: Locale | null =
    localeFromPrefix || (nextLocale && nextLocale !== nextDefaultLocale ? nextLocale : null);

  // When URL explicitly sets locale, keep NEXT_LOCALE aligned so Next doesn't mis-detect.
  if (localeInPath) {
    const res = NextResponse.next();
    res.cookies.set(NEXT_LOCALE_COOKIE, localeInPath, { path: '/', maxAge: 60 * 60 * 24 * 365 });
    // Also persist our app preference cookies for consistency.
    res.cookies.set(COOKIE_KEY, localeInPath, { path: '/', maxAge: 60 * 60 * 24 * 365 });
    res.cookies.set(LEGACY_COOKIE_KEY, localeInPath, { path: '/', maxAge: 60 * 60 * 24 * 365 });
    return res;
  }

  // IMPORTANT: Do not auto-redirect based on stored preference.
  // Exception: for legacy /regional/* URLs, we *do* redirect to the user's preferred locale
  // to avoid mixing localized UI with non-localized paths.
  // But do keep NEXT_LOCALE aligned with the user's last choice so SSR + client agree.
  const pref =
    normalizeLocale(req.cookies.get(COOKIE_KEY)?.value) ||
    normalizeLocale(req.cookies.get(LEGACY_COOKIE_KEY)?.value) ||
    normalizeLocale(req.cookies.get(NEXT_LOCALE_COOKIE)?.value) ||
    null;

  if (pref && (pref === 'hi' || pref === 'gu')) {
    const pLower = pathnameLower;
    if (pLower === '/regional' || pLower.startsWith('/regional/')) {
      // Only redirect for real navigations (HTML documents).
      // Next.js prefetch/data requests can otherwise see repeated 307s (e.g. `gujarat.json`)
      // and get stuck retrying, making the page appear unresponsive.
      const isNextData = req.headers.get('x-nextjs-data') === '1';
      const isNextPrefetch = req.headers.get('x-nextjs-prefetch') === '1';
      const purpose = (req.headers.get('purpose') || req.headers.get('sec-purpose') || '').toLowerCase();
      const isPrefetch = isNextPrefetch || purpose === 'prefetch';
      const fetchDest = (req.headers.get('sec-fetch-dest') || '').toLowerCase();
      const accept = (req.headers.get('accept') || '').toLowerCase();
      const isDocument = fetchDest === 'document' || accept.includes('text/html');

      if (!isDocument || isNextData || isPrefetch) {
        const res = NextResponse.next();
        res.cookies.set(NEXT_LOCALE_COOKIE, pref, { path: '/', maxAge: 60 * 60 * 24 * 365 });
        return res;
      }

      const redirectUrl = req.nextUrl.clone();
      redirectUrl.pathname = `/${pref}${pathname}`;

      const res = NextResponse.redirect(redirectUrl, 307);
      res.cookies.set(NEXT_LOCALE_COOKIE, pref, { path: '/', maxAge: 60 * 60 * 24 * 365 });
      res.cookies.set(COOKIE_KEY, pref, { path: '/', maxAge: 60 * 60 * 24 * 365 });
      res.cookies.set(LEGACY_COOKIE_KEY, pref, { path: '/', maxAge: 60 * 60 * 24 * 365 });
      return res;
    }
  }

  const res = NextResponse.next();
  if (pref) {
    res.cookies.set(NEXT_LOCALE_COOKIE, pref, { path: '/', maxAge: 60 * 60 * 24 * 365 });
  }
  return res;
}

export const config = {
  matcher: ['/((?!_next|api|.*\\..*).*)'],
};
