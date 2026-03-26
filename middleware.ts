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
  const originalPathname = new URL(req.url).pathname;
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
  const originalLower = originalPathname.toLowerCase();
  const localeFromPrefix: Locale | null =
    originalLower === '/hi' || originalLower.startsWith('/hi/')
      ? 'hi'
      : originalLower === '/gu' || originalLower.startsWith('/gu/')
        ? 'gu'
        : originalLower === '/en' || originalLower.startsWith('/en/')
          ? 'en'
          : null;

  const nextDefaultLocale = normalizeLocale(url.defaultLocale) || 'en';

  // IMPORTANT:
  // Only treat *explicit* locale prefixes as locale-in-path.
  // `nextUrl.locale` can be influenced by NEXT_LOCALE cookie/locale detection even when
  // the URL is unprefixed (e.g. "/"), which would cause locale drift across routes.
  const localeInPath: Locale | null = localeFromPrefix;

  // When URL explicitly sets locale, keep NEXT_LOCALE aligned so Next doesn't mis-detect.
  if (localeInPath) {
    const res = NextResponse.next();
    res.cookies.set(NEXT_LOCALE_COOKIE, localeInPath, { path: '/', maxAge: 60 * 60 * 24 * 365 });
    // Also persist our app preference cookies for consistency.
    res.cookies.set(COOKIE_KEY, localeInPath, { path: '/', maxAge: 60 * 60 * 24 * 365 });
    res.cookies.set(LEGACY_COOKIE_KEY, localeInPath, { path: '/', maxAge: 60 * 60 * 24 * 365 });
    return res;
  }

  // IMPORTANT: Do not auto-redirect based on stored preference for most routes.
  // Exception: enforce language-prefixed routes for key sections to keep language
  // routing consistent and avoid showing English UI/content on Gujarati/Hindi pages.
  // Use cookie `np_lang` first (legacy key), fallback to `np_locale`/NEXT_LOCALE.
  const pref =
    normalizeLocale(req.cookies.get(LEGACY_COOKIE_KEY)?.value) ||
    normalizeLocale(req.cookies.get(COOKIE_KEY)?.value) ||
    normalizeLocale(req.cookies.get(NEXT_LOCALE_COOKIE)?.value) ||
    null;

  const pLower = pathnameLower;
  const needsLangPrefix =
    pLower === '/regional' ||
    pLower.startsWith('/regional/') ||
    pLower === '/national' ||
    pLower.startsWith('/national/') ||
    pLower === '/news' ||
    pLower.startsWith('/news/');

  // If the request is already locale-prefixed, we returned earlier.
  // Here we only handle unprefixed legacy URLs.
  if (needsLangPrefix) {
    const targetLocale: Locale = pref || nextDefaultLocale;

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
      if (pref) res.cookies.set(NEXT_LOCALE_COOKIE, pref, { path: '/', maxAge: 60 * 60 * 24 * 365 });
      return res;
    }

    // IMPORTANT:
    // Do NOT force the default locale prefix (e.g. /en). Many Next deployments
    // normalize default-locale URLs back to the unprefixed form which can create
    // a self-redirect loop if middleware keeps trying to add /en.
    if (targetLocale === nextDefaultLocale) {
      const res = NextResponse.next();
      if (pref) res.cookies.set(NEXT_LOCALE_COOKIE, pref, { path: '/', maxAge: 60 * 60 * 24 * 365 });
      return res;
    }

    // Build an explicit locale-prefixed path (non-default locales only). Using the original
    // request pathname avoids issues where Next's nextUrl.pathname has the locale prefix stripped.
    const redirectUrl = new URL(req.url);
    redirectUrl.pathname = `/${targetLocale}${originalPathname}`;

    const res = NextResponse.redirect(redirectUrl, 307);
    res.cookies.set(NEXT_LOCALE_COOKIE, targetLocale, { path: '/', maxAge: 60 * 60 * 24 * 365 });
    res.cookies.set(COOKIE_KEY, targetLocale, { path: '/', maxAge: 60 * 60 * 24 * 365 });
    res.cookies.set(LEGACY_COOKIE_KEY, targetLocale, { path: '/', maxAge: 60 * 60 * 24 * 365 });
    return res;
  }

  const res = NextResponse.next();

  // Strict routing: unprefixed URLs render in the default locale.
  // Keep user preference in our own cookies (np_lang/np_locale), but do not let NEXT_LOCALE
  // switch locale for unprefixed pages like "/" or "/latest".
  res.cookies.set(NEXT_LOCALE_COOKIE, nextDefaultLocale, { path: '/', maxAge: 60 * 60 * 24 * 365 });
  return res;
}

export const config = {
  matcher: ['/((?!_next|api|.*\\..*).*)'],
};
