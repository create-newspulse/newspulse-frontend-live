jest.mock('../../../../lib/publicApiBase', () => ({
  getPublicApiBaseUrl: () => 'http://localhost:3010',
}));

import handler from '../../../../pages/api/community-reporter/my-stories';

describe('pages/api/community-reporter/my-stories', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn();
  });

  it('forwards browser cookies to the backend stories endpoint', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true, items: [] }),
    });

    const req = {
      method: 'GET',
      query: { email: 'Reporter@Example.com' },
      headers: {
        cookie: 'backend-reporter-session=backend-cookie-value',
      },
      cookies: {},
    } as any;

    const res = createMockResponse();

    await handler(req, res as any);

    expect((global as any).fetch).toHaveBeenCalledWith(
      'http://localhost:3010/api/community-reporter/my-stories?email=reporter%40example.com',
      expect.objectContaining({
        method: 'GET',
        headers: {
          Accept: 'application/json',
          cookie: 'backend-reporter-session=backend-cookie-value',
        },
      })
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true, stories: [] });
  });

  it('passes through upstream 401 auth failures from the backend', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => JSON.stringify({ ok: false, code: 'REPORTER_SESSION_MISSING', message: 'Reporter session missing or expired.' }),
    });

    const req = {
      method: 'GET',
      query: { email: 'Reporter@Example.com' },
      headers: {
        cookie: 'backend-reporter-session=stale-cookie-token',
      },
      cookies: {},
    } as any;

    const res = createMockResponse();

    await handler(req, res as any);

    expect((global as any).fetch).toHaveBeenCalledTimes(1);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ ok: false, code: 'REPORTER_SESSION_MISSING', message: 'Reporter session missing or expired.' });
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