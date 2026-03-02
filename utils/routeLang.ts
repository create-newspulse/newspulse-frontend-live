export type RouteLang = 'en' | 'hi' | 'gu';

/**
 * Detects active language from the URL path prefix.
 * Spec:
 * - /gu/... => gu
 * - /hi/... => hi
 * - else => en
 */
export function getActiveRouteLang(asPath: string | undefined | null): RouteLang {
  const raw = String(asPath || '/');
  const path = (raw.split('#')[0] || '/').split('?')[0] || '/';
  const p = path.startsWith('/') ? path : `/${path}`;
  const m = p.match(/^\/(gu|hi)(?=\/|$)/i);
  if (!m) return 'en';
  const token = String(m[1] || '').toLowerCase();
  return token === 'gu' ? 'gu' : token === 'hi' ? 'hi' : 'en';
}
