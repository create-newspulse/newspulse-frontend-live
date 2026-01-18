// next.config.js

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Unblock Vercel builds when ESLint crashes during next build (circular JSON bug)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Fix for Vercel deployment and workspace detection
  outputFileTracingRoot: __dirname,

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.newsapi.org', pathname: '/**' },
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'media.licdn.com', pathname: '/**' },
      { protocol: 'https', hostname: 'static.toiimg.com', pathname: '/**' },
      { protocol: 'https', hostname: 'gnews.io', pathname: '/**' },
      { protocol: 'https', hostname: 'cdn.gulte.com', pathname: '/**' },
    ],
  },

  // UI language is handled by the in-app LanguageProvider (no locale routes).

  // Dev-only (suppresses allowedDevOrigins warning for LAN testing)
  allowedDevOrigins: ['localhost', '127.0.0.1', '10.145.86.143'],

  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'newspulse.co.in' }],
        destination: 'https://www.newspulse.co.in/:path*',
        permanent: true,
      },
    ];
  },

  async rewrites() {
    // Prefer Next.js API routes under pages/api for most proxying.
    // BUT: broadcast tickers intentionally use same-origin `/admin-api/public/*` (and legacy `/public-api/*`)
    // so Vercel rewrites can forward to backend without CORS.
    const isProdDeployment =
      String(process.env.VERCEL_ENV || '').toLowerCase() === 'production' ||
      ['prod', 'production'].includes(
        String(process.env.NEWS_PULSE_DEPLOYMENT || process.env.NEWS_PULSE_ENV || '').toLowerCase()
      );
    const backendRaw =
      (process.env.NEXT_PUBLIC_API_BASE ||
        (isProdDeployment ? process.env.NEXT_PUBLIC_API_BASE_PROD : process.env.NEXT_PUBLIC_API_BASE_DEV) ||
        process.env.NEXT_PUBLIC_API_URL ||
        process.env.NEXT_PUBLIC_BACKEND_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        'https://newspulse-backend-real.onrender.com')
        .toString()
        .trim();
    const backend = backendRaw.replace(/\/+$/, '').replace(/\/api\/?$/, '');

    if (!backend) return [];

    return [
      {
        source: '/admin-api/public/:path*',
        destination: `${backend}/admin-api/public/:path*`,
      },
      {
        source: '/public-api/:path*',
        destination: `${backend}/admin-api/public/:path*`,
      },
    ];
  },

  async headers() {
    const isDev = process.env.NODE_ENV !== 'production';
    const isProdDeployment =
      String(process.env.VERCEL_ENV || '').toLowerCase() === 'production' ||
      ['prod', 'production'].includes(String(process.env.NEWS_PULSE_DEPLOYMENT || process.env.NEWS_PULSE_ENV || '').toLowerCase());
    const backendRaw =
      (process.env.NEXT_PUBLIC_API_BASE ||
        (isProdDeployment ? process.env.NEXT_PUBLIC_API_BASE_PROD : process.env.NEXT_PUBLIC_API_BASE_DEV) ||
        process.env.NEXT_PUBLIC_API_URL ||
        process.env.NEXT_PUBLIC_BACKEND_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        '')
        .toString()
        .trim();
    const backend = backendRaw.replace(/\/+$/, '').replace(/\/api\/?$/, '');

    // Content Security Policy
    const csp = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",

      // Next.js + GTM/GA
      `script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com${
        isDev ? " 'unsafe-eval'" : ''
      }`,

      // Tailwind/inline styles
      "style-src 'self' 'unsafe-inline'",

      // Images (ads + analytics + your image sources)
      "img-src 'self' data: blob: https://*.googleusercontent.com https://*.gstatic.com https://tpc.googlesyndication.com https://pagead2.googlesyndication.com https://images.unsplash.com https://media.licdn.com https://static.toiimg.com https://gnews.io https://cdn.gulte.com https://www.googletagmanager.com https://www.google-analytics.com",

      // Fonts
      "font-src 'self' data: https://*.gstatic.com",

      // ✅ IMPORTANT: allow backend API requests (this fixes your blocked fetch)
      `connect-src 'self'${backend ? ` ${backend}` : ''} https://www.googletagmanager.com https://www.google-analytics.com ws: wss:`,

      // Frames (keep strict; add domains only if you embed content like YouTube)
      "frame-src 'self'",

      // Workers (Next sometimes needs blob:)
      "worker-src 'self' blob:",

      "manifest-src 'self'",
      'upgrade-insecure-requests',
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: csp },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
