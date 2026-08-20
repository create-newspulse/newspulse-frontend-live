jest.mock('../../../../lib/publicApiBase', () => ({
  getPublicApiBaseUrl: () => 'http://localhost:3010',
}));

import handler from '../../../../pages/api/reporter-auth/verify-code';
import { REPORTER_SESSION_COOKIE } from '../../../../lib/reporterPortalAuth';

describe('pages/api/reporter-auth/verify-code', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn();
  });

  it('maps upstream session-missing verify failures to SESSION_EXPIRED', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers(),
      text: async () => JSON.stringify({ ok: false, code: 'REPORTER_SESSION_MISSING', message: 'REPORTER_SESSION_MISSING' }),
    });

    const req = {
      method: 'POST',
      body: { email: 'reporter@example.com', code: '123456' },
      headers: {},
      cookies: {},
    } as any;

    const res = createMockResponse();
    await handler(req, res as any);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ ok: false, code: 'SESSION_EXPIRED', message: 'SESSION_EXPIRED', backendCode: 'REPORTER_SESSION_MISSING' });
    const cookies = ([] as string[]).concat(res.headers['Set-Cookie'] || []);
    expect(cookies.some((value) => value.includes('np_reporter_portal_challenge='))).toBe(true);
  });

  it('normalizes generic upstream verify 500 failures to REPORTER_VERIFY_CODE_FAILED', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers(),
      text: async () => 'upstream verify failed unexpectedly',
    });

    const req = {
      method: 'POST',
      body: { email: 'reporter@example.com', code: '123456' },
      headers: {},
      cookies: {},
    } as any;

    const res = createMockResponse();
    await handler(req, res as any);

    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({
      ok: false,
      code: 'REPORTER_VERIFY_CODE_FAILED',
      message: 'REPORTER_VERIFY_CODE_FAILED',
      backendCode: null,
      backendMessage: 'upstream verify failed unexpectedly',
    });
  });

  it('sets the canonical HttpOnly session cookie and a frontend-scoped backend reporter cookie after successful backend verification without returning tokens', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers({ 'set-cookie': 'backend-reporter-session=backend-token; Domain=backend.example; Secure; Path=/' }),
      text: async () => JSON.stringify({ ok: true, email: 'Reporter@Example.com', sessionToken: 'raw-backend-token', session: { token: 'nested-raw-token', email: 'Reporter@Example.com' } }),
    });

    const req = {
      method: 'POST',
      body: { email: 'reporter@example.com', code: '123456' },
      headers: {},
      cookies: {},
    } as any;

    const res = createMockResponse();
    await handler(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true, email: 'reporter@example.com', session: { email: 'Reporter@Example.com' } });
    expect(res.body.sessionToken).toBeUndefined();
    expect(res.body.token).toBeUndefined();
    expect(res.body.session.token).toBeUndefined();

    const cookies = ([] as string[]).concat(res.headers['Set-Cookie'] || []);
    const sessionCookie = cookies.find((value) => value.startsWith(`${REPORTER_SESSION_COOKIE}=`));
    expect(sessionCookie).toBeTruthy();
    expect(sessionCookie).toContain('Path=/');
    expect(sessionCookie).toContain('SameSite=Lax');
    expect(sessionCookie).toContain('HttpOnly');
    expect(sessionCookie).not.toContain('Domain=');
    expect(sessionCookie).not.toContain('Secure');
    const backendCookie = cookies.find((value) => value.startsWith('backend-reporter-session='));
    expect(backendCookie).toBeTruthy();
    expect(backendCookie).toContain('Path=/');
    expect(backendCookie).toContain('SameSite=Lax');
    expect(backendCookie).toContain('HttpOnly');
    expect(backendCookie).not.toContain('Domain=');
    expect(backendCookie).not.toContain('Secure');
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