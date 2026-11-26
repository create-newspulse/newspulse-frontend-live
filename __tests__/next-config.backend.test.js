/** @jest-environment node */

describe('next.config backend separation', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_API_BASE;
    delete process.env.NEXT_PUBLIC_API_BASE_DEV;
    delete process.env.NEXT_PUBLIC_API_BASE_PROD;
    delete process.env.NEXT_PUBLIC_API_URL;
    delete process.env.NEXT_PUBLIC_BACKEND_URL;
    delete process.env.NEXT_PUBLIC_API_BASE_URL;
    delete process.env.NEXT_PUBLIC_BACKEND_API_BASE_URL;
    delete process.env.BACKEND_API_BASE_URL;
    delete process.env.NEWS_PULSE_BACKEND_URL;
    delete process.env.API_BASE_URL;
    delete process.env.NEXT_PUBLIC_ALLOW_PROD_BACKEND_IN_DEV;
    delete process.env.NEWS_PULSE_DEPLOYMENT;
    delete process.env.NEWS_PULSE_ENV;
    delete process.env.VERCEL_ENV;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('does not create Render backend rewrites for normal local development without local config', async () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    const config = require('../next.config.js');

    const rewrites = await config.rewrites();

    expect(JSON.stringify(rewrites)).not.toContain('newspulse-backend-real.onrender.com');
    warnSpy.mockRestore();
  });

  it('uses the local backend rewrite target in development', async () => {
    process.env.NEXT_PUBLIC_API_BASE_DEV = 'http://localhost:3010';
    const config = require('../next.config.js');

    const rewrites = await config.rewrites();

    for (const prefix of ['/public-api', '/admin-api/public']) {
      expect(rewrites).toContainEqual({ source: `${prefix}/news/:parts*`, destination: '/api/public/news-reader/:parts*' });
      const translationAction = rewrites.find(r => r.source === `${prefix}/news/:id([a-fA-F0-9]{24})/translate`);
      expect(translationAction.destination).toBe('http://localhost:3010/admin-api/public/news/:id/translate');
      expect(translationAction.missing).toContainEqual({ type: 'header', key: 'authorization' });
    }
    const external = rewrites.filter(r => r.source.includes(':area('));
    expect(external).toHaveLength(2);
    for (const rule of external) {
      expect(rule.destination).toBe('http://localhost:3010/admin-api/public/:area/:path*');
      expect(rule.source).toContain('broadcast|');
      expect(rule.source).not.toContain('|news|');
      expect(rule.source).not.toMatch(/community|reporter|journalist/);
      expect(rule.missing).toContainEqual({ type: 'header', key: 'cookie' });
    }
    expect(JSON.stringify(rewrites)).not.toContain('newspulse-backend-real.onrender.com/admin-api/public');
  });

  it('keeps the production backend rewrite target on Vercel production', async () => {
    process.env.VERCEL_ENV = 'production';
    process.env.NEXT_PUBLIC_API_BASE_PROD = 'https://newspulse-backend-real.onrender.com';
    const config = require('../next.config.js');

    const rewrites = await config.rewrites();

    expect(rewrites.filter(r => r.destination.startsWith('https:')).map(r => r.destination).sort()).toEqual([
      ...Array(2).fill('https://newspulse-backend-real.onrender.com/admin-api/public/:area/:path*'),
      ...Array(2).fill('https://newspulse-backend-real.onrender.com/admin-api/public/news/:id/translate'),
    ].sort());
    expect(require('../vercel.json').rewrites.every(r => r.destination.startsWith('/'))).toBe(true);
  });

  it('allows the next/image qualities used by article cards and hero images', () => {
    const config = require('../next.config.js');

    expect(config.images.qualities).toEqual([74, 75, 76, 78, 90]);
  });

  it('allows controlled Instagram and Facebook article iframes without enabling third-party embed scripts or broad CSP sources', async () => {
    process.env.NODE_ENV = 'production';
    process.env.VERCEL_ENV = 'production';
    const config = require('../next.config.js');

    const headers = await config.headers();
    const csp = headers[0].headers.find((header) => header.key === 'Content-Security-Policy').value;
    const directives = Object.fromEntries(csp.split('; ').map((directive) => {
      const [name, ...sources] = directive.split(' ');
      return [name, sources];
    }));

    expect(directives['frame-src']).toContain('https://www.instagram.com');
  expect(directives['frame-src']).toContain('https://www.facebook.com');
    expect(directives['script-src']).not.toContain('https://www.instagram.com');
    expect(directives['script-src']).not.toContain('https://www.instagram.com/embed.js');
  expect(directives['script-src']).not.toContain('https://www.facebook.com');
  expect(directives['script-src']).not.toContain('https://connect.facebook.net');
  expect(directives['connect-src']).not.toContain('https://www.facebook.com');
  expect(directives['connect-src']).not.toContain('https://connect.facebook.net');
    expect(directives['frame-src']).not.toContain('*');
    expect(directives['script-src']).not.toContain('*');
    expect(directives['script-src']).not.toContain('https:');
    expect(directives['script-src']).not.toContain("'unsafe-eval'");
  });
});