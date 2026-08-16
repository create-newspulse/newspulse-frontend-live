import { NextRequest, NextResponse } from 'next/server';

const COOKIE_KEY = 'np_locale';
const LEGACY_COOKIE_KEY = 'np_lang';
const NEXT_LOCALE_COOKIE = 'NEXT_LOCALE';

const LOCALES = ['en', 'hi', 'gu'] as const;
type Locale = (typeof LOCALES)[number];

type SeoRedirectCacheEntry =
  | {
      kind: 'redirect';
      destination: string;
      status: 301 | 302;
      preserveQuery: boolean;
      expiresAt: number;
    }
  | {
      kind: 'miss';
      expiresAt: number;
    };

const SEO_REDIRECT_CACHE = new Map<string, SeoRedirectCacheEntry>();
const SEO_REDIRECT_CACHE_MAX_ENTRIES = 100;
const SEO_REDIRECT_301_CACHE_MS = 60_000;
const SEO_REDIRECT_302_CACHE_MS = 20_000;
const SEO_REDIRECT_MISS_CACHE_MS = 10_000;

function normalizeBackendBase(raw: unknown): string {
  return String(raw || '').trim().replace(/\/+$/, '').replace(/\/api\/?$/, '');
}

function getRedirectBackendBase(): string {
  const prod = String(process.env.VERCEL_ENV || '').toLowerCase() === 'production';
  return normalizeBackendBase(
    process.env.NEXT_PUBLIC_API_BASE ||
      (prod ? process.env.NEXT_PUBLIC_API_BASE_PROD : process.env.NEXT_PUBLIC_API_BASE_DEV) ||
      process.env.NEXT_PUBLIC_API_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      'https://newspulse-backend-real.onrender.com'
  );
}

function isPublicRedirectCandidate(pathname: string): boolean {
  const lower = pathname.toLowerCase();
  if (lower === '/admin' || lower.startsWith('/admin/')) return false;
  if (lower === '/admin-api' || lower.startsWith('/admin-api/')) return false;
  if (lower === '/api' || lower.startsWith('/api/')) return false;
  if (lower === '/_next' || lower.startsWith('/_next/')) return false;
  if (lower === '/static' || lower.startsWith('/static/')) return false;
  if (lower === '/favicon.ico' || lower === '/robots.txt' || lower === '/sitemap.xml' || lower === '/news-sitemap.xml') return false;
  if (/\.[a-zA-Z0-9]+$/.test(lower)) return false;
  return true;
}

function normalizeRedirectPathname(pathname: string): string {
  const raw = String(pathname || '/').trim();
  const withLeadingSlash = raw.startsWith('/') ? raw : `/${raw}`;
  let normalized = withLeadingSlash.replace(/\/+/g, '/');
  if (normalized.length > 1) normalized = normalized.replace(/\/+$/, '');
  try {
    normalized = decodeURI(normalized);
  } catch {}
  return normalized || '/';
}

function isDocumentRequest(req: NextRequest): boolean {
  const isNextData = req.headers.get('x-nextjs-data') === '1';
  const isNextPrefetch = req.headers.get('x-nextjs-prefetch') === '1';
  const purpose = (req.headers.get('purpose') || req.headers.get('sec-purpose') || '').toLowerCase();
  const isPrefetch = isNextPrefetch || purpose === 'prefetch';
  const fetchDest = (req.headers.get('sec-fetch-dest') || '').toLowerCase();
  const accept = (req.headers.get('accept') || '').toLowerCase();
  const isDocument = fetchDest === 'document' || accept.includes('text/html') || accept === '';
  return isDocument && !isNextData && !isPrefetch;
}

function pickRedirectPayload(payload: any): any {
  if (!payload || typeof payload !== 'object') return null;
  return payload.redirect || payload.rule || payload.data?.redirect || payload.data || payload;
}

function getRedirectStatus(rule: any): 301 | 302 {
  const raw = Number(rule?.statusCode || rule?.status || rule?.httpStatus || rule?.code || 0);
  if (raw === 301 || String(rule?.type || rule?.redirectType || '').toLowerCase().includes('301') || rule?.permanent === true) return 301;
  return 302;
}

function appendQueryIfAllowed(destination: URL, current: URL, rule: any): URL {
  const preserveQuery = rule?.preserveQuery !== false && rule?.preserveQueryString !== false;
  if (!preserveQuery || !current.search) return destination;
  const next = new URL(destination.toString());
  current.searchParams.forEach((value, key) => {
    if (!next.searchParams.has(key)) next.searchParams.append(key, value);
  });
  return next;
}

function isSafeRedirectDestination(destination: URL): boolean {
  return destination.protocol === 'https:' || destination.protocol === 'http:';
}

function getCacheKey(currentUrl: URL): string {
  return `${currentUrl.host.toLowerCase()}|${normalizeRedirectPathname(currentUrl.pathname).toLowerCase()}`;
}

function getCachedRedirect(cacheKey: string): SeoRedirectCacheEntry | null {
  const entry = SEO_REDIRECT_CACHE.get(cacheKey);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    SEO_REDIRECT_CACHE.delete(cacheKey);
    return null;
  }
  return entry;
}

function setCachedRedirect(cacheKey: string, entry: SeoRedirectCacheEntry) {
  if (SEO_REDIRECT_CACHE.size >= SEO_REDIRECT_CACHE_MAX_ENTRIES) {
    SEO_REDIRECT_CACHE.delete(SEO_REDIRECT_CACHE.keys().next().value as string);
  }
  SEO_REDIRECT_CACHE.set(cacheKey, entry);
}

function buildRedirectResponse(currentUrl: URL, rule: { destination: string; status: 301 | 302; preserveQuery: boolean }): NextResponse | null {
  let destination: URL;
  try {
    destination = new URL(rule.destination, currentUrl.origin);
  } catch {
    return null;
  }

  if (!isSafeRedirectDestination(destination)) return null;
  destination = appendQueryIfAllowed(destination, currentUrl, rule);
  if (destination.origin === currentUrl.origin && destination.pathname === currentUrl.pathname && destination.search === currentUrl.search) return null;

  return NextResponse.redirect(destination, rule.status);
}

async function resolveDynamicSeoRedirect(req: NextRequest): Promise<NextResponse | null> {
  const currentUrl = new URL(req.url);
  const normalizedPathname = normalizeRedirectPathname(currentUrl.pathname);
  if (!isPublicRedirectCandidate(normalizedPathname) || !isDocumentRequest(req)) return null;

  const cacheKey = getCacheKey(currentUrl);
  const cached = getCachedRedirect(cacheKey);
  if (cached?.kind === 'miss') return null;
  if (cached?.kind === 'redirect') {
    return buildRedirectResponse(currentUrl, cached);
  }

  const base = getRedirectBackendBase();
  if (!base) return null;

  const endpoints = [
    '/api/public/seo/redirects/resolve',
    '/api/public/seo-redirects/resolve',
    '/api/public/redirects/resolve',
  ];

  for (const endpoint of endpoints) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1200);
    try {
      const lookup = new URL(`${base}${endpoint}`);
      lookup.searchParams.set('path', normalizedPathname);
      lookup.searchParams.set('url', `${normalizedPathname}${currentUrl.search}`);
      lookup.searchParams.set('host', currentUrl.host);

      const response = await fetch(lookup.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (response.status === 404 || response.status === 204) continue;
      if (!response.ok) continue;

      const json = await response.json().catch(() => null);
      const rule = pickRedirectPayload(json);
      const rawDestination = String(rule?.destination || rule?.destinationUrl || rule?.target || rule?.targetUrl || rule?.to || rule?.url || '').trim();
      if (!rawDestination || rule?.enabled === false || rule?.active === false) continue;

      const status = getRedirectStatus(rule);
      const redirectRule = {
        destination: rawDestination,
        status,
        preserveQuery: rule?.preserveQuery !== false && rule?.preserveQueryString !== false,
      };
      const redirect = buildRedirectResponse(currentUrl, redirectRule);
      if (!redirect) continue;

      setCachedRedirect(cacheKey, {
        kind: 'redirect',
        ...redirectRule,
        expiresAt: Date.now() + (status === 301 ? SEO_REDIRECT_301_CACHE_MS : SEO_REDIRECT_302_CACHE_MS),
      });
      return redirect;
    } catch {
      clearTimeout(timeout);
      continue;
    }
  }

  setCachedRedirect(cacheKey, { kind: 'miss', expiresAt: Date.now() + SEO_REDIRECT_MISS_CACHE_MS });
  return null;
}

function normalizeLocale(raw: unknown): Locale | null {
  const v = String(raw || '').toLowerCase().trim();
  if (v === 'en' || v === 'hi' || v === 'gu') return v;
  if (v === 'english') return 'en';
  if (v === 'hindi') return 'hi';
  if (v === 'gujarati') return 'gu';
  return null;
}

export async function proxy(req: NextRequest) {
  const url = req.nextUrl;
  const pathname = url.pathname;

  // Hard-block legacy PWA endpoints so browsers stop requesting them.
  if (
    pathname === '/manifest.json' ||
    pathname === '/sw.js' ||
    pathname === '/service-worker.js' ||
    pathname.startsWith('/workbox-')
  ) {
    return new NextResponse('PWA disabled', {
      status: 410,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }

  // Skip API and Next internals. (Also skip files with extensions like .png, .js, .css, etc.)
  const originalPathname = new URL(req.url).pathname;
  if (pathname.startsWith('/api') || pathname.startsWith('/_next')) {
    return NextResponse.next();
  }
  if (/\.[a-zA-Z0-9]+$/.test(pathname)) {
    return NextResponse.next();
  }

  const dynamicRedirect = await resolveDynamicSeoRedirect(req);
  if (dynamicRedirect) return dynamicRedirect;

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
  if (pref) {
    res.cookies.set(NEXT_LOCALE_COOKIE, pref, { path: '/', maxAge: 60 * 60 * 24 * 365 });
  }
  return res;
}

export const config = {
  matcher: [
    '/manifest.json',
    '/sw.js',
    '/service-worker.js',
    '/workbox-:path*',
    '/((?!_next|api|.*\\..*).*)',
  ],
};
