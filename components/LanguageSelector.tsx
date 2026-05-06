import React, { useCallback, useMemo } from 'react';
import { useLanguage } from '../utils/LanguageContext';
import { useI18n } from '../src/i18n/LanguageProvider';
import { usePublicSettings } from '../src/context/PublicSettingsContext';

const LANG_META: Record<string, { code: string; label: string; flag: string }> = {
  en: { code: 'en', label: 'English', flag: '🇺🇸' },
  hi: { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  gu: { code: 'gu', label: 'ગુજરાતી', flag: '🇮🇳' },
};

function normalizeLangCode(raw: unknown): 'en' | 'hi' | 'gu' | null {
  const v = String(raw || '').toLowerCase().trim();
  if (v === 'en' || v === 'hi' || v === 'gu') return v as any;
  return null;
}

export const LanguageSelector: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { language, setLanguage } = useLanguage();
  const { t } = useI18n();
  const { settings } = usePublicSettings();
  const currentLocale = language || 'en';

  const available = useMemo(() => {
    const raw = (settings as any)?.languageTheme?.languages;
    if (Array.isArray(raw) && raw.length) {
      const codes = raw
        .map(normalizeLangCode)
        .filter(Boolean) as Array<'en' | 'hi' | 'gu'>;
      const uniq = Array.from(new Set(codes));
      const mapped = uniq.map((c) => LANG_META[c]).filter(Boolean);
      if (mapped.length) return mapped;
    }
    return [LANG_META.en, LANG_META.hi, LANG_META.gu];
  }, [settings]);

  const change = useCallback(async (lng: string) => {
    const allowed = new Set(available.map((x) => x.code));
    if (!allowed.has(lng)) return;
    if (lng === 'en' || lng === 'hi' || lng === 'gu') {
      // Requirement: on dropdown change, route to /, /hi, /gu.
      // URL/route is source of truth; useLanguage().setLanguage performs navigation + persistence.
      setLanguage(lng, { path: '/' });
    }
  }, [available, setLanguage]);

  if (compact) {
    return (
      <select
        aria-label="Language"
        value={currentLocale}
        onChange={(e) => change(e.target.value)}
        className="px-2 py-1 rounded-lg border border-newsPulse-slate/25 bg-newsPulse-white text-sm text-newsPulse-navy dark:bg-dark-accent dark:text-dark-text"
      >
        {available.map(l => (
          <option key={l.code} value={l.code}>{l.flag} {l.label}</option>
        ))}
      </select>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <span className="text-sm font-semibold text-newsPulse-slate dark:text-dark-text">{t('common.language')}</span>
      {available.map(l => (
        <button
          key={l.code}
          onClick={() => change(l.code)}
          className={`px-3 py-1 rounded-full text-sm border ${currentLocale === l.code ? 'bg-newsPulse-blue text-newsPulse-white border-newsPulse-blue' : 'bg-newsPulse-white dark:bg-dark-secondary border-newsPulse-slate/35 dark:border-gray-600 text-newsPulse-slate dark:text-dark-text'}`}
          title={l.label}
        >
          <span className="mr-1">{l.flag}</span>{l.label}
        </button>
      ))}
    </div>
  );
};

export default LanguageSelector;
