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

  const routeLanguage = useMemo((): NewsPulseLanguage => {
    const asPath = String(router.asPath || '/');
    const pathOnly = (asPath.split('?')[0] || '/').toLowerCase();
    if (pathOnly === '/hi' || pathOnly.startsWith('/hi/')) return 'hi';
    if (pathOnly === '/gu' || pathOnly.startsWith('/gu/')) return 'gu';
    if (pathOnly === '/en' || pathOnly.startsWith('/en/')) return 'en';

    const fromRouter = normalizeLang(router.locale || router.defaultLocale || 'en');
    return (fromRouter === 'hi' || fromRouter === 'gu' ? fromRouter : 'en') as NewsPulseLanguage;
  }, [router.asPath, router.locale, router.defaultLocale]);

  const getUnprefixedPath = useCallback((asPath: string): string => {
    const raw = String(asPath || '/');
    const hashSplit = raw.split('#');
    const beforeHash = hashSplit[0] || '/';
    const hash = hashSplit.length > 1 ? `#${hashSplit.slice(1).join('#')}` : '';

    const qSplit = beforeHash.split('?');
    const pathPart = qSplit[0] || '/';
    const query = qSplit.length > 1 ? `?${qSplit.slice(1).join('?')}` : '';

    const p = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
    const withoutPrefix = p.replace(/^\/(en|hi|gu)(?=\/|$)/i, '');
    const rest = withoutPrefix.startsWith('/') ? withoutPrefix : `/${withoutPrefix}`;
    const normalizedRest = rest === '/' ? '/' : rest;
    return `${normalizedRest}${query}${hash}`;
  }, []);

  const setLanguage = useCallback(
    (next: NewsPulseLanguage) => {
      const target = normalizeLang(next) as NewsPulseLanguage;

      // Persist preference (must NOT affect SSR language selection).
      setLang(target as Lang, { persist: true });

      if (!router.isReady) return;

      // Route is the single source of truth.
      const unprefixed = getUnprefixedPath(String(router.asPath || '/'));
      const nextAs = target === 'en' ? unprefixed : `/${target}${unprefixed === '/' ? '' : unprefixed}`;

      router
        .push({ pathname: router.pathname, query: router.query }, nextAs, {
          locale: target,
          shallow: false,
          scroll: false,
        })
        .catch(() => {});
    },
    [getUnprefixedPath, router, setLang]
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
