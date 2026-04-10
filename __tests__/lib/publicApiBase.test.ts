/** @jest-environment node */

describe('lib/publicApiBase', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.NEXT_PUBLIC_API_BASE;
    delete process.env.NEXT_PUBLIC_API_BASE_PROD;
    delete process.env.NEXT_PUBLIC_API_BASE_DEV;
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

  it('falls back to the Render backend for production deployments when no env base is configured', () => {
    process.env.VERCEL_ENV = 'production';

    const { getPublicApiBaseUrl } = require('../../lib/publicApiBase');

    expect(getPublicApiBaseUrl()).toBe('https://newspulse-backend-real.onrender.com');
  });

  it('refuses the production backend in local dev unless explicitly allowed', () => {
    process.env.NEXT_PUBLIC_API_BASE = 'https://www.newspulse.co.in';

    const { getPublicApiBaseUrl } = require('../../lib/publicApiBase');

    expect(getPublicApiBaseUrl()).toBe('');
  });
});