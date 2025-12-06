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
      // Add a strict Content Security Policy and include GTM image beacon domain
      const csp = [
        "default-src 'self'",
        // Scripts: allow self and GTM/GA if used
        "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://www.google-analytics.com",
        // Styles: allow self and inline for frameworks like Tailwind
        "style-src 'self' 'unsafe-inline'",
        // Images: include self, data, blobs, and existing domains plus googletagmanager
        "img-src 'self' data: blob: https://*.googleusercontent.com https://*.gstatic.com https://tpc.googlesyndication.com https://pagead2.googlesyndication.com https://images.unsplash.com https://media.licdn.com https://static.toiimg.com https://gnews.io https://cdn.gulte.com https://www.googletagmanager.com",
        // Fonts
        "font-src 'self' data: https://*.gstatic.com",
        // Connections: allow self, GTM/GA, and websockets for HMR
        "connect-src 'self' https://www.googletagmanager.com https://www.google-analytics.com ws:",
        // Frames: allow self only
        "frame-src 'self'",
        // Workers
        "worker-src 'self'",
        // Manifests
        "manifest-src 'self'",
      ].join('; ');

      return [
        {
          source: '/:path*',
          headers: [
            {
              key: 'Content-Security-Policy',
              value: csp,
            },
          ],
        },
      ];
  },
};
