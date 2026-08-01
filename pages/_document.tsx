import Document, { Html, Head, Main, NextScript } from 'next/document';

export default class MyDocument extends Document {
  render() {
    const locale = (this.props as any)?.__NEXT_DATA__?.locale || (this.props as any)?.locale || 'en';
    return (
      <Html lang={locale}>
        <Head>
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
