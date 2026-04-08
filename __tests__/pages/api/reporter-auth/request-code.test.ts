jest.mock('../../../../lib/publicApiBase', () => ({
  getPublicApiBaseUrl: () => 'http://localhost:3010',
}));

import handler from '../../../../pages/api/reporter-auth/request-code';

describe('pages/api/reporter-auth/request-code', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn();
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
    const cookies = ([] as string[]).concat(res.headers['Set-Cookie'] || []);
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