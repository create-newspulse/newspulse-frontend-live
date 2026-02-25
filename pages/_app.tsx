import React from 'react';
import { useRouter } from 'next/router';
import Script from 'next/script';
import * as gtag from '../lib/gtag';
import { LanguageProvider, getMessagesForLang, normalizeLang, useI18n } from '../src/i18n/LanguageProvider';
import { PublicSettingsProvider } from '../src/context/PublicSettingsContext';
import { ThemeProvider } from '../utils/ThemeContext';
import { FeatureFlagProvider } from '../utils/FeatureFlagProvider';
import { PublicModeProvider } from '../utils/PublicModeProvider';
import '../styles/globals.css';
import { Inter, Noto_Sans_Gujarati, Noto_Sans_Devanagari } from 'next/font/google';
import SafeIntlProvider from '../lib/SafeIntlProvider';
import { usePublicSettings } from '../src/context/PublicSettingsContext';
import { useTheme, type ThemeMode } from '../utils/ThemeContext';
import SeoAlternates from '../components/SeoAlternates';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-inter',
  display: 'swap',
});

const gujarati = Noto_Sans_Gujarati({
  subsets: ['gujarati'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-gujarati',
  display: 'swap',
});

const devanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-devanagari',
  display: 'swap',
});

function normalizeThemePreset(raw: unknown): ThemeMode | null {
  const v = String(raw || '').toLowerCase().trim();
  if (!v) return null;
  if (v === 'system') return 'system';
  if (v === 'default') return null;
  if (v === 'dark' || v === 'night' || v === 'midnight') return 'dark';
  if (v === 'light' || v === 'aurora' || v === 'ocean' || v === 'sunset') return 'light';
  return null;
}

function PublishedThemeApplier() {
  const { settings, error } = usePublicSettings();
  const { setMode } = useTheme();
  const appliedRef = React.useRef(false);

  React.useEffect(() => {
    if (appliedRef.current) return;
    if (!settings || error) return;

    // Respect an explicit user choice.
    let hasUserTheme = false;
    try {
      const saved = window.localStorage.getItem('theme');
      hasUserTheme = saved === 'dark' || saved === 'light' || saved === 'system';
    } catch {}
    if (hasUserTheme) {
      appliedRef.current = true;
      return;
    }

    const preset = normalizeThemePreset((settings as any)?.languageTheme?.themePreset);
    if (preset) setMode(preset);
    appliedRef.current = true;
  }, [settings, error, setMode]);

  return null;
}

function RouteLanguageSync() {
  const router = useRouter();
  const { setLang } = useI18n();

  const lastAppliedRef = React.useRef<string>('');
  const lastPersistedLocaleRef = React.useRef<string>('');

  React.useEffect(() => {
    if (!router.isReady) return;

    const routeLocale = normalizeLang(router.locale || router.defaultLocale || 'en');

    const asPath = String(router.asPath || '');
    const pathOnly = asPath.split('?')[0] || '/';
    const hasExplicitLocalePrefix =
      pathOnly === '/hi' ||
      pathOnly.startsWith('/hi/') ||
      pathOnly === '/gu' ||
      pathOnly.startsWith('/gu/');

    // Parse ?lang= from asPath instead of router.query to avoid dependency churn.
    const queryLang = (() => {
      try {
        const q = (asPath.split('?')[1] || '').split('#')[0] || '';
        if (!q) return null;
        const params = new URLSearchParams(q);
        const v = params.get('lang');
        return v ? normalizeLang(v) : null;
      } catch {
        return null;
      }
    })();

    // 1) Shared links: normalize ?lang= to real locale routes.
    if (queryLang) {
      const key = `q:${queryLang}|${router.asPath}`;
      if (lastAppliedRef.current === key) return;
      lastAppliedRef.current = key;

      // Persist preference; route remains the source of truth.
      setLang(queryLang, { persist: true });

      // Avoid persisting again on the next effect pass.
      lastPersistedLocaleRef.current = queryLang;

      const nextQuery = (() => {
        try {
          const params = new URLSearchParams((asPath.split('?')[1] || '').split('#')[0] || '');
          params.delete('lang');
          return params.toString();
        } catch {
          return '';
        }
      })();

      const hash = asPath.includes('#') ? `#${asPath.split('#').slice(1).join('#')}` : '';
      const pathnameOnly = (asPath.split('?')[0] || '/').split('#')[0] || '/';
      const nextAs = `${pathnameOnly}${nextQuery ? `?${nextQuery}` : ''}${hash}`;

      router.replace(nextAs, nextAs, { shallow: false, locale: queryLang }).catch(() => {});
      return;
    }

    // 2) Persist the current route locale as the user's preference (only when it changes).
    const key = `r:${routeLocale}|${router.asPath}`;
    if (lastAppliedRef.current === key) return;
    lastAppliedRef.current = key;

    if (lastPersistedLocaleRef.current !== routeLocale) {
      lastPersistedLocaleRef.current = routeLocale;
      setLang(routeLocale, { persist: true });
    }
  }, [router.isReady, router.asPath, router.locale, router.defaultLocale, setLang]);

  return null;
}

function I18nBridge({ Component, pageProps }: { Component: any; pageProps: any }) {
  const { lang } = useI18n();
  const messages = getMessagesForLang(lang);
  const langClass = lang === 'hi' ? 'np-lang-hi' : lang === 'gu' ? 'np-lang-gu' : 'np-lang-en';
  return (
    <SafeIntlProvider key={lang} messages={messages} locale={lang} onError={() => {}}>
      <SeoAlternates />
      <div className={`${inter.variable} ${gujarati.variable} ${devanagari.variable} ${langClass} relative overflow-x-hidden`}>
        <Component {...pageProps} />
      </div>
    </SafeIntlProvider>
  );
}

function MyApp({ Component, pageProps }) {
  const router = useRouter();

  const routeLang = React.useMemo(() => {
    const asPath = String(router.asPath || '/');
    const pathOnly = (asPath.split('?')[0] || '/').toLowerCase();
    if (pathOnly === '/hi' || pathOnly.startsWith('/hi/')) return 'hi';
    if (pathOnly === '/gu' || pathOnly.startsWith('/gu/')) return 'gu';
    if (pathOnly === '/en' || pathOnly.startsWith('/en/')) return 'en';
    return normalizeLang(router.locale || router.defaultLocale || 'en');
  }, [router.asPath, router.locale, router.defaultLocale]);

  React.useEffect(() => {
    const handleRouteChange = (url: string) => {
      gtag.pageview(url);
    };
    router.events.on('routeChangeComplete', handleRouteChange);

    const enablePwa = process.env.NEXT_PUBLIC_ENABLE_PWA === 'true';
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'production') {
        if (enablePwa) {
          navigator.serviceWorker.register('/service-worker.js').catch(() => {});
        } else {
          navigator.serviceWorker.getRegistrations?.().then((regs) => regs.forEach((r) => r.unregister()));
        }
      } else {
        navigator.serviceWorker.getRegistrations?.().then((regs) => regs.forEach((r) => r.unregister()));
      }
    }

    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events]);

  return (
    <>
      {/* Google Analytics */}
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`} strategy="afterInteractive" />
      <Script
        id="gtag-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);} 
            gtag('js', new Date());
            gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}');
          `,
        }}
      />

      <ThemeProvider>
        <PublicSettingsProvider>
          <PublicModeProvider initialMode={pageProps?.publicMode}>
            <FeatureFlagProvider initialFlags={pageProps?.featureFlags}>
              <LanguageProvider initialLang={routeLang}>
                <PublishedThemeApplier />
                <RouteLanguageSync />
                <I18nBridge Component={Component} pageProps={pageProps} />
              </LanguageProvider>
            </FeatureFlagProvider>
          </PublicModeProvider>
        </PublicSettingsProvider>
      </ThemeProvider>
    </>
  );
}

export default MyApp;
