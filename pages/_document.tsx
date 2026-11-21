import Document, { Html, Head, Main, NextScript } from 'next/document';
import { COOKIE_CONSENT_NAME, COOKIE_CONSENT_VERSION, decodeCurrentConsent, readCookieValue } from '../src/consent/cookieConsent';

// Static/ISR HTML is shared. Resolve localStorage before the body paints, not in a mount effect.
export const initialThemeScript = `(() => {
  const raw = (${readCookieValue})(${JSON.stringify(COOKIE_CONSENT_NAME)});
  const consent = (${decodeCurrentConsent})(raw, ${JSON.stringify(COOKIE_CONSENT_VERSION)}, Date.now());
  if (!consent || !consent.categories || consent.categories.preferences !== true) return;
  try {
    const style = (localStorage.getItem('np_style') || '').trim().toLowerCase();
    if (style === 'midnight' || (style !== 'aurora' && localStorage.getItem('theme') === 'dark')) {
      document.documentElement.classList.add('dark');
    }
  } catch { console.warn('[theme] Preference storage unavailable; starting in Aurora.'); }
})();`;

export default class MyDocument extends Document {
  render() {
    const locale = (this.props as any)?.__NEXT_DATA__?.locale || (this.props as any)?.locale || 'en';
    return (
      <Html lang={locale}>
        <Head>
          <script id="np-initial-theme" dangerouslySetInnerHTML={{ __html: initialThemeScript }} />
          {/* Meta Tags */}
          <meta name="theme-color" content="#102A43" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="News Pulse" />
          <meta name="description" content="Your trusted source for breaking news and in-depth analysis" />
          <meta name="format-detection" content="telephone=no" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="msapplication-TileColor" content="#3b82f6" />
          <meta name="msapplication-tap-highlight" content="no" />
          <meta name="application-name" content="News Pulse" />
          <meta name="google-adsense-account" content="ca-pub-9257940786279478" />
          <link rel="manifest" href="/manifest.webmanifest" />
          
          {/* App Icons (favicons) */}
          <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180x180.png" />
          <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32x32.png" />
          <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-16x16.png" />
          
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
