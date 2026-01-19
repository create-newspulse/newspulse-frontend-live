import { NextRequest, NextResponse } from 'next/server';

const COOKIE_KEY = 'np_lang';
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

  const cookieValue = req.cookies.get(COOKIE_KEY)?.value ?? req.cookies.get(NEXT_LOCALE_COOKIE)?.value;
  const preferred = normalizeLocale(cookieValue);
  if (!preferred) return NextResponse.next();

  const current = normalizeLocale(url.locale) ?? 'en';
  if (preferred === current) return NextResponse.next();

  const next = url.clone();
  next.locale = preferred;
  return NextResponse.redirect(next);
}

export const config = {
  matcher: ['/((?!_next|api|.*\\..*).*)'],
};
