import { useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';
import { getSelectedLanguage, normalizeLang, type Lang, useI18n } from '../src/i18n/LanguageProvider';
import {
  buildPathWithLocale,
  getLocaleFromPathname,
  splitAsPath,
  type NewsPulseLocale,
} from './localeRouting';

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

  const LOCALES = useMemo(() => ['en', 'hi', 'gu'] as const, []);

  const routeLanguage = useMemo((): NewsPulseLanguage => {
    const { pathname } = splitAsPath(String(router.asPath || '/'));
    return (getLocaleFromPathname(pathname) || 'en') as NewsPulseLanguage;
  }, [router.asPath]);

  const setLanguage = useCallback(
    (next: NewsPulseLanguage) => {
      const target = normalizeLang(next) as NewsPulseLanguage;

      if (!LOCALES.includes(target as any)) return;

      // Persist preference (must NOT affect SSR language selection).
      setLang(target as Lang, { persist: true });

      if (!router.isReady) return;

      // Route is the single source of truth.
      const { pathname, search, hash } = splitAsPath(String(router.asPath || '/'));
      const nextAs = buildPathWithLocale(target as NewsPulseLocale, pathname, search, hash);
      router.push(nextAs, undefined, { shallow: false, scroll: false }).catch(() => {});
    },
    [LOCALES, router, setLang]
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
