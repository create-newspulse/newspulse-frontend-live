import {
  createMagicLinkToken,
  createSessionCookie,
  createOtpToken,
  createSessionToken,
  clearSessionCookie,
  getMagicLinkFromToken,
  getOtpFromCookie,
  getReporterSessionFromRequest,
  getSessionFromCookie,
  hashOtp,
  verifySignedToken,
} from '../../lib/reporterPortalAuth';

describe('reporterPortalAuth', () => {
  beforeEach(() => {
    process.env.REPORTER_PORTAL_AUTH_SECRET = 'test-reporter-secret';
  });

  it('creates and verifies otp payloads', () => {
    const token = createOtpToken('Reporter@Example.com', '123456');
    const payload = getOtpFromCookie(token);

    expect(payload?.kind).toBe('otp');
    expect(payload?.email).toBe('reporter@example.com');
    expect(payload?.otpHash).toBe(hashOtp('reporter@example.com', '123456'));
  });

  it('creates and verifies session payloads', () => {
    const token = createSessionToken('reporter@example.com');
    const payload = getSessionFromCookie(token);

    expect(payload?.kind).toBe('session');
    expect(payload?.email).toBe('reporter@example.com');
  });

  it('validates reporter session requests through the canonical cookie helper', () => {
    const token = createSessionToken('Reporter@Example.com');
    const valid = getReporterSessionFromRequest({ cookies: { np_reporter_portal_session: token } });
    expect(valid.ok).toBe(true);
    if (valid.ok) expect(valid.session.email).toBe('reporter@example.com');

    expect(getReporterSessionFromRequest({ cookies: {} })).toMatchObject({ ok: false, code: 'REPORTER_SESSION_MISSING', shouldClearCookie: false });
    expect(getReporterSessionFromRequest({ cookies: { np_reporter_portal_session: 'bad-token' } })).toMatchObject({ ok: false, code: 'REPORTER_SESSION_MISSING', shouldClearCookie: true });
  });

  it('creates and verifies magic link payloads', () => {
    const token = createMagicLinkToken('reporter@example.com');
    const payload = getMagicLinkFromToken(token);

    expect(payload?.kind).toBe('magic-link');
    expect(payload?.email).toBe('reporter@example.com');
  });

  it('rejects tampered signed tokens', () => {
    const token = createSessionToken('reporter@example.com');
    const tampered = `${token}tampered`;

    expect(verifySignedToken(tampered)).toBeNull();
  });

  it('serializes the canonical session cookie with environment-safe options', () => {
    const originalNodeEnv = process.env.NODE_ENV;
    const nodeEnvKey = ['NODE', 'ENV'].join('_');
    (process.env as Record<string, string | undefined>)[nodeEnvKey] = 'development';
    const devCookie = createSessionCookie('signed-token');

    expect(devCookie).toContain('np_reporter_portal_session=signed-token');
    expect(devCookie).toContain('Path=/');
    expect(devCookie).toContain('SameSite=Lax');
    expect(devCookie).toContain('HttpOnly');
    expect(devCookie).not.toContain('Domain=');
    expect(devCookie).not.toContain('Secure');

    (process.env as Record<string, string | undefined>)[nodeEnvKey] = 'production';
    const prodCookie = createSessionCookie('signed-token');
    const clearCookie = clearSessionCookie();

    expect(prodCookie).toContain('Secure');
    expect(clearCookie).toContain('Max-Age=0');
    expect(clearCookie).toContain('Path=/');

    (process.env as Record<string, string | undefined>)[nodeEnvKey] = originalNodeEnv;
  });
});