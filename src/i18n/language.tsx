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
  return <BaseLanguageProvider>{children}</BaseLanguageProvider>;
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
  const { language, setLanguage, t } = useLanguage();
  const currentLocale = language || 'en';

  const change = useCallback(
    (lng: string) => {
      if (lng === 'en' || lng === 'hi' || lng === 'gu') {
        // Update global UI language + persist.
        setLanguage(lng);
        // Also switch Next.js locale route so locale-dependent pages/data update immediately.
        router
          .push({ pathname: router.pathname, query: router.query }, undefined, { locale: lng })
          .catch(() => {});
      }
    },
    [router, setLanguage]
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
