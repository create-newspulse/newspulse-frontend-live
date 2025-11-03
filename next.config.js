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

  headers: async () => [
    {
      source: "/(.*)",
      headers: [
        {
          key: "X-Frame-Options",
          value: "DENY",
        },
        {
          key: "X-Content-Type-Options",
          value: "nosniff",
        },
        {
          key: "Referrer-Policy",
          value: "strict-origin-when-cross-origin",
        },
      ],
    },
  ],
};
