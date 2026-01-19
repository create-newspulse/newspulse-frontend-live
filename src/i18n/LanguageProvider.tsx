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

export function normalizeLang(value: unknown): Lang {
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
  setLang: (lang: Lang, options?: { persist?: boolean }) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextType | undefined>(undefined);

export function LanguageProvider({
  children,
  initialLang,
}: {
  children: React.ReactNode;
  initialLang?: Lang;
}) {
  // Important for hydration:
  // - On SSR, prefer the route locale (provided by _app.tsx) so server+client match.
  // - Only fall back to storage/cookie on the client when initialLang isn't provided.
  const [lang, setLangState] = useState<Lang>(() => (initialLang ? normalizeLang(initialLang) : 'en'));

  React.useEffect(() => {
    if (initialLang) {
      const next = normalizeLang(initialLang);
      setLangState((prev) => (prev === next ? prev : next));
      return;
    }
    setLangState(getSelectedLanguage());
  }, [initialLang]);

  const setLang = useCallback((next: Lang, options?: { persist?: boolean }) => {
    setLangState(next);

    const persist = options?.persist !== false;
    if (!persist) {
      // Ephemeral language change (backend-controlled defaults) without touching user storage.
      return;
    }
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

  const applyVars = useCallback((template: string, vars?: Record<string, string | number>) => {
    if (!vars) return template;
    return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (m, k) => {
      const v = (vars as any)[k];
      return v === undefined || v === null ? m : String(v);
    });
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) => {
      const v = getFromPath(dict, key);
      if (typeof v === 'string') return applyVars(v, vars);
      const fallback = getFromPath(en as any, key);
      if (typeof fallback === 'string') return applyVars(fallback, vars);
      return applyVars(key, vars);
    },
    [applyVars, dict]
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
