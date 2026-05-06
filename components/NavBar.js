import React, { useState } from 'react';
import { useI18n } from '../src/i18n/LanguageProvider';
import { LanguageDropdown } from '../src/i18n/language';
import { getPublicApiBaseUrl } from '../lib/publicApiBase';
import { useUiLabels } from '../hooks/useUiLabels';
import { normalizePublicFounderToggles } from '../lib/publicFounderToggles';
import HeaderLogo from '../src/components/layout/HeaderLogo';

export default function NavBar() {
  const { t, lang } = useI18n();
  const { label } = useUiLabels(lang);
  const [isOpen, setIsOpen] = useState(false);
  const [hideCommunityReporter, setHideCommunityReporter] = useState(false);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const base = getPublicApiBaseUrl();
        const res = await fetch(`${base}/api/public/feature-toggles`, { headers: { Accept: 'application/json' } });
        const data = await res.json().catch(() => null);
        if (!cancelled && res.ok && data) {
          const toggles = normalizePublicFounderToggles(data);
          setHideCommunityReporter(toggles.communityReporterClosed);
        }
      } catch {}
    };
    load();
    return () => { cancelled = true; };
  }, []);

  return (
    <nav className="sticky top-0 z-50 bg-newsPulse-white shadow-md">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <HeaderLogo />

        {/* Hamburger Icon */}
        <div className="md:hidden">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="text-newsPulse-navy focus:outline-none"
          >
            {isOpen ? '✖' : '☰'}
          </button>
        </div>

        {/* Desktop Menu */}
        <ul className="hidden md:flex space-x-6 font-medium text-newsPulse-slate items-center">
          <li><a href="/" className="hover:text-newsPulse-blue">{label('common.home') || t('common.home')}</a></li>
          <li><a href="/editorial" className="hover:text-newsPulse-blue">{label('common.editorial') || t('common.editorial')}</a></li>
          <li><a href="/about" className="hover:text-newsPulse-blue">{label('common.about') || t('common.about')}</a></li>
          <li><a href="/contact" className="hover:text-newsPulse-blue">{label('common.contact') || t('common.contact')}</a></li>
          <li><a href="/news" className="text-newsPulse-blue hover:underline">📰 {label('common.topNews') || t('common.topNews')}</a></li>
          {!hideCommunityReporter && (
            <li><a href="/community-reporter" className="hover:text-newsPulse-blue">{label('common.communityReporter') || t('common.communityReporter')}</a></li>
          )}
          <li><LanguageDropdown compact /></li>
        </ul>
      </div>

      {/* Mobile Menu */}
      {isOpen && (
        <ul className="md:hidden px-4 pb-4 space-y-2 font-medium text-newsPulse-slate bg-newsPulse-white shadow-inner">
          <li><a href="/" className="block hover:text-newsPulse-blue">{label('common.home') || t('common.home')}</a></li>
          <li><a href="/editorial" className="block hover:text-newsPulse-blue">{label('common.editorial') || t('common.editorial')}</a></li>
          <li><a href="/about" className="block hover:text-newsPulse-blue">{label('common.about') || t('common.about')}</a></li>
          <li><a href="/contact" className="block hover:text-newsPulse-blue">{label('common.contact') || t('common.contact')}</a></li>
          <li><a href="/news" className="block text-newsPulse-blue hover:underline">📰 {label('common.topNews') || t('common.topNews')}</a></li>
          {!hideCommunityReporter && (
            <li><a href="/community-reporter" className="block hover:text-newsPulse-blue">{label('common.communityReporter') || t('common.communityReporter')}</a></li>
          )}
          <li><LanguageDropdown /></li>
        </ul>
      )}
    </nav>
  );
}

