import React, { useCallback, useMemo } from 'react';
import { useRouter } from 'next/router';

const LANGS = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
  { code: 'gu', label: 'ગુજરાતી', flag: '🇮🇳' },
];

export const LanguageSelector: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const router = useRouter();
  const currentLocale = (router.locale as string) || 'en';

  const asPath = useMemo(() => router.asPath, [router.asPath]);

  const change = useCallback(async (lng: string) => {
    try {
      // Persist language selection for Next/next-intl
      document.cookie = `NEXT_LOCALE=${lng}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
      try { localStorage.setItem('lang', lng); } catch {}
    } catch {}
    await router.push(asPath, asPath, { locale: lng, scroll: false, shallow: false });
  }, [router, asPath]);

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
