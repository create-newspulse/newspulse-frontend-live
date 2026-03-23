export type ArticleAnalyticsLang = 'en' | 'hi' | 'gu';

export type ArticleAnalyticsDeviceType = 'mobile' | 'tablet' | 'desktop';

export type ArticleAnalyticsSource =
  | 'homepage'
  | 'latest'
  | 'category'
  | 'related'
  | 'search'
  | 'google'
  | 'social'
  | 'direct'
  | 'unknown';

export type ArticleAnalyticsBasePayload = {
  visitorId: string;
  sessionId: string;
  ts: number;
  url: string;
  referrer: string;
  deviceType: ArticleAnalyticsDeviceType;
  language: ArticleAnalyticsLang;
  source: ArticleAnalyticsSource;
};

export type ArticleViewEventPayload = ArticleAnalyticsBasePayload & {
  articleId: string;
  slug: string;
  category: string;
};

export type ScrollMilestoneEventPayload = ArticleAnalyticsBasePayload & {
  articleId: string;
  slug: string;
  milestonePct: 25 | 50 | 75 | 100;
  scrollDepthPct: number;
};

export type EngagedReadEventPayload = ArticleAnalyticsBasePayload & {
  articleId: string;
  slug: string;
  readTimeSec: number;
  scrollDepthPct: number;
};

export type HeartbeatEventPayload = ArticleAnalyticsBasePayload & {
  articleId: string;
  slug: string;
  readTimeSec: number;
};

const VISITOR_ID_KEY = 'np_visitor_id_v1';
const SESSION_ID_KEY = 'np_session_id_v1';
const SESSION_LAST_ACTIVITY_KEY = 'np_session_last_activity_v1';

const COOKIE_VISITOR = 'np_vid';
const COOKIE_VISITOR_MAX_AGE_SEC = 60 * 60 * 24 * 365 * 2; // ~2y

export const DEFAULT_INACTIVITY_WINDOW_MS = 30 * 60 * 1000; // 30 min

function now() {
  return Date.now();
}

function safeRandomId(): string {
  // Avoid crypto requirement; best-effort.
  try {
    const g = (globalThis as any).crypto;
    if (g && typeof g.getRandomValues === 'function') {
      const buf = new Uint8Array(16);
      g.getRandomValues(buf);
      return Array.from(buf).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {
    // ignore
  }

  return `${Math.random().toString(16).slice(2)}${Math.random().toString(16).slice(2)}${now().toString(16)}`;
}

function safeGetLocalStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    if (!window.localStorage) return null;
    // access might throw in some privacy modes
    const test = '__np_test__';
    window.localStorage.setItem(test, '1');
    window.localStorage.removeItem(test);
    return window.localStorage;
  } catch {
    return null;
  }
}

function safeGetSessionStorage(): Storage | null {
  try {
    if (typeof window === 'undefined') return null;
    if (!window.sessionStorage) return null;
    const test = '__np_test__';
    window.sessionStorage.setItem(test, '1');
    window.sessionStorage.removeItem(test);
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function readCookie(name: string): string {
  try {
    if (typeof document === 'undefined') return '';
    const all = String(document.cookie || '');
    if (!all) return '';
    const parts = all.split(';');
    for (const p of parts) {
      const [k, ...rest] = p.split('=');
      if (String(k || '').trim() !== name) continue;
      return decodeURIComponent(rest.join('=') || '');
    }
    return '';
  } catch {
    return '';
  }
}

function writeCookie(name: string, value: string, maxAgeSec: number) {
  try {
    if (typeof document === 'undefined') return;
    const encoded = encodeURIComponent(value);
    document.cookie = `${name}=${encoded}; Path=/; Max-Age=${Math.floor(maxAgeSec)}; SameSite=Lax`;
  } catch {
    // ignore
  }
}

export function getOrCreateVisitorId(): string {
  // Prefer localStorage, fallback to cookie.
  const ls = safeGetLocalStorage();
  if (ls) {
    const existing = String(ls.getItem(VISITOR_ID_KEY) || '').trim();
    if (existing) return existing;
    const created = safeRandomId();
    try {
      ls.setItem(VISITOR_ID_KEY, created);
    } catch {
      // ignore
    }
    // also set cookie for redundancy
    writeCookie(COOKIE_VISITOR, created, COOKIE_VISITOR_MAX_AGE_SEC);
    return created;
  }

  const fromCookie = readCookie(COOKIE_VISITOR);
  if (fromCookie) return fromCookie;

  const created = safeRandomId();
  writeCookie(COOKIE_VISITOR, created, COOKIE_VISITOR_MAX_AGE_SEC);
  return created;
}

export function getOrCreateSessionId(options?: {
  inactivityWindowMs?: number;
}): { sessionId: string; isNew: boolean } {
  const inactivityWindowMs = options?.inactivityWindowMs ?? DEFAULT_INACTIVITY_WINDOW_MS;
  const ss = safeGetSessionStorage();
  const ts = now();

  if (!ss) {
    // per-tab persistence not available; create ephemeral
    return { sessionId: safeRandomId(), isNew: true };
  }

  const existing = String(ss.getItem(SESSION_ID_KEY) || '').trim();
  const lastActivityRaw = String(ss.getItem(SESSION_LAST_ACTIVITY_KEY) || '').trim();
  const lastActivity = lastActivityRaw ? Number(lastActivityRaw) : NaN;
  const inactiveTooLong = Number.isFinite(lastActivity) ? (ts - lastActivity > inactivityWindowMs) : false;

  if (existing && !inactiveTooLong) {
    try {
      ss.setItem(SESSION_LAST_ACTIVITY_KEY, String(ts));
    } catch {
      // ignore
    }
    return { sessionId: existing, isNew: false };
  }

  const created = safeRandomId();
  try {
    ss.setItem(SESSION_ID_KEY, created);
    ss.setItem(SESSION_LAST_ACTIVITY_KEY, String(ts));
  } catch {
    // ignore
  }
  return { sessionId: created, isNew: true };
}

export function touchSessionActivity() {
  const ss = safeGetSessionStorage();
  if (!ss) return;
  try {
    ss.setItem(SESSION_LAST_ACTIVITY_KEY, String(now()));
  } catch {
    // ignore
  }
}

export function isProbablyBotUserAgent(userAgent: string): boolean {
  const ua = String(userAgent || '').toLowerCase();
  if (!ua) return false;
  return [
    'bot',
    'crawler',
    'spider',
    'crawling',
    'facebookexternalhit',
    'slackbot',
    'discordbot',
    'telegrambot',
    'whatsapp',
    'preview',
    'headless',
    'lighthouse',
  ].some((token) => ua.includes(token));
}

export function isLocalhostHost(hostname: string): boolean {
  const h = String(hostname || '').trim().toLowerCase();
  if (!h) return true;
  if (h === 'localhost' || h === '127.0.0.1' || h === '0.0.0.0') return true;
  if (h.endsWith('.local')) return true;
  // IPv6 loopback
  if (h === '::1') return true;
  return false;
}

export function isAdminPath(pathname: string): boolean {
  const p = String(pathname || '').trim().toLowerCase();
  if (!p) return false;
  if (p === '/admin' || p.startsWith('/admin/')) return true;
  if (p.startsWith('/api/admin')) return true;
  return false;
}

export function isDevPath(pathname: string): boolean {
  const p = String(pathname || '').trim().toLowerCase();
  if (!p) return false;
  if (p === '/dev' || p.startsWith('/dev/')) return true;
  if (p.startsWith('/dev-')) return true;
  return false;
}

export function shouldTrackClientAnalytics(options?: {
  pathname?: string;
  hostname?: string;
  isPreview?: boolean;
  allowLocalhost?: boolean;
}): boolean {
  try {
    if (typeof window === 'undefined' || typeof document === 'undefined') return false;

    const hostname = options?.hostname ?? window.location.hostname;
    if (isLocalhostHost(hostname) && !options?.allowLocalhost) return false;

    const pathname = options?.pathname ?? window.location.pathname;
    if (isAdminPath(pathname)) return false;
    if (isDevPath(pathname)) return false;

    if (options?.isPreview) return false;

    const ua = typeof navigator !== 'undefined' ? String(navigator.userAgent || '') : '';
    if (isProbablyBotUserAgent(ua)) return false;

    return true;
  } catch {
    return false;
  }
}

export function resolveDeviceType(): ArticleAnalyticsDeviceType {
  try {
    if (typeof window === 'undefined') return 'desktop';
    const w = Number(window.innerWidth || 0);
    if (w && w <= 640) return 'mobile';
    if (w && w <= 1024) return 'tablet';

    const ua = typeof navigator !== 'undefined' ? String(navigator.userAgent || '').toLowerCase() : '';
    if (ua.includes('mobile')) return 'mobile';
    return 'desktop';
  } catch {
    return 'desktop';
  }
}

export function normalizeLang(value: unknown): ArticleAnalyticsLang {
  const v = String(value || '').toLowerCase().trim();
  const base = v.split(/[-_]/g)[0] || v;
  if (base === 'hi' || base === 'hindi' || base === 'in') return 'hi';
  if (base === 'gu' || base === 'gujarati') return 'gu';
  return 'en';
}

export function computeSource(options?: {
  query?: Record<string, any>;
  referrer?: string;
  currentUrl?: string;
}): ArticleAnalyticsSource {
  try {
    const query = options?.query || {};
    const explicit = String(query.src || query.source || query.ref || query.utm_source || '').trim().toLowerCase();
    if (explicit) {
      if (explicit.includes('home')) return 'homepage';
      if (explicit.includes('latest')) return 'latest';
      if (explicit.includes('category')) return 'category';
      if (explicit.includes('related')) return 'related';
      if (explicit.includes('search')) return 'search';
      if (explicit.includes('google')) return 'google';
      if (explicit.includes('social')) return 'social';
      if (explicit.includes('direct')) return 'direct';
      return 'unknown';
    }

    const current = options?.currentUrl || (typeof window !== 'undefined' ? window.location.href : '');
    const ref = options?.referrer ?? (typeof document !== 'undefined' ? String(document.referrer || '') : '');
    if (!ref) return 'direct';

    let refUrl: URL | null = null;
    try {
      refUrl = new URL(ref);
    } catch {
      refUrl = null;
    }

    let curUrl: URL | null = null;
    try {
      curUrl = current ? new URL(current) : null;
    } catch {
      curUrl = null;
    }

    const refHost = String(refUrl?.hostname || '').toLowerCase();
    const refPath = String(refUrl?.pathname || '').toLowerCase();
    const sameOrigin = curUrl && refUrl ? curUrl.origin === refUrl.origin : false;

    if (!sameOrigin) {
      if (refHost.includes('google.')) return 'google';
      if (refHost.includes('bing.') || refHost.includes('yahoo.') || refHost.includes('duckduckgo.') || refHost.includes('baidu.')) return 'search';
      if (
        refHost.includes('facebook.') ||
        refHost === 't.co' ||
        refHost.includes('twitter.') ||
        refHost.includes('x.com') ||
        refHost.includes('instagram.') ||
        refHost.includes('linkedin.') ||
        refHost.includes('whatsapp.')
      ) {
        return 'social';
      }
      return 'unknown';
    }

    // Same-origin navigation: infer based on previous path.
    if (refPath === '/' || refPath === '/hi' || refPath === '/gu') return 'homepage';
    if (refPath.startsWith('/latest')) return 'latest';
    if (refPath.startsWith('/search') || ref.includes('q=')) return 'search';
    if (refPath.startsWith('/news/')) return 'related';

    // Category: /:category, optionally prefixed with locale.
    const parts = refPath.split('/').filter(Boolean);
    const first = parts[0] || '';
    const second = parts[1] || '';
    const candidate = (first === 'hi' || first === 'gu') ? second : first;
    if (candidate && candidate !== 'news' && candidate !== 'topic' && candidate !== 'latest') {
      return 'category';
    }

    return 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function postAnalyticsEvent(event: string, payload: any): Promise<void> {
  try {
    if (typeof window === 'undefined') return;
    const url = `/api/analytics/${encodeURIComponent(String(event || 'event'))}`;
    const body = JSON.stringify(payload ?? {});

    // sendBeacon is best-effort and non-blocking
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
        // Use a string body for maximum compatibility; the API proxy normalizes string bodies.
        navigator.sendBeacon(url, body);
        return;
      }
    } catch {
      // ignore and fallback
    }

    // fetch fallback with keepalive
    try {
      await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body,
        keepalive: true,
        // never block UI; analytics should not crash reads
        cache: 'no-store',
      });
    } catch {
      // ignore
    }
  } catch {
    // ignore
  }
}

export function buildBasePayload(args: {
  visitorId: string;
  sessionId: string;
  language: ArticleAnalyticsLang;
  source: ArticleAnalyticsSource;
}): ArticleAnalyticsBasePayload {
  const ts = now();
  const url = typeof window !== 'undefined' ? String(window.location.href || '') : '';
  const referrer = typeof document !== 'undefined' ? String(document.referrer || '') : '';

  return {
    visitorId: args.visitorId,
    sessionId: args.sessionId,
    ts,
    url,
    referrer,
    deviceType: resolveDeviceType(),
    language: args.language,
    source: args.source,
  };
}
