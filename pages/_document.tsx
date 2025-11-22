// pages/_document.tsx
import Document, { Html, Head, Main, NextScript } from 'next/document';
import { GA_TRACKING_ID } from '../lib/gtag';

export default class MyDocument extends Document {
  render() {
    return (
      <Html>
        <Head>
          {/* Meta Tags */}
          <meta name="theme-color" content="#0f172a" />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="apple-mobile-web-app-status-bar-style" content="default" />
          <meta name="apple-mobile-web-app-title" content="News Pulse" />
          <meta name="description" content="Your trusted source for breaking news and in-depth analysis" />
          <meta name="format-detection" content="telephone=no" />
          <meta name="mobile-web-app-capable" content="yes" />
          <meta name="msapplication-TileColor" content="#3b82f6" />
          <meta name="msapplication-tap-highlight" content="no" />
          <meta name="application-name" content="News Pulse" />
          <link rel="manifest" href="/manifest.webmanifest" />
          
          {/* App Icons (favicons) */}
          <link rel="apple-touch-icon" sizes="180x180" href="/icons/icon-180x180.png" />
          <link rel="icon" type="image/png" sizes="32x32" href="/icons/icon-32x32.png" />
          <link rel="icon" type="image/png" sizes="16x16" href="/icons/icon-16x16.png" />
          
          {/* Global Site Tag (gtag.js) - Google Analytics */}
          <script
            async
            src={`https://www.googletagmanager.com/gtag/js?id=${GA_TRACKING_ID}`}
          />
          <script
            dangerouslySetInnerHTML={{
              __html: `
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${GA_TRACKING_ID}', {
                  page_path: window.location.pathname,
                });
              `,
            }}
          />

          {/* Google Funding Choices (Consent) - only inject when publisher id is provided */}
          {process.env.NEXT_PUBLIC_ADSENSE_PUB_ID ? (
            <>
              <script
                async
                src={`https://fundingchoicesmessages.google.com/i/${process.env.NEXT_PUBLIC_ADSENSE_PUB_ID}?ers=1`}
              />
              <script
                dangerouslySetInnerHTML={{
                  __html: `
                    (function() {
                      function signalGooglefcPresent() { if (!window.frames['googlefcPresent']) {
                        if (document.body) {
                          const iframe = document.createElement('iframe'); iframe.style='width:0;height:0;border:0;display:none';
                          iframe.name='googlefcPresent'; document.body.appendChild(iframe);
                        } else { setTimeout(signalGooglefcPresent, 50); }
                      } }
                      signalGooglefcPresent();
                    })();
                  `,
                }}
              />
            </>
          ) : null}
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
