export type NewsPulseLocale = 'en' | 'hi' | 'gu';

// Compatibility alias for callers that think in terms of "lang" rather than "locale".
// Contract: returns the locale segment from the URL pathname.
export function getLangFromPath(pathname: string): NewsPulseLocale | null {
  return getLocaleFromPathname(pathname);
}

export function stripLocalePrefix(pathname: string): string {
  const p = String(pathname || '/');
  const withSlash = p.startsWith('/') ? p : `/${p}`;

  // Contract: strip ALL leading locale prefixes.
  // Example: /gu/hi/foo -> /foo
  const stripped = withSlash.replace(/^(?:\/(?:hi|gu|en))+(?=\/|$)/i, '');
  return stripped === '' ? '/' : stripped;
}

export function getLocaleFromPathname(pathname: string): NewsPulseLocale | null {
  const p = String(pathname || '/').toLowerCase();
  if (p === '/en' || p.startsWith('/en/')) return 'en';
  if (p === '/hi' || p.startsWith('/hi/')) return 'hi';
  if (p === '/gu' || p.startsWith('/gu/')) return 'gu';
  return null;
}

export function buildPathWithLocale(
  targetLocale: NewsPulseLocale,
  pathname: string,
  searchParams?: string,
  hash?: string
): string {
  const base = stripLocalePrefix(pathname);
  // URL contract:
  // - English is unprefixed: /foo
  // - Hindi/Gujarati are prefixed: /hi/foo, /gu/foo
  // (/en/* is allowed, but canonicalized elsewhere to the unprefixed form.)
  const prefix = targetLocale === 'en' ? '' : `/${targetLocale}`;

  const search = String(searchParams || '');
  const searchOut = !search ? '' : search.startsWith('?') ? search : `?${search}`;

  const h = String(hash || '');
  const hashOut = !h ? '' : h.startsWith('#') ? h : `#${h}`;

  const out = base === '/' ? (prefix || '/') : `${prefix}${base}`;
  return `${out}${searchOut}${hashOut}`;
}

export function splitAsPath(asPath: string): { pathname: string; search: string; hash: string } {
  const raw = String(asPath || '/');
  const hashSplit = raw.split('#');
  const beforeHash = hashSplit[0] || '/';
  const hash = hashSplit.length > 1 ? `#${hashSplit.slice(1).join('#')}` : '';

  const qSplit = beforeHash.split('?');
  const pathname = qSplit[0] || '/';
  const search = qSplit.length > 1 ? `?${qSplit.slice(1).join('?')}` : '';

  return { pathname, search, hash };
}
