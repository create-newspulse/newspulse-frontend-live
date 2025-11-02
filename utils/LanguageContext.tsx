import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface LanguageContextType {
  language: string;
  setLanguage: (lang: string) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Initialize from localStorage if available; fallback to browser or 'english'
  const [language, setLanguage] = useState<string>('english');

  useEffect(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('lang') : null;
      if (saved) {
        setLanguage(saved);
      } else if (typeof window !== 'undefined') {
        // Optional: infer from browser language
        const nav = navigator.language.toLowerCase();
        if (nav.startsWith('hi')) setLanguage('hindi');
        else if (nav.startsWith('gu')) setLanguage('gujarati');
        else setLanguage('english');
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      if (typeof window !== 'undefined') localStorage.setItem('lang', language);
    } catch {}
  }, [language]);

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
