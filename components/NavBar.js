import React, { useState } from 'react';
import { useI18n } from '../src/i18n/LanguageProvider';
import { LanguageDropdown } from '../src/i18n/language';

export default function NavBar() {
  const { t } = useI18n();
  const [isOpen, setIsOpen] = useState(false);
  const [hideCommunityReporter, setHideCommunityReporter] = useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch('/api/public/feature-toggles', { headers: { Accept: 'application/json' } });
        const data = await res.json().catch(() => null);
        if (!cancelled && res.ok && data) {
          setHideCommunityReporter(Boolean(data.communityReporterClosed));
        }
      } catch {}
    };
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <nav className="sticky top-0 z-50 bg-white shadow-md">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <div className="text-2xl font-bold text-blue-700">📰 {t('brand.name')}</div>

        {/* Hamburger Icon */}
        <div className="md:hidden">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-gray-700 focus:outline-none"
          >
            {isOpen ? '✖' : '☰'}
          </button>
        </div>

        {/* Desktop Menu */}
        <ul className="hidden md:flex space-x-6 font-medium text-gray-700 items-center">
          <li><a href="/" className="hover:text-blue-600">{t('common.home')}</a></li>
          <li><a href="/editorial" className="hover:text-blue-600">{t('common.editorial')}</a></li>
          <li><a href="/about" className="hover:text-blue-600">{t('common.about')}</a></li>
          <li><a href="/contact" className="hover:text-blue-600">{t('common.contact')}</a></li>
          <li><a href="/news" className="text-blue-700 hover:underline">📰 {t('common.topNews')}</a></li>
          {!hideCommunityReporter && (
            <li><a href="/community-reporter" className="hover:text-blue-600">{t('common.communityReporter')}</a></li>
          )}
          <li><LanguageDropdown compact /></li>
        </ul>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <ul className="md:hidden px-4 pb-4 space-y-2 font-medium text-gray-700 bg-white shadow-inner">
          <li><a href="/" className="block hover:text-blue-600">{t('common.home')}</a></li>
          <li><a href="/editorial" className="block hover:text-blue-600">{t('common.editorial')}</a></li>
          <li><a href="/about" className="block hover:text-blue-600">{t('common.about')}</a></li>
          <li><a href="/contact" className="block hover:text-blue-600">{t('common.contact')}</a></li>
          <li><a href="/news" className="block text-blue-700 hover:underline">📰 {t('common.topNews')}</a></li>
          {!hideCommunityReporter && (
            <li><a href="/community-reporter" className="block hover:text-blue-600">{t('common.communityReporter')}</a></li>
          )}
          <li><LanguageDropdown /></li>
        </ul>
      )}
    </nav>
  );
}

