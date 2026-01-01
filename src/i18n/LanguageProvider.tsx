import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

import en from './en.json';
import hi from './hi.json';
import gu from './gu.json';

export type Lang = 'gu' | 'hi' | 'en';

type Dict = Record<string, any>;

const STORAGE_KEY = 'np_lang';
const COOKIE_KEY = 'np_lang';

function readCookie(name: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  try {
    const raw = document.cookie || '';
    const parts = raw.split(';');
    for (const p of parts) {
      const [k, ...rest] = p.trim().split('=');
      if (k === name) return decodeURIComponent(rest.join('=') || '');
    }
  } catch {
    // ignore
  }
  return undefined;
}

function writeCookie(name: string, value: string) {
  if (typeof document === 'undefined') return;
  try {
    const v = encodeURIComponent(value);
    const maxAge = 60 * 60 * 24 * 365; // 1 year
    document.cookie = `${name}=${v}; path=/; max-age=${maxAge}; samesite=lax`;
  } catch {
    // ignore
  }
}

function normalizeLang(value: unknown): Lang {
  const v = String(value || '').toLowerCase().trim();
  if (v === 'gu' || v === 'gujarati') return 'gu';
  if (v === 'hi' || v === 'hindi') return 'hi';
  return 'en';
}

function getFromPath(obj: any, keyPath: string): string | undefined {
  if (!obj || !keyPath) return undefined;
  const parts = keyPath.split('.').filter(Boolean);
  let cur: any = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return typeof cur === 'string' ? cur : undefined;
}

function getDictionary(lang: Lang): Dict {
  if (lang === 'gu') return gu as any;
  if (lang === 'hi') return hi as any;
  return en as any;
}

export function getSelectedLanguage(): Lang {
  if (typeof window === 'undefined') return 'en';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored) return normalizeLang(stored);
  } catch {
    // ignore
  }

  const fromCookie = readCookie(COOKIE_KEY);
  if (fromCookie) return normalizeLang(fromCookie);

  return 'en';
}

type I18nContextType = {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  React.useEffect(() => {
    setLangState(getSelectedLanguage());
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // ignore
    }

    writeCookie(COOKIE_KEY, next);
  }, []);

  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = lang;
  }, [lang]);

  const dict = useMemo(() => getDictionary(lang), [lang]);

  const t = useCallback(
    (key: string) => {
      const v = getFromPath(dict, key);
      if (typeof v === 'string') return v;
      const fallback = getFromPath(en as any, key);
      if (typeof fallback === 'string') return fallback;
      return key;
    },
    [dict]
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextType {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within LanguageProvider');
  return ctx;
}

export function getMessagesForLang(lang: Lang): Dict {
  return getDictionary(lang);
}
