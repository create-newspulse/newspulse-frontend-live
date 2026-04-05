jest.mock('../../../../lib/publicApiBase', () => ({
  getPublicApiBaseUrl: () => 'http://localhost:3010',
}));

import handler from '../../../../pages/api/reporter-auth/session';

describe('pages/api/reporter-auth/session', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn();
  });

  it('maps upstream 401 auth failures to the frontend session-expired state', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      headers: new Headers(),
      text: async () => JSON.stringify({ ok: false, code: 'REPORTER_SESSION_MISSING', message: 'Reporter session missing or expired.' }),
    });

    const req = {
      method: 'GET',
      cookies: {
        np_reporter_portal_session: 'stale-cookie-token',
      },
      headers: {},
    } as any;

    const res = createMockResponse();
    await handler(req, res as any);

    expect(res.statusCode).toBe(401);
    expect(res.body).toMatchObject({ ok: false, code: 'SESSION_EXPIRED', message: 'SESSION_EXPIRED', backendCode: 'REPORTER_SESSION_MISSING' });
    expect(res.headers['Set-Cookie']).toBeTruthy();
  });

  it('returns the active reporter session from the backend payload', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      headers: new Headers(),
      text: async () => JSON.stringify({ ok: true, session: { email: 'reporter@example.com', expiresAt: '2026-04-06T05:20:19.019Z' } }),
    });

    const req = {
      method: 'GET',
      cookies: {
        np_reporter_portal_session: 'backend-cookie-value',
      },
      headers: {},
    } as any;

    const res = createMockResponse();
    await handler(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      session: {
        email: 'reporter@example.com',
      },
    });
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