jest.mock('../../../../lib/publicApiBase', () => ({
  getPublicApiBaseUrl: () => 'http://localhost:3010',
}));

import handler from '../../../../pages/api/reporter-auth/session';
import { createSessionToken } from '../../../../lib/reporterPortalAuth';

describe('pages/api/reporter-auth/session', () => {
  beforeEach(() => {
    process.env.REPORTER_PORTAL_AUTH_SECRET = 'test-reporter-secret';
  });

  it('falls back to bearer auth when a stale cookie is present', async () => {
    const validBearerToken = createSessionToken('reporter@example.com');
    const req = {
      method: 'GET',
      cookies: {
        np_reporter_portal_session: 'stale-cookie-token',
      },
      headers: {
        authorization: `Bearer ${validBearerToken}`,
      },
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