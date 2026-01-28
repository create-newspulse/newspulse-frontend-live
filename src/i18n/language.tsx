import React, { useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';

import en from './en.json';
import hi from './hi.json';
import gu from './gu.json';

import { type Lang, LanguageProvider as BaseLanguageProvider, useI18n } from './LanguageProvider';

export const DICT = {
  en: en as any,
  hi: hi as any,
  gu: gu as any,
} as const;

function getFromPath(obj: any, keyPath: string): string | undefined {
  if (!obj || !keyPath) return undefined;
  const parts = keyPath.split('.').filter(Boolean);
  let cur: any = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return undefined;
    if (!Object.prototype.hasOwnProperty.call(cur, p)) return undefined;
    cur = cur[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

export function translate(lang: Lang, key: string): string {
  const dict = DICT[lang] ?? DICT.en;
  const v = getFromPath(dict, key);
  if (typeof v === 'string') return v;
  const fallback = getFromPath(DICT.en, key);
  if (typeof fallback === 'string') return fallback;
  return key;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const initialLang = useMemo(() => {
    const asPath = String(router.asPath || '/');
    const pathOnly = (asPath.split('?')[0] || '/').toLowerCase();
    if (pathOnly === '/hi' || pathOnly.startsWith('/hi/')) return 'hi' as Lang;
    if (pathOnly === '/gu' || pathOnly.startsWith('/gu/')) return 'gu' as Lang;
    if (pathOnly === '/en' || pathOnly.startsWith('/en/')) return 'en' as Lang;
    const fromRouter = String(router.locale || router.defaultLocale || 'en').toLowerCase();
    return (fromRouter === 'hi' || fromRouter === 'gu' ? fromRouter : 'en') as Lang;
  }, [router.asPath, router.locale, router.defaultLocale]);

  return <BaseLanguageProvider initialLang={initialLang}>{children}</BaseLanguageProvider>;
}

export function useLanguage(): {
  language: Lang;
  setLanguage: (lang: Lang) => void;
  t: (key: string) => string;
} {
  const { lang, setLang, t } = useI18n();
  return useMemo(
    () => ({
      language: lang,
      setLanguage: setLang,
      t,
    }),
    [lang, setLang, t]
  );
}

const LANGS: Array<{ code: Lang; label: string; flag: string }> = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'gu', label: 'ગુજરાતી', flag: '🇮🇳' },
];

export const LanguageDropdown: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const router = useRouter();
  const { setLanguage, t } = useLanguage();

  const stripLocale = useCallback((path: string): string => {
    return String(path || '/').replace(/^\/(hi|gu|en)(?=\/|$)/i, '');
  }, []);

  const buildPath = useCallback(
    (locale: Lang, currentAsPath: string): string => {
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

  const currentLocale = useMemo(() => {
    const asPath = String(router.asPath || '/');
    const pathOnly = (asPath.split('?')[0] || '/').toLowerCase();
    if (pathOnly === '/hi' || pathOnly.startsWith('/hi/')) return 'hi' as Lang;
    if (pathOnly === '/gu' || pathOnly.startsWith('/gu/')) return 'gu' as Lang;
    if (pathOnly === '/en' || pathOnly.startsWith('/en/')) return 'en' as Lang;
    const fromRouter = String(router.locale || router.defaultLocale || 'en').toLowerCase();
    return (fromRouter === 'hi' || fromRouter === 'gu' ? fromRouter : 'en') as Lang;
  }, [router.asPath, router.locale, router.defaultLocale]);

  const change = useCallback(
    (lng: string) => {
      if (lng === 'en' || lng === 'hi' || lng === 'gu') {
        // Persist preference for future visits.
        setLanguage(lng);
        // URL is the source of truth.
        const nextAs = buildPath(lng, String(router.asPath || '/'));
        router.replace(nextAs, nextAs, { locale: lng, shallow: false, scroll: false }).catch(() => {});
      }
    },
    [buildPath, router, setLanguage]
  );

  if (compact) {
    return (
      <select
        aria-label={t('common.language')}
        value={currentLocale}
        onChange={(e) => change(e.target.value)}
        className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-dark-accent text-sm"
      >
        {LANGS.map((l) => (
          <option key={l.code} value={l.code}>
            {l.flag} {l.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm font-semibold text-gray-700 dark:text-dark-text">{t('common.language')}</span>
      {LANGS.map((l) => (
        <button
          key={l.code}
          onClick={() => change(l.code)}
          className={`px-3 py-1 rounded-full text-sm border ${
            currentLocale === l.code
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white dark:bg-dark-secondary border-gray-300 dark:border-gray-600 text-gray-700 dark:text-dark-text'
          }`}
          title={l.label}
        >
          <span className="mr-1">{l.flag}</span>
          {l.label}
        </button>
      ))}
    </div>
  );
};
