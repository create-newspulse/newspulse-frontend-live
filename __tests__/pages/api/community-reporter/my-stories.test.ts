jest.mock('../../../../lib/publicApiBase', () => ({
  getPublicApiBaseUrl: () => 'http://localhost:3010',
}));

import handler from '../../../../pages/api/community-reporter/my-stories';
import { createSessionToken } from '../../../../lib/reporterPortalAuth';

describe('pages/api/community-reporter/my-stories', () => {
  beforeEach(() => {
    process.env.REPORTER_PORTAL_AUTH_SECRET = 'test-reporter-secret';
    (global as any).fetch = jest.fn();
  });

  it('forwards reporter auth headers to the upstream backend', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true, items: [] }),
    });

    const req = {
      method: 'GET',
      query: { email: 'Reporter@Example.com' },
      headers: {
        cookie: 'np_reporter_portal_session=session-cookie',
        authorization: 'Bearer local-session-token',
      },
      cookies: {},
    } as any;

    const res = createMockResponse();

    await handler(req, res as any);

    expect((global as any).fetch).toHaveBeenCalledWith(
      'http://localhost:3010/api/community-reporter/my-stories?email=reporter%40example.com',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Accept: 'application/json',
          cookie: 'np_reporter_portal_session=session-cookie',
          authorization: 'Bearer local-session-token',
        }),
      })
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, stories: [] });
  });

  it('falls back to bearer auth when a stale cookie is present locally', async () => {
    const validBearerToken = createSessionToken('reporter@example.com');
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true, items: [] }),
    });

    const req = {
      method: 'GET',
      query: { email: 'Reporter@Example.com' },
      headers: {
        cookie: 'np_reporter_portal_session=stale-cookie-token',
        authorization: `Bearer ${validBearerToken}`,
      },
      cookies: {
        np_reporter_portal_session: 'stale-cookie-token',
      },
    } as any;

    const res = createMockResponse();

    await handler(req, res as any);

    expect((global as any).fetch).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, stories: [] });
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