import { useMemo } from 'react';
import { getSelectedLanguage, type Lang, useI18n } from '../src/i18n/LanguageProvider';

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
  const { lang, setLang } = useI18n();

  return useMemo(
    () => ({
      language: lang as NewsPulseLanguage,
      setLanguage: (next: NewsPulseLanguage) => setLang(next as Lang),
    }),
    [lang, setLang]
  );
}

export { getSelectedLanguage };
