/** @jest-environment node */

describe('lib/reporterAuthProxy', () => {
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
    delete process.env.NEWS_PULSE_DEPLOYMENT;
    delete process.env.NEWS_PULSE_ENV;
    delete process.env.VERCEL_ENV;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('falls back to the Render backend when the configured base matches the live frontend host', () => {
    process.env.VERCEL_ENV = 'production';
    process.env.NEXT_PUBLIC_API_BASE = 'https://www.newspulse.co.in';

    const { resolveReporterAuthProxyUrl } = require('../../lib/reporterAuthProxy');

    expect(
      resolveReporterAuthProxyUrl('/api/reporter-auth/request-code', {
        headers: { host: 'www.newspulse.co.in' },
      })
    ).toBe('https://newspulse-backend-real.onrender.com/api/reporter-auth/request-code');
  });

  it('uses the configured backend when it already points to the backend host', () => {
    process.env.VERCEL_ENV = 'production';
    process.env.NEXT_PUBLIC_API_BASE = 'https://newspulse-backend-real.onrender.com';

    const { resolveReporterAuthProxyUrl } = require('../../lib/reporterAuthProxy');

    expect(
      resolveReporterAuthProxyUrl('/api/reporter-auth/request-code', {
        headers: { host: 'www.newspulse.co.in' },
      })
    ).toBe('https://newspulse-backend-real.onrender.com/api/reporter-auth/request-code');
  });

  it('does not substitute a production backend for same-host self-proxying outside production', () => {
    process.env.NEXT_PUBLIC_API_BASE = 'https://preview.newspulse.app';

    const { resolveReporterAuthProxyUrl } = require('../../lib/reporterAuthProxy');

    expect(
      resolveReporterAuthProxyUrl('/api/reporter-auth/request-code', {
        headers: { host: 'preview.newspulse.app' },
      })
    ).toBeNull();
  });
});