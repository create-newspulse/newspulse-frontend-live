jest.mock('../../../../lib/publicApiBase', () => ({
  getPublicApiBaseUrl: () => 'http://localhost:5000',
}));

import handler from '../../../../pages/api/community-reporter/my-stories';
import { REPORTER_SESSION_COOKIE, createSessionToken } from '../../../../lib/reporterPortalAuth';

describe('pages/api/community-reporter/my-stories', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn();
  });

  function mockBackendSession(email = 'reporter@example.com') {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true, session: { email } }),
    });
  }

  it('uses the authenticated reporter session before proxying stories for that reporter', async () => {
    const sessionToken = createSessionToken('Reporter@Example.com');
    mockBackendSession('reporter@example.com');
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true, submissions: [{ id: '1', reporterEmail: 'reporter@example.com' }] }),
    });

    const req = {
      method: 'GET',
      query: { email: 'other@example.com' },
      headers: {
        cookie: `${REPORTER_SESSION_COOKIE}=${sessionToken}`,
      },
      cookies: { [REPORTER_SESSION_COOKIE]: sessionToken },
    } as any;

    const res = createMockResponse();

    await handler(req, res as any);

    expect((global as any).fetch).toHaveBeenNthCalledWith(
      1,
      'http://localhost:5000/api/reporter-auth/session',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          cookie: `${REPORTER_SESSION_COOKIE}=${sessionToken}`,
        }),
      })
    );
    expect((global as any).fetch).toHaveBeenNthCalledWith(
      2,
      'http://localhost:5000/api/public/community-reporter/my-stories',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Accept: 'application/json',
          cookie: `${REPORTER_SESSION_COOKIE}=${sessionToken}`,
        }),
      })
    );
    expect((global as any).fetch.mock.calls[1][0]).not.toContain('other%40example.com');
    expect((global as any).fetch.mock.calls[1][1].headers.Cookie).toBeUndefined();
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ submissions: [{ id: '1', reporterEmail: 'reporter@example.com' }] });
    expect(res.headers['Cache-Control']).toBe('private, no-store');
  });

  it('returns a valid empty reporter-owned result for HTTP 200 with no records', async () => {
    const sessionToken = createSessionToken('reporter@example.com');
    mockBackendSession();
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true, stories: [] }),
    });

    const req = {
      method: 'GET',
      query: {},
      headers: { cookie: `${REPORTER_SESSION_COOKIE}=${sessionToken}` },
      cookies: { [REPORTER_SESSION_COOKIE]: sessionToken },
    } as any;

    const res = createMockResponse();

    await handler(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ submissions: [] });
  });

  it('filters upstream records to the authenticated reporter email', async () => {
    const sessionToken = createSessionToken('reporter@example.com');
    mockBackendSession();
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true, items: [
        { id: 'own', reporterAccountId: 'reporter@example.com' },
        { id: 'other', reporterEmail: 'other@example.com' },
        { id: 'legacy-no-email' },
      ] }),
    });

    const req = {
      method: 'GET',
      query: {},
      headers: { cookie: `${REPORTER_SESSION_COOKIE}=${sessionToken}` },
      cookies: { [REPORTER_SESSION_COOKIE]: sessionToken },
    } as any;

    const res = createMockResponse();

    await handler(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body.submissions).toEqual([
      { id: 'own', reporterAccountId: 'reporter@example.com' },
    ]);
  });

  it('rejects reporter story requests without the canonical session cookie before proxying', async () => {
    const req = {
      method: 'GET',
      query: { email: 'Reporter@Example.com' },
      headers: {},
      cookies: {},
    } as any;

    const res = createMockResponse();

    await handler(req, res as any);

    expect((global as any).fetch).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ ok: false, code: 'REPORTER_SESSION_MISSING', message: 'Reporter session missing or expired.' });
  });

  it.each([
    [401, 'REPORTER_SESSION_MISSING'],
    [403, 'REPORTER_SESSION_REQUIRED'],
    [404, 'NOT_FOUND'],
    [422, 'INVALID_REPORTER'],
    [500, 'UPSTREAM_ERROR'],
  ])('preserves upstream HTTP %s as a reporter stories data failure', async (status, code) => {
    const sessionToken = createSessionToken('reporter@example.com');
    mockBackendSession();
    (global as any).fetch.mockResolvedValueOnce({
      ok: false,
      status,
      text: async () => JSON.stringify({ ok: false, code, message: code }),
    });

    const req = {
      method: 'GET',
      query: {},
      headers: { cookie: `${REPORTER_SESSION_COOKIE}=${sessionToken}` },
      cookies: { [REPORTER_SESSION_COOKIE]: sessionToken },
    } as any;

    const res = createMockResponse();

    await handler(req, res as any);

    expect(res.statusCode).toBe(status);
    expect(res.body).toEqual({ ok: false, code, message: code });
  });

  it('returns 502 only for true network failures', async () => {
    const sessionToken = createSessionToken('reporter@example.com');
    mockBackendSession();
    (global as any).fetch.mockRejectedValueOnce(new Error('connect ECONNREFUSED'));

    const req = {
      method: 'GET',
      query: {},
      headers: { cookie: `${REPORTER_SESSION_COOKIE}=${sessionToken}` },
      cookies: { [REPORTER_SESSION_COOKIE]: sessionToken },
    } as any;

    const res = createMockResponse();

    await handler(req, res as any);

    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({
      ok: false,
      code: 'REPORTER_STORIES_UPSTREAM_UNAVAILABLE',
    });
  });

  it('returns 502 for upstream timeouts', async () => {
    const sessionToken = createSessionToken('reporter@example.com');
    mockBackendSession();
    (global as any).fetch.mockRejectedValueOnce(Object.assign(new Error('timeout'), { name: 'AbortError' }));

    const req = {
      method: 'GET',
      query: {},
      headers: { cookie: `${REPORTER_SESSION_COOKIE}=${sessionToken}` },
      cookies: { [REPORTER_SESSION_COOKIE]: sessionToken },
    } as any;

    const res = createMockResponse();

    await handler(req, res as any);

    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({
      ok: false,
      code: 'REPORTER_STORIES_UPSTREAM_UNAVAILABLE',
    });
  });

  it('returns 502 for malformed successful upstream responses', async () => {
    const sessionToken = createSessionToken('reporter@example.com');
    mockBackendSession();
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => 'not-json',
    });

    const req = {
      method: 'GET',
      query: {},
      headers: { cookie: `${REPORTER_SESSION_COOKIE}=${sessionToken}` },
      cookies: { [REPORTER_SESSION_COOKIE]: sessionToken },
    } as any;

    const res = createMockResponse();

    await handler(req, res as any);

    expect(res.statusCode).toBe(502);
    expect(res.body).toEqual({
      ok: false,
      code: 'REPORTER_STORIES_INVALID_UPSTREAM_RESPONSE',
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