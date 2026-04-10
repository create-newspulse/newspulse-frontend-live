jest.mock('../../../../lib/publicApiBase', () => ({
  getPublicApiBaseUrl: () => 'http://localhost:3010',
}));

jest.mock('../../../../lib/reporterPortalAuth', () => {
  const actual = jest.requireActual('../../../../lib/reporterPortalAuth');
  return {
    ...actual,
    sendReporterPortalLoginEmail: jest.fn(async () => ({ delivered: true, provider: 'resend', debugCode: '123456' })),
  };
});

import handler from '../../../../pages/api/reporter-auth/request-code';
import { sendReporterPortalLoginEmail } from '../../../../lib/reporterPortalAuth';

describe('pages/api/reporter-auth/request-code', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn();
    (sendReporterPortalLoginEmail as jest.Mock).mockClear();
  });

  it('sets a frontend challenge cookie when the proxied request-code call succeeds', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () => JSON.stringify({ ok: true, email: 'reporter@example.com', expiresAt: '2026-04-08T12:00:00.000Z' }),
    });

    const req = {
      method: 'POST',
      body: { email: 'reporter@example.com' },
      headers: {},
    } as any;

    const res = createMockResponse();
    await handler(req, res as any);

    expect(res.statusCode).toBe(200);
    expect((global as any).fetch).toHaveBeenCalledWith(
      'http://localhost:3010/api/reporter-auth/request-code',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Accept: 'application/json',
          'Content-Type': 'application/json',
        }),
        body: JSON.stringify({ email: 'reporter@example.com' }),
      })
    );
    const cookies = ([] as string[]).concat(res.headers['Set-Cookie'] || []);
    expect(cookies.some((value) => value.includes('np_reporter_portal_challenge='))).toBe(true);
  });

  it('falls back to local email delivery when the proxied request-code call returns 503', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      headers: new Headers(),
      text: async () => JSON.stringify({ ok: false, code: 'REPORTER_EMAIL_UNAVAILABLE', message: 'REPORTER_PORTAL_EMAIL_SEND_FAILED' }),
    });

    const req = {
      method: 'POST',
      body: { email: 'reporter@example.com' },
      headers: {
        host: 'www.newspulse.co.in',
        'x-forwarded-proto': 'https',
      },
    } as any;

    const res = createMockResponse();
    await handler(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(sendReporterPortalLoginEmail).toHaveBeenCalledTimes(1);
    const cookies = ([] as string[]).concat(res.headers['Set-Cookie'] || []);
    expect(cookies.some((value) => value.includes('np_reporter_portal_otp='))).toBe(true);
    expect(cookies.some((value) => value.includes('np_reporter_portal_challenge='))).toBe(true);
  });
});

function createMockResponse() {
  const response = {
    statusCode: 200,
    headers: {} as Record<string, string | string[]>,
    body: undefined as any,
    setHeader(name: string, value: string | string[]) {
      response.headers[name] = value;
    },
    status(code: number) {
      response.statusCode = code;
      return response;
    },
    json(payload: any) {
      response.body = payload;
      return response;
    },
  };

  return response;
}