// next.config.js

function normalizeBase(raw) {
  return String(raw || '')
    .toString()
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/api\/?$/, '');
}

function isProdDeployment() {
  if (String(process.env.VERCEL_ENV || '').toLowerCase() === 'production') return true;
  const explicit = String(process.env.NEWS_PULSE_DEPLOYMENT || process.env.NEWS_PULSE_ENV || '').toLowerCase();
  return explicit === 'production' || explicit === 'prod';
}

function resolveBackendBase() {
  const explicit = normalizeBase(process.env.NEXT_PUBLIC_API_BASE);
  if (explicit) return explicit;

  const split = normalizeBase(
    (isProdDeployment() ? process.env.NEXT_PUBLIC_API_BASE_PROD : process.env.NEXT_PUBLIC_API_BASE_DEV) || ''
  );
  if (split) return split;

  const legacy = normalizeBase(
    process.env.NEXT_PUBLIC_API_URL ||
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      process.env.NEXT_PUBLIC_BACKEND_API_BASE_URL ||
      process.env.BACKEND_API_BASE_URL ||
      process.env.NEWS_PULSE_BACKEND_URL ||
      process.env.API_BASE_URL ||
      ''
  );

  // Keep parity with rewrites() default so image hosts work out-of-the-box.
  return legacy || normalizeBase('https://newspulse-backend-real.onrender.com');
}

function getBackendHostname() {
  const base = resolveBackendBase();
  if (!base) return '';
  try {
    return new URL(base).hostname;
  } catch {
    // If base is an origin-ish string without protocol, skip.
    return '';
  }
}

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
    domains: Array.from(
      new Set(
        ['res.cloudinary.com', 'newspulse-backend-real.onrender.com', getBackendHostname()].filter(Boolean)
      )
    ),
    remotePatterns: [
      { protocol: 'https', hostname: 'res.cloudinary.com', pathname: '/**' },
      { protocol: 'https', hostname: 'cdn.newsapi.org', pathname: '/**' },
      { protocol: 'https', hostname: 'images.unsplash.com', pathname: '/**' },
      { protocol: 'https', hostname: 'media.licdn.com', pathname: '/**' },
      { protocol: 'https', hostname: 'static.toiimg.com', pathname: '/**' },
      { protocol: 'https', hostname: 'gnews.io', pathname: '/**' },
      { protocol: 'https', hostname: 'cdn.gulte.com', pathname: '/**' },
      ...(getBackendHostname()
        ? [
            { protocol: 'https', hostname: getBackendHostname(), pathname: '/**' },
            { protocol: 'http', hostname: getBackendHostname(), pathname: '/**' },
          ]
        : []),
    ],
  },

  // Enable locale routes (/hi, /gu) for SEO + shareable URLs.
  // UI strings still come from the in-app LanguageProvider dictionaries.
  i18n: {
    locales: ['en', 'hi', 'gu'],
    defaultLocale: 'en',
    localeDetection: false,
  },

  // Dev-only (suppresses allowedDevOrigins warning for LAN testing)
  allowedDevOrigins: ['localhost', '127.0.0.1', '10.145.86.143'],

  async redirects() {
    return [
      // Canonical regional landing page.
      // Avoids the redirect-only /regional (pages/regional.tsx), which can cause repeated
      // `regional.json` Next data requests in some clients.
      {
        source: '/regional',
        destination: '/regional/gujarat',
        permanent: false,
      },
      {
        source: '/hi/regional',
        destination: '/hi/regional/gujarat',
        permanent: false,
      },
      {
        source: '/gu/regional',
        destination: '/gu/regional/gujarat',
        permanent: false,
      },
      {
        source: '/en/regional',
        destination: '/regional/gujarat',
        permanent: false,
      },
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

    // Locale-stable regional routes:
    // Some deployments have intermittently failed to resolve locale-prefixed regional routes.
    // Keep a light rewrite to the canonical `/regional/*` page tree, but DO NOT disable locale
    // handling or inject `?lang=`. Disabling locale can cause Next's data prefetch to request the
    // wrong locale JSON and repeatedly hit 307 redirects (seen as `gujarat.json` 307 loops).
    const regionalLocaleRewrites = [
      {
        source: '/hi/regional/:path*',
        destination: '/regional/:path*',
      },
      {
        source: '/gu/regional/:path*',
        destination: '/regional/:path*',
      },
    ];

    // Frontend-friendly alias (requested contract) for ticker endpoints.
    // These hit our Next API routes under /pages/api/public/broadcast/*.
    const localAliases = [
      {
        source: '/public/broadcast/:path*',
        destination: '/api/public/broadcast/:path*',
      },
      {
        source: '/public/ui-labels',
        destination: '/api/public/ui-labels',
      },
    ];

    if (!backend) return [...regionalLocaleRewrites, ...localAliases];

    return [
      ...regionalLocaleRewrites,
      ...localAliases,
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
      `img-src 'self' data: blob: https://*.googleusercontent.com https://*.gstatic.com https://tpc.googlesyndication.com https://pagead2.googlesyndication.com https://images.unsplash.com https://media.licdn.com https://static.toiimg.com https://gnews.io https://cdn.gulte.com https://res.cloudinary.com https://newspulse-backend-real.onrender.com${backend ? ` ${backend}` : ''} https://www.googletagmanager.com https://www.google-analytics.com`,

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
