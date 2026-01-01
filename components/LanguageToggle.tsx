import React from 'react';

import { useLanguage } from '../utils/LanguageContext';
import { useI18n } from '../src/i18n/LanguageProvider';

export default function LanguageToggle() {
  const { language, setLanguage } = useLanguage();
  const { t } = useI18n();

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const selected = e.target.value as 'en' | 'hi' | 'gu';
    setLanguage(selected);
    try {
      localStorage.setItem('np_lang', selected);
    } catch {}
  };

  return (
    <select
      value={language}
      onChange={handleChange}
      aria-label={t('common.language')}
      className="border rounded-lg px-3 py-2 font-medium bg-white shadow text-gray-800"
    >
      {/* Order requested: Gujarati → Hindi → English */}
      <option value="gu">📰 ગુજરાતી</option>
      <option value="hi">🇮🇳 हिन्दी</option>
      <option value="en">🌐 English</option>
    </select>
  );
}
