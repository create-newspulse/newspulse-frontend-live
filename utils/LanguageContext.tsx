import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/router';

interface LanguageContextType {
  language: string;
  setLanguage: (lang: string) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Maintain legacy codes for compatibility with existing components
  const [language, setLanguage] = useState<string>('english');
  const router = useRouter();

  const toLegacy = (locale: string | undefined) => {
    switch (locale) {
      case 'hi': return 'hindi';
      case 'gu': return 'gujarati';
      default: return 'english';
    }
  };

  const toLocale = (legacy: string) => {
    switch (legacy) {
      case 'hindi': return 'hi';
      case 'gujarati': return 'gu';
      default: return 'en';
    }
  };

  useEffect(() => {
    // Initialize from router locale (preferred) or from storage
    const initialize = () => {
      const current = toLegacy((router.locale as string) || 'en');
      try {
        const saved = typeof window !== 'undefined' ? localStorage.getItem('lang') : null;
        setLanguage(saved ? saved : current);
      } catch {
        setLanguage(current);
      }
    };
    initialize();
    // Update when locale changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router.locale]);

  // Legacy context now mirrors router locale only; translation comes from next-intl

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within a LanguageProvider");
  return context;
}
