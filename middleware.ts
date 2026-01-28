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

function localeFromAcceptLanguage(header: string | null): Locale | null {
  const h = String(header || '').toLowerCase();
  // Handle values like: "hi-IN,hi;q=0.9,en-US;q=0.8,en;q=0.7"
  if (/(^|[,;\s])gu([-_][a-z]{2})?($|[,;\s])/.test(h)) return 'gu';
  if (/(^|[,;\s])hi([-_][a-z]{2})?($|[,;\s])/.test(h)) return 'hi';
  if (/(^|[,;\s])en([-_][a-z]{2})?($|[,;\s])/.test(h)) return 'en';
  return null;
}

function getPreferredFromCookies(req: NextRequest): Locale | null {
  return (
    normalizeLocale(req.cookies.get(COOKIE_KEY)?.value) ||
    normalizeLocale(req.cookies.get(LEGACY_COOKIE_KEY)?.value) ||
    normalizeLocale(req.cookies.get(NEXT_LOCALE_COOKIE)?.value) ||
    null
  );
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl;

  // Skip API and Next internals. (Also skip files with extensions like .png, .js, .css, etc.)
  const pathname = url.pathname;
  if (
    pathname.startsWith('/api') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/public-api') ||
    pathname.startsWith('/admin-api') ||
    pathname.startsWith('/public/broadcast') ||
    pathname.startsWith('/public/ui-labels')
  ) {
    return NextResponse.next();
  }
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) {
    return NextResponse.next();
  }

  const pathnameLower = pathname.toLowerCase();

  // Extract all leading locale segments (handles malformed stacked paths like /gu/hi/...).
  const segments = pathnameLower.split('/').filter(Boolean);
  const leadingLocales: Locale[] = [];
  for (const seg of segments) {
    const loc = normalizeLocale(seg);
    if (!loc) break;
    leadingLocales.push(loc);
  }

  // 1) Canonicalize stacked locale prefixes -> keep the LAST one.
  if (leadingLocales.length > 1) {
    const chosen = leadingLocales[leadingLocales.length - 1];
    const restSegs = segments.slice(leadingLocales.length);
    const nextPathname =
      chosen === 'en'
        ? `/${restSegs.join('/')}`.replace(/\/+/, '/') || '/'
        : `/${chosen}${restSegs.length ? `/${restSegs.join('/')}` : ''}`;
    const redirectUrl = url.clone();
    redirectUrl.pathname = nextPathname;
    const res = NextResponse.redirect(redirectUrl);
    res.cookies.set(NEXT_LOCALE_COOKIE, chosen, { path: '/', maxAge: 60 * 60 * 24 * 365 });
    res.cookies.set(COOKIE_KEY, chosen, { path: '/', maxAge: 60 * 60 * 24 * 365 });
    res.cookies.set(LEGACY_COOKIE_KEY, chosen, { path: '/', maxAge: 60 * 60 * 24 * 365 });
    return res;
  }

  const localeInPath: Locale | null = leadingLocales.length === 1 ? leadingLocales[0] : null;

  // 2) Unprefixed URLs are valid and represent English.
  // However, if the user previously selected Hindi/Gujarati and then navigates to an
  // unprefixed URL (e.g. via an unlocalized link), redirect to the saved locale.
  // We intentionally do NOT use Accept-Language here to avoid forcing Hindi by default.
  if (!localeInPath) {
    const preferred = getPreferredFromCookies(req);
    if (preferred && preferred !== 'en') {
      const redirectUrl = url.clone();
      redirectUrl.pathname = pathnameLower === '/' ? `/${preferred}` : `/${preferred}${pathnameLower}`;
      return NextResponse.redirect(redirectUrl);
    }
    return NextResponse.next();
  }

  // 3) Canonicalize /en/* to unprefixed English.
  if (localeInPath === 'en') {
    const rest = pathname.replace(new RegExp(`^\\/en(?=\\/|$)`, 'i'), '');
    const redirectUrl = url.clone();
    redirectUrl.pathname = rest === '' ? '/' : rest;
    const res = NextResponse.redirect(redirectUrl);
    res.cookies.set(NEXT_LOCALE_COOKIE, 'en', { path: '/', maxAge: 60 * 60 * 24 * 365 });
    res.cookies.set(COOKIE_KEY, 'en', { path: '/', maxAge: 60 * 60 * 24 * 365 });
    res.cookies.set(LEGACY_COOKIE_KEY, 'en', { path: '/', maxAge: 60 * 60 * 24 * 365 });
    return res;
  }

  // 4) Serve locale-prefixed URLs by rewriting to the underlying Next route.
  // Example: /hi/news -> internally route to /news (URL stays /hi/news)
  const rest = pathname.replace(new RegExp(`^\/${localeInPath}(?=\/|$)`, 'i'), '');
  const rewriteUrl = url.clone();
  rewriteUrl.pathname = rest === '' ? '/' : rest;

  const res = NextResponse.rewrite(rewriteUrl);
  res.cookies.set(NEXT_LOCALE_COOKIE, localeInPath, { path: '/', maxAge: 60 * 60 * 24 * 365 });
  res.cookies.set(COOKIE_KEY, localeInPath, { path: '/', maxAge: 60 * 60 * 24 * 365 });
  res.cookies.set(LEGACY_COOKIE_KEY, localeInPath, { path: '/', maxAge: 60 * 60 * 24 * 365 });
  return res;
}

export const config = {
  matcher: ['/', '/((?!_next|api|.*\\..*).*)'],
};
