import React from 'react';

import { useLanguage } from '../utils/LanguageContext';
import { useI18n } from '../src/i18n/LanguageProvider';
import { usePublicSettings } from '../src/context/PublicSettingsContext';

function normalizeLangCode(raw: unknown): 'en' | 'hi' | 'gu' | null {
  const v = String(raw || '').toLowerCase().trim();
  if (v === 'en' || v === 'hi' || v === 'gu') return v as any;
  return null;
}

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  const { t } = useI18n();
  const { settings } = usePublicSettings();

  const options = React.useMemo(() => {
    const raw = (settings as any)?.languageTheme?.languages;
    if (Array.isArray(raw) && raw.length) {
      const codes = raw
        .map(normalizeLangCode)
        .filter(Boolean) as Array<'en' | 'hi' | 'gu'>;
      const uniq = Array.from(new Set(codes));
      if (uniq.length) return uniq;
    }
    // Default order requested: Gujarati → Hindi → English
    return ['gu', 'hi', 'en'] as Array<'gu' | 'hi' | 'en'>;
  }, [settings]);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value as 'en' | 'hi' | 'gu';
    if (!options.includes(selected)) return;
    // Requirement: on dropdown change, route to /, /hi, /gu.
    // URL/route is source of truth; useLanguage().setLanguage performs navigation + persistence.
    setLanguage(selected, { path: '/' });
  };

  return (
    <select
      value={language || 'en'}
      onChange={handleChange}
      aria-label={t('common.language')}
      className="border border-newsPulse-slate/35 rounded-lg px-3 py-2 font-medium bg-newsPulse-white shadow text-newsPulse-navy focus:border-newsPulse-blue focus:outline-none"
    >
      {options.map((code) => {
        if (code === 'gu') return <option key={code} value={code}>📰 ગુજરાતી</option>;
        if (code === 'hi') return <option key={code} value={code}>🇮🇳 हिन्दी</option>;
        return <option key={code} value={code}>🌐 English</option>;
      })}
    </select>
  );
}
