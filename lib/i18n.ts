import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

// Import static JSON resources
import en from '../src/locales/en/translation.json';
import hi from '../src/locales/hi/translation.json';
import gu from '../src/locales/gu/translation.json';

// Minimal localStorage helpers (guarded for SSR)
const getStoredLang = () => {
  if (typeof window === 'undefined') return undefined;
  try {
    return localStorage.getItem('lang') || undefined;
  } catch {
    return undefined;
  }
};

const setStoredLang = (lng: string) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem('lang', lng);
  } catch {}
};

// Initialize only once
if (!i18n.isInitialized) {
  i18n
    .use(initReactI18next)
    .init({
      resources: {
        en: { translation: en },
        hi: { translation: hi },
        gu: { translation: gu },
      },
      lng: getStoredLang() || 'en',
      fallbackLng: 'en',
      interpolation: { escapeValue: false },
      react: { useSuspense: false },
    })
    .then(() => {
      // Keep i18n selection persisted
      const lng = i18n.language || 'en';
      setStoredLang(lng);
      i18n.on('languageChanged', (newLng) => setStoredLang(newLng));
    });
}

export default i18n;
