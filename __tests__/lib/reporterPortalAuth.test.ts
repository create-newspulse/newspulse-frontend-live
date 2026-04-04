import {
  createMagicLinkToken,
  createOtpToken,
  createSessionToken,
  getMagicLinkFromToken,
  getOtpFromCookie,
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
});