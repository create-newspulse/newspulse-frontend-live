import React from 'react';
import { useRouter } from 'next/router';
import Script from 'next/script';
import * as gtag from '../lib/gtag';
import { LanguageProvider, getMessagesForLang, useI18n } from '../src/i18n/LanguageProvider';
import { ThemeProvider } from '../utils/ThemeContext';
import { FeatureFlagProvider } from '../utils/FeatureFlagProvider';
import { PublicModeProvider } from '../utils/PublicModeProvider';
import '../styles/globals.css';
import SafeIntlProvider from '../lib/SafeIntlProvider';

function I18nBridge({ Component, pageProps }: { Component: any; pageProps: any }) {
  const { lang } = useI18n();
  const messages = getMessagesForLang(lang);
  return (
    <SafeIntlProvider messages={messages} locale={lang} onError={() => {}}>
      <div className="relative overflow-x-hidden">
        <Component {...pageProps} />
      </div>
    </SafeIntlProvider>
  );
}

function MyApp({ Component, pageProps }) {
  const router = useRouter();

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
        <PublicModeProvider initialMode={pageProps?.publicMode}>
          <FeatureFlagProvider initialFlags={pageProps?.featureFlags}>
            <LanguageProvider>
              <I18nBridge Component={Component} pageProps={pageProps} />
            </LanguageProvider>
          </FeatureFlagProvider>
        </PublicModeProvider>
      </ThemeProvider>
    </>
  );
}

export default MyApp;
