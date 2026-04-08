jest.mock('../../../../lib/publicApiBase', () => ({
  getPublicApiBaseUrl: () => 'http://localhost:3010',
}));

import handler from '../../../../pages/api/reporter-auth/logout';

describe('pages/api/reporter-auth/logout', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn();
  });

  it('returns 200 and clears local auth cookies even when upstream logout fails', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      headers: new Headers(),
    });

    const req = {
      method: 'POST',
      headers: {},
      cookies: {},
    } as any;

    const res = createMockResponse();
    await handler(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    const cookies = ([] as string[]).concat(res.headers['Set-Cookie'] || []);
    expect(cookies.some((value) => value.includes('np_reporter_portal_session='))).toBe(true);
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