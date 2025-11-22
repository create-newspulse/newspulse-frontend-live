// next.config.js

module.exports = {
  reactStrictMode: true,

  // Fix for Vercel deployment and workspace detection
  outputFileTracingRoot: __dirname,

  images: {
    // Migrate from deprecated `images.domains` to `remotePatterns`
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.newsapi.org', pathname: '/**' },
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'media.licdn.com', pathname: '/**' },
      { protocol: 'https', hostname: 'static.toiimg.com', pathname: '/**' },
      { protocol: 'https', hostname: 'gnews.io', pathname: '/**' },
      { protocol: 'https', hostname: 'cdn.gulte.com', pathname: '/**' },
    ],
  },

  env: {
    NEWSAPI_KEY: process.env.NEWSAPI_KEY,
    NEWSDATA_API_KEY: process.env.NEWSDATA_API_KEY,
    THENEWSAPI_TOKEN: process.env.THENEWSAPI_TOKEN,
    MEDIASTACK_API_KEY: process.env.MEDIASTACK_API_KEY,
    GNEWS_API_KEY: process.env.GNEWS_API_KEY,
  },

  async headers() {
    // Content Security Policy (CSP)
    const csp = [
      "default-src 'self'",
      // Next.js dev needs 'unsafe-eval'; GTM/Ads domains allowed explicitly
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://pagead2.googlesyndication.com https://fundingchoicesmessages.google.com",
      "style-src 'self' 'unsafe-inline'",
      // Permit our known CDNs plus data/blob
      "img-src 'self' data: blob: https://*.googleusercontent.com https://*.gstatic.com https://tpc.googlesyndication.com https://pagead2.googlesyndication.com https://images.unsplash.com https://media.licdn.com https://static.toiimg.com https://gnews.io https://cdn.gulte.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      // Connect for analytics, dev websockets, and local admin API
      "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://pagead2.googlesyndication.com http://localhost:5000 ws: wss:",
      // Allow embeds for Google ads as well as YouTube players used by Inspiration Hub
      "frame-src https://*.google.com https://*.doubleclick.net https://pagead2.googlesyndication.com https://www.youtube.com https://www.youtube-nocookie.com",
      "media-src 'self' blob:",
      "worker-src 'self' blob:",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      'upgrade-insecure-requests',
    ].join('; ');

    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // SAMEORIGIN (or DENY) prevents this site from being framed by others; it does not affect us embedding iframes
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
        ],
      },
    ];
  },
};
