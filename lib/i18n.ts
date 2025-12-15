// i18n disabled: provide a lightweight stub to avoid build errors
// No external deps; exports minimal API used by the app.

// Import static JSON resources
// Fallback translations (optional minimal set)
const en = {} as Record<string, any>;
const hi = {} as Record<string, any>;
const gu = {} as Record<string, any>;

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

type I18nStub = {
  language: string;
  isInitialized: boolean;
  t: (key: string) => string;
  changeLanguage: (lng: string) => Promise<void>;
  on: (event: 'languageChanged', cb: (lng: string) => void) => void;
};

const listeners: Array<(lng: string) => void> = [];

const i18nStub: I18nStub = {
  language: getStoredLang() || 'en',
  isInitialized: true,
  t: (key: string) => key,
  changeLanguage: async (lng: string) => {
    i18nStub.language = lng;
    setStoredLang(lng);
    listeners.forEach((cb) => cb(lng));
  },
  on: (event, cb) => {
    if (event === 'languageChanged') listeners.push(cb);
  },
};

export default i18nStub;
