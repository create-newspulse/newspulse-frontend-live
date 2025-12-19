import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Script from 'next/script';
import * as gtag from '../lib/gtag';
import { LanguageProvider } from '../utils/LanguageContext';
import { ThemeProvider } from '../utils/ThemeContext';
import { FeatureFlagProvider } from '../utils/FeatureFlagProvider';
import '../styles/globals.css';
import SafeIntlProvider from '../lib/SafeIntlProvider';

function MyApp({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
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

  const messagesFromPage = pageProps?.messages;
  const locale = pageProps?.locale || router.locale || 'en';

  if (process.env.NODE_ENV !== 'production' && !messagesFromPage) {
    console.warn('[i18n] Missing pageProps.messages. Ensure getStaticProps/getServerSideProps returns messages.');
  }

  const enMessages = require('../messages/en.json');
  const finalMessages = (messagesFromPage as any)?.default ?? messagesFromPage ?? enMessages.default ?? enMessages;

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
        <FeatureFlagProvider initialFlags={pageProps?.featureFlags}>
          <LanguageProvider>
            <SafeIntlProvider messages={finalMessages} locale={locale} onError={() => {}}>
              <div className="relative overflow-x-hidden">
                <Component {...pageProps} />
              </div>
            </SafeIntlProvider>
          </LanguageProvider>
        </FeatureFlagProvider>
      </ThemeProvider>
    </>
  );
}

export default MyApp;
