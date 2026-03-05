export type RouteLang = 'en' | 'hi' | 'gu';

/**
 * Detects active language from the URL path prefix.
 * Spec:
 * - /gu/... => gu
 * - /hi/... => hi
 * - else => null (no explicit prefix)
 */
export function getActiveRouteLang(asPath: string | undefined | null): RouteLang | null {
  const raw = String(asPath || '/');
  const path = (raw.split('#')[0] || '/').split('?')[0] || '/';
  const p = path.startsWith('/') ? path : `/${path}`;
  const m = p.match(/^\/(en|gu|hi)(?=\/|$)/i);
  if (!m) return null;
  const token = String(m[1] || '').toLowerCase();
  return token === 'gu' ? 'gu' : token === 'hi' ? 'hi' : 'en';
}
