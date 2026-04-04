import crypto from 'crypto';

export const REPORTER_SESSION_COOKIE = 'np_reporter_portal_session';
export const REPORTER_OTP_COOKIE = 'np_reporter_portal_otp';
const OTP_TTL_SECONDS = 10 * 60;
const SESSION_TTL_SECONDS = 12 * 60 * 60;
const MAX_OTP_ATTEMPTS = 5;

type SignedPayload = Record<string, unknown> & {
  kind: 'otp' | 'session' | 'magic-link';
  email: string;
  exp: number;
};

export type ReporterOtpPayload = SignedPayload & {
  kind: 'otp';
  otpHash: string;
  attempts: number;
};

export type ReporterSessionPayload = SignedPayload & {
  kind: 'session';
};

export type ReporterMagicLinkPayload = SignedPayload & {
  kind: 'magic-link';
};

function base64urlEncode(input: string | Buffer): string {
  return Buffer.from(input).toString('base64url');
}

function base64urlDecode(input: string): string {
  return Buffer.from(input, 'base64url').toString('utf8');
}

export function normalizeReporterAuthEmail(email: string | null | undefined): string {
  return String(email || '').trim().toLowerCase();
}

function getAuthSecret(): string {
  const secret = String(
    process.env.REPORTER_PORTAL_AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    ''
  ).trim();

  if (secret) return secret;
  if (process.env.NODE_ENV !== 'production') return 'dev-reporter-portal-auth-secret';

  throw new Error('REPORTER_PORTAL_AUTH_SECRET is required in production');
}

function signValue(value: string): string {
  return crypto.createHmac('sha256', getAuthSecret()).update(value).digest('base64url');
}

function constantTimeEquals(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

export function createSignedToken<T extends SignedPayload>(payload: T): string {
  const encodedPayload = base64urlEncode(JSON.stringify(payload));
  const signature = signValue(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

export function verifySignedToken<T extends SignedPayload>(token: string | null | undefined): T | null {
  const raw = String(token || '').trim();
  if (!raw || !raw.includes('.')) return null;
  const [encodedPayload, signature] = raw.split('.');
  if (!encodedPayload || !signature) return null;
  const expected = signValue(encodedPayload);
  if (!constantTimeEquals(signature, expected)) return null;

  try {
    const parsed = JSON.parse(base64urlDecode(encodedPayload));
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.email !== 'string' || typeof parsed.exp !== 'number' || typeof parsed.kind !== 'string') return null;
    return parsed as T;
  } catch {
    return null;
  }
}

export function isExpired(exp: number): boolean {
  return !Number.isFinite(exp) || Date.now() >= exp;
}

export function generateOtpCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export function hashOtp(email: string, code: string): string {
  return crypto
    .createHash('sha256')
    .update(`${getAuthSecret()}:${normalizeReporterAuthEmail(email)}:${String(code || '').trim()}`)
    .digest('hex');
}

export function createOtpToken(email: string, code: string): string {
  const normalizedEmail = normalizeReporterAuthEmail(email);
  const payload: ReporterOtpPayload = {
    kind: 'otp',
    email: normalizedEmail,
    exp: Date.now() + OTP_TTL_SECONDS * 1000,
    otpHash: hashOtp(normalizedEmail, code),
    attempts: 0,
  };
  return createSignedToken(payload);
}

export function createMagicLinkToken(email: string): string {
  const normalizedEmail = normalizeReporterAuthEmail(email);
  const payload: ReporterMagicLinkPayload = {
    kind: 'magic-link',
    email: normalizedEmail,
    exp: Date.now() + OTP_TTL_SECONDS * 1000,
  };
  return createSignedToken(payload);
}

export function createSessionToken(email: string): string {
  const normalizedEmail = normalizeReporterAuthEmail(email);
  const payload: ReporterSessionPayload = {
    kind: 'session',
    email: normalizedEmail,
    exp: Date.now() + SESSION_TTL_SECONDS * 1000,
  };
  return createSignedToken(payload);
}

export function getOtpExpiryIso(): string {
  return new Date(Date.now() + OTP_TTL_SECONDS * 1000).toISOString();
}

export function getSessionExpiryIso(): string {
  return new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
}

export function updateOtpAttempts(token: string, nextAttempts: number): string | null {
  const payload = verifySignedToken<ReporterOtpPayload>(token);
  if (!payload || payload.kind !== 'otp') return null;
  return createSignedToken<ReporterOtpPayload>({
    ...payload,
    attempts: nextAttempts,
  });
}

function serializeCookie(name: string, value: string, options: { maxAge?: number; httpOnly?: boolean } = {}): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'SameSite=Lax'];
  if (options.maxAge != null) parts.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge))}`);
  if (options.httpOnly !== false) parts.push('HttpOnly');
  if (process.env.NODE_ENV === 'production') parts.push('Secure');
  return parts.join('; ');
}

export function createOtpCookie(token: string): string {
  return serializeCookie(REPORTER_OTP_COOKIE, token, { maxAge: OTP_TTL_SECONDS, httpOnly: true });
}

export function createSessionCookie(token: string): string {
  return serializeCookie(REPORTER_SESSION_COOKIE, token, { maxAge: SESSION_TTL_SECONDS, httpOnly: true });
}

export function clearOtpCookie(): string {
  return serializeCookie(REPORTER_OTP_COOKIE, '', { maxAge: 0, httpOnly: true });
}

export function clearSessionCookie(): string {
  return serializeCookie(REPORTER_SESSION_COOKIE, '', { maxAge: 0, httpOnly: true });
}

export function getSessionFromCookie(cookieValue: string | null | undefined): ReporterSessionPayload | null {
  const payload = verifySignedToken<ReporterSessionPayload>(cookieValue);
  if (!payload || payload.kind !== 'session' || isExpired(payload.exp)) return null;
  return payload;
}

export function getOtpFromCookie(cookieValue: string | null | undefined): ReporterOtpPayload | null {
  const payload = verifySignedToken<ReporterOtpPayload>(cookieValue);
  if (!payload || payload.kind !== 'otp' || isExpired(payload.exp)) return null;
  return payload;
}

export function getMagicLinkFromToken(token: string | null | undefined): ReporterMagicLinkPayload | null {
  const payload = verifySignedToken<ReporterMagicLinkPayload>(token);
  if (!payload || payload.kind !== 'magic-link' || isExpired(payload.exp)) return null;
  return payload;
}

export function isOtpDeliveryConfigured(): boolean {
  return Boolean(String(process.env.RESEND_API_KEY || '').trim() && String(process.env.REPORTER_PORTAL_FROM_EMAIL || '').trim());
}

export async function sendReporterPortalLoginEmail(input: { email: string; code: string; magicLink: string }) {
  const to = normalizeReporterAuthEmail(input.email);
  const resendKey = String(process.env.RESEND_API_KEY || '').trim();
  const from = String(process.env.REPORTER_PORTAL_FROM_EMAIL || '').trim();

  if (!resendKey || !from) {
    if (process.env.NODE_ENV !== 'production') {
      return { delivered: false, debugCode: input.code } as const;
    }
    throw new Error('REPORTER_PORTAL_EMAIL_NOT_CONFIGURED');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Your News Pulse Reporter Portal verification',
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111827;max-width:560px;margin:0 auto;">
          <h2 style="margin-bottom:12px;">Reporter Portal verification</h2>
          <p>Use this one-time code to finish signing in to your News Pulse Reporter Portal:</p>
          <div style="margin:20px 0;padding:16px 20px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;font-size:28px;font-weight:700;letter-spacing:0.22em;text-align:center;">${input.code}</div>
          <p>The code expires in 10 minutes.</p>
          <p>You can also sign in using this secure link:</p>
          <p><a href="${input.magicLink}" style="display:inline-block;padding:12px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:999px;font-weight:600;">Open Reporter Portal</a></p>
          <p style="font-size:12px;color:#6b7280;">If you did not request this email, you can ignore it.</p>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(text || 'REPORTER_PORTAL_EMAIL_SEND_FAILED');
  }

  return { delivered: true } as const;
}

export function getOtpAttemptsRemaining(attempts: number): number {
  return Math.max(0, MAX_OTP_ATTEMPTS - attempts);
}

export function hasOtpAttemptsRemaining(attempts: number): boolean {
  return attempts < MAX_OTP_ATTEMPTS;
}