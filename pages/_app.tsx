import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Script from 'next/script';
import * as gtag from '../lib/gtag';
import { LanguageProvider } from '../utils/LanguageContext';
import { ThemeProvider } from '../utils/ThemeContext';
import '../styles/globals.css';
import i18n from '../lib/i18n';
import { I18nextProvider } from 'react-i18next';

function MyApp({ Component, pageProps }) {
  const router = useRouter();

  useEffect(() => {
    const handleRouteChange = (url) => {
      gtag.pageview(url);
    };
    router.events.on('routeChangeComplete', handleRouteChange);
    // PWA service worker registration is opt-in via NEXT_PUBLIC_ENABLE_PWA=true
    const enablePwa = process.env.NEXT_PUBLIC_ENABLE_PWA === 'true';
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      if (process.env.NODE_ENV === 'production') {
        if (enablePwa) {
          navigator.serviceWorker.register('/service-worker.js').catch(() => {});
        } else {
          // Ensure no SW is controlling the page to avoid 410 fetch errors
          navigator.serviceWorker.getRegistrations?.().then((regs) => regs.forEach((r) => r.unregister()));
        }
      } else {
        // In dev, ensure no SW is controlling the page to avoid caching HMR assets
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
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
        strategy="afterInteractive"
      />
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

      {/* App with Context and Tailwind */}
      <ThemeProvider>
        <LanguageProvider>
          <I18nextProvider i18n={i18n}>
            <Component {...pageProps} />
          </I18nextProvider>
        </LanguageProvider>
      </ThemeProvider>
    </>
  );
}

export default MyApp;
