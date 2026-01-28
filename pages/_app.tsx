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
import { buildPathWithLocale, getLocaleFromPathname, splitAsPath, type NewsPulseLocale } from '../utils/localeRouting';

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
  const { lang, setLang } = useI18n();

  const lastAppliedRef = React.useRef<string>('');

  React.useEffect(() => {
    if (!router.isReady) return;

    const { pathname, search, hash } = splitAsPath(String(router.asPath || '/'));
    const localeFromPath = getLocaleFromPathname(pathname);
    const routeLocale = (localeFromPath || 'en') as NewsPulseLocale;

    const rawQueryLang = (router.query?.lang ?? '') as string | string[];
    const queryLangValue = Array.isArray(rawQueryLang) ? rawQueryLang[0] : rawQueryLang;
    const queryLang = queryLangValue ? normalizeLang(queryLangValue) : null;

    // 0) Unprefixed routes are valid and represent English.
    // If the user has a saved preference of hi/gu and navigates to an unprefixed route
    // (usually via an unlocalized link), normalize client-side by prefixing.
    // IMPORTANT: read cookie (which is updated by the language switcher) to avoid
    // redirecting back to the old locale and causing a “stuck /hi or /gu” URL.
    if (!localeFromPath) {
      const cookiePref = (() => {
        if (typeof document === 'undefined') return null;
        try {
          const raw = document.cookie || '';
          const parts = raw.split(';').map((p) => p.trim());
          const find = (name: string): string | null => {
            const prefix = `${name}=`;
            const hit = parts.find((p) => p.startsWith(prefix));
            if (!hit) return null;
            const v = hit.slice(prefix.length);
            return decodeURIComponent(v || '');
          };
          const v = find('np_locale') || find('np_lang') || find('NEXT_LOCALE');
          const n = v ? normalizeLang(v) : null;
          return n === 'hi' || n === 'gu' ? (n as NewsPulseLocale) : null;
        } catch {
          return null;
        }
      })();

      if (cookiePref) {
        const key = `p:${cookiePref}|${router.asPath}`;
        if (lastAppliedRef.current === key) return;
        lastAppliedRef.current = key;

        const nextAs = buildPathWithLocale(cookiePref, pathname, search, hash);
        router.replace(nextAs, undefined, { shallow: false, scroll: false }).catch(() => {});
        return;
      }
    }

    // 1) Shared links: normalize ?lang= to real locale routes.
    if (queryLang) {
      const key = `q:${queryLang}|${router.asPath}`;
      if (lastAppliedRef.current === key) return;
      lastAppliedRef.current = key;

      // Persist preference; route remains the source of truth.
      setLang(queryLang, { persist: true });

      // Normalize to /<locale>/<rest> while preserving other query params.
      const nextQuery = { ...router.query } as Record<string, any>;
      delete nextQuery.lang;
      const { pathname: currentPathname, hash } = splitAsPath(String(router.asPath || '/'));
      const search = (() => {
        const sp = new URLSearchParams();
        for (const [k, v] of Object.entries(nextQuery)) {
          if (v === undefined || v === null) continue;
          if (Array.isArray(v)) v.forEach((x) => sp.append(k, String(x)));
          else sp.set(k, String(v));
        }
        const s = sp.toString();
        return s ? `?${s}` : '';
      })();
      const nextAs = buildPathWithLocale(queryLang as NewsPulseLocale, currentPathname, search, hash);
      router.replace(nextAs, undefined, { shallow: false, scroll: false }).catch(() => {});
      return;
    }

    // 2) Persist the current route locale as the user's preference.
    if (routeLocale !== lang) {
      const key = `r:${routeLocale}|${router.asPath}`;
      if (lastAppliedRef.current === key) return;
      lastAppliedRef.current = key;
    }
    setLang(routeLocale, { persist: true });
  }, [router.isReady, router.asPath, router.query, lang, setLang]);

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
    const { pathname } = splitAsPath(String(router.asPath || '/'));
    return (getLocaleFromPathname(pathname) || 'en') as any;
  }, [router.asPath]);

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
