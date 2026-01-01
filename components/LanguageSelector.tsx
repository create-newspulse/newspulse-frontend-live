import React, { useCallback, useMemo } from 'react';
import { useLanguage } from '../utils/LanguageContext';
import { useI18n } from '../src/i18n/LanguageProvider';

const LANGS = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'gu', label: 'ગુજરાતી', flag: '🇮🇳' },
];

export const LanguageSelector: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { language, setLanguage } = useLanguage();
  const { t } = useI18n();
  const currentLocale = language || 'en';

  const change = useCallback(async (lng: string) => {
    // Global feed language (hard requirement)
    try {
      if (lng === 'en' || lng === 'hi' || lng === 'gu') {
        setLanguage(lng);
      }
    } catch {}
    try {
      try {
        localStorage.setItem('np_lang', lng);
      } catch {}
    } catch {}
  }, [setLanguage]);

  if (compact) {
    return (
      <select
        aria-label="Language"
        value={currentLocale}
        onChange={(e) => change(e.target.value)}
        className="px-2 py-1 rounded-lg bg-gray-100 dark:bg-dark-accent text-sm"
      >
        {LANGS.map(l => (
          <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
        ))}
      </select>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm font-semibold text-gray-700 dark:text-dark-text">{t('common.language')}</span>
      {LANGS.map(l => (
        <button
          key={l.code}
          onClick={() => change(l.code)}
          className={`px-3 py-1 rounded-full text-sm border ${currentLocale === l.code ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-dark-secondary border-gray-300 dark:border-gray-600 text-gray-700 dark:text-dark-text'}`}
          title={l.label}
        >
          <span className="mr-1">{l.flag}</span>{l.label}
        </button>
      ))}
    </div>
  );
};

export default LanguageSelector;
