import handler from '../../../../pages/api/reporter-auth/challenge-session';
import { createChallengeToken, createOtpToken, createSessionToken } from '../../../../lib/reporterPortalAuth';

describe('pages/api/reporter-auth/challenge-session', () => {
  it('returns the active proxied challenge from the frontend challenge cookie', async () => {
    const req = {
      method: 'GET',
      cookies: {
        np_reporter_portal_challenge: createChallengeToken('reporter@example.com'),
      },
    } as any;

    const res = createMockResponse();
    await handler(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      challenge: {
        email: 'reporter@example.com',
      },
    });
  });

  it('returns the active OTP challenge from the OTP cookie', async () => {
    const req = {
      method: 'GET',
      cookies: {
        np_reporter_portal_otp: createOtpToken('reporter@example.com', '123456'),
      },
    } as any;

    const res = createMockResponse();
    await handler(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      challenge: {
        email: 'reporter@example.com',
        attemptsRemaining: 5,
      },
    });
  });

  it('falls back to the verified reporter session when OTP cookie is absent', async () => {
    const req = {
      method: 'GET',
      cookies: {
        np_reporter_portal_session: createSessionToken('reporter@example.com'),
      },
    } as any;

    const res = createMockResponse();
    await handler(req, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      ok: true,
      challenge: {
        email: 'reporter@example.com',
      },
    });
  });

  it('returns session expired when neither OTP nor verified session is present', async () => {
    const req = {
      method: 'GET',
      cookies: {},
    } as any;

    const res = createMockResponse();
    await handler(req, res as any);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ ok: false, code: 'SESSION_EXPIRED', message: 'SESSION_EXPIRED' });
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