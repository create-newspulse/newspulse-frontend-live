import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import { getSelectedLanguage, normalizeLang, type Lang, useI18n } from '../src/i18n/LanguageProvider';

export type NewsPulseLanguage = 'en' | 'hi' | 'gu';

interface LanguageContextType {
  language: NewsPulseLanguage;
  setLanguage: (lang: NewsPulseLanguage) => void;
}

// Compatibility wrapper:
// - Keeps existing imports working (`useLanguage`, `getSelectedLanguage`)
// - Ensures ONE global language state for UI + API
// - Next locale routing (/hi, /gu) is enabled for SEO/shareable URLs

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // The real provider lives in src/i18n and is mounted in pages/_app.tsx.
  return <>{children}</>;
}

export function useLanguage(): LanguageContextType {
  const router = useRouter();
  const { lang, setLang } = useI18n();

  const LOCALES = useMemo(() => ['hi', 'gu', 'en'] as const, []);

  const stripLocale = useCallback(
    (path: string): string => {
      const p = String(path || '/').startsWith('/') ? String(path || '/') : `/${path}`;
      return p.replace(/^\/(hi|gu|en)(?=\/|$)/i, '');
    },
    []
  );

  const buildPath = useCallback(
    (locale: NewsPulseLanguage, currentAsPath: string): string => {
      const raw = String(currentAsPath || '/');
      const hashSplit = raw.split('#');
      const beforeHash = hashSplit[0] || '/';
      const hash = hashSplit.length > 1 ? `#${hashSplit.slice(1).join('#')}` : '';

      const qSplit = beforeHash.split('?');
      const pathPart = qSplit[0] || '/';
      const query = qSplit.length > 1 ? `?${qSplit.slice(1).join('?')}` : '';

      const clean = stripLocale(pathPart) || '/';
      const normalized = clean === '' ? '/' : clean;
      const out = locale === 'en' ? normalized : `/${locale}${normalized === '/' ? '' : normalized}`;
      return `${out}${query}${hash}`;
    },
    [stripLocale]
  );

  const routeLanguage = useMemo((): NewsPulseLanguage => {
    const asPath = String(router.asPath || '/');
    const pathOnly = (asPath.split('?')[0] || '/').toLowerCase();
    if (pathOnly === '/hi' || pathOnly.startsWith('/hi/')) return 'hi';
    if (pathOnly === '/gu' || pathOnly.startsWith('/gu/')) return 'gu';
    return 'en';
  }, [router.asPath]);

  const setLanguage = useCallback(
    (next: NewsPulseLanguage) => {
      const target = normalizeLang(next) as NewsPulseLanguage;

      if (!LOCALES.includes(target as any)) return;

      // Persist preference (must NOT affect SSR language selection).
      setLang(target as Lang, { persist: true });

      if (!router.isReady) return;

      // Route is the single source of truth.
      const nextAs = buildPath(target, String(router.asPath || '/'));
      router.replace(nextAs, nextAs, { locale: target, shallow: false, scroll: false }).catch(() => {});
    },
    [LOCALES, buildPath, router, setLang]
  );

  return useMemo(
    () => ({
      language: routeLanguage,
      setLanguage,
    }),
    [routeLanguage, setLanguage]
  );
}

export { getSelectedLanguage };
