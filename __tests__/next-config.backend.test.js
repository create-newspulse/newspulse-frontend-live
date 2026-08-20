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

    expect(JSON.stringify(rewrites)).toContain('http://localhost:3010/admin-api/public/:path*');
    expect(JSON.stringify(rewrites)).not.toContain('newspulse-backend-real.onrender.com/admin-api/public');
  });

  it('keeps the production backend rewrite target on Vercel production', async () => {
    process.env.VERCEL_ENV = 'production';
    process.env.NEXT_PUBLIC_API_BASE_PROD = 'https://newspulse-backend-real.onrender.com';
    const config = require('../next.config.js');

    const rewrites = await config.rewrites();

    expect(JSON.stringify(rewrites)).toContain('https://newspulse-backend-real.onrender.com/admin-api/public/:path*');
  });
});