jest.mock('../../../../lib/publicApiBase', () => ({
  getPublicApiBaseUrl: () => 'http://localhost:3010',
}));

import handler from '../../../../pages/api/reporter-auth/session';
import { REPORTER_SESSION_COOKIE, createSessionToken } from '../../../../lib/reporterPortalAuth';

describe('pages/api/reporter-auth/session', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn();
  });

  it('returns REPORTER_SESSION_MISSING when the canonical cookie is absent', async () => {
    const req = {
      method: 'GET',
      cookies: {},
      headers: {},
    } as any;

    const res = createMockResponse();
    await handler(req, res as any);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ ok: false, code: 'REPORTER_SESSION_MISSING', message: 'Reporter session missing or expired.' });
    expect((global as any).fetch).not.toHaveBeenCalled();
    expect(res.headers['Set-Cookie']).toBeUndefined();
    expect(res.headers['Cache-Control']).toBe('private, no-store');
    expect(res.headers.Pragma).toBe('no-cache');
  });

  it('expires the canonical cookie when it is invalid', async () => {
    const req = {
      method: 'GET',
      cookies: {
        [REPORTER_SESSION_COOKIE]: 'stale-cookie-token',
      },
      headers: {},
    } as any;

    const res = createMockResponse();
    await handler(req, res as any);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ ok: false, code: 'REPORTER_SESSION_MISSING', message: 'Reporter session missing or expired.' });
    expect(res.headers['Set-Cookie']).toBeTruthy();
  });

  it('returns the active reporter session from the canonical cookie', async () => {
    const sessionToken = createSessionToken('Reporter@Example.com');
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true, session: { email: 'reporter@example.com' } }),
    });

    const req = {
      method: 'GET',
      cookies: {
        [REPORTER_SESSION_COOKIE]: sessionToken,
      },
      headers: {
        cookie: `${REPORTER_SESSION_COOKIE}=${sessionToken}`,
      },
    } as any;

    const res = createMockResponse();
    await handler(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      reporter: {
        email: 'reporter@example.com',
      },
      session: {
        email: 'reporter@example.com',
      },
    });
    expect((global as any).fetch).toHaveBeenCalledWith(
      'http://localhost:3010/api/reporter-auth/session',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Accept: 'application/json',
          cookie: `${REPORTER_SESSION_COOKIE}=${sessionToken}`,
        }),
        cache: 'no-store',
      })
    );
  });

  it('rejects a local-only reporter cookie when the backend reporter session is missing', async () => {
    const sessionToken = createSessionToken('Reporter@Example.com');
    (global as any).fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ ok: false, code: 'REPORTER_SESSION_MISSING', message: 'Reporter session missing or expired.' }),
    });

    const req = {
      method: 'GET',
      cookies: {
        [REPORTER_SESSION_COOKIE]: sessionToken,
      },
      headers: {
        cookie: `${REPORTER_SESSION_COOKIE}=${sessionToken}`,
      },
    } as any;

    const res = createMockResponse();
    await handler(req, res as any);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ ok: false, code: 'REPORTER_SESSION_MISSING', message: 'Reporter session missing or expired.' });
    expect(res.headers['Set-Cookie']).toBeTruthy();
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