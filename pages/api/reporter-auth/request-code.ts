import type { NextApiRequest, NextApiResponse } from 'next';
import {
  createMagicLinkToken,
  createOtpCookie,
  createOtpToken,
  generateOtpCode,
  getOtpExpiryIso,
  maskReporterEmail,
  normalizeReporterAuthEmail,
  resolveReporterPortalFromEmail,
  resolveReporterPortalResendKey,
  sendReporterPortalLoginEmail,
} from '../../../lib/reporterPortalAuth';

function authRouteLog(event: string, details?: Record<string, unknown>) {
  console.info(`[reporter-auth/request-code] ${event}`, details || {});
}

function authRouteError(event: string, details?: Record<string, unknown>) {
  console.error(`[reporter-auth/request-code] ${event}`, details || {});
}

function resolveSiteUrl(req: NextApiRequest): string {
  const raw = String(
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    ''
  ).trim().replace(/\/+$/, '');

  if (raw) {
    if (/^https?:\/\//i.test(raw)) return raw;
    return `https://${raw}`;
  }

  const forwardedProto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  const forwardedHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return `${forwardedProto}://${forwardedHost}`.replace(/\/+$/, '');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  authRouteLog('request received', {
    method: req.method,
    host: req.headers.host || '',
    forwardedHost: req.headers['x-forwarded-host'] || '',
    forwardedProto: req.headers['x-forwarded-proto'] || '',
    nodeEnv: process.env.NODE_ENV || '',
    vercelEnv: process.env.VERCEL_ENV || '',
  });

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const email = normalizeReporterAuthEmail(req.body?.email);
  authRouteLog('email normalized', { email: maskReporterEmail(email) });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, message: 'VALID_EMAIL_REQUIRED' });
  }

  try {
    const code = generateOtpCode();
    authRouteLog('otp generated', { email: maskReporterEmail(email), codeLength: code.length });
    const otpToken = createOtpToken(email, code);
    const magicLinkToken = createMagicLinkToken(email);
    const baseUrl = resolveSiteUrl(req);
    const loginPath = `/reporter/login?token=${encodeURIComponent(magicLinkToken)}`;
    const magicLink = `${baseUrl}${loginPath}`;
    authRouteLog('mail transport initialized', {
      provider: 'resend',
      hasResendKey: Boolean(resolveReporterPortalResendKey()),
      hasFromEmail: Boolean(resolveReporterPortalFromEmail()),
      siteUrl: baseUrl,
      sendsViaBackend: false,
    });
    const delivery = await sendReporterPortalLoginEmail({ email, code, magicLink });
    authRouteLog('mail send completed', {
      email: maskReporterEmail(email),
      delivered: Boolean(delivery && 'delivered' in delivery && delivery.delivered),
      usedDebugCode: Boolean(delivery && 'debugCode' in delivery),
    });

    try {
      res.setHeader('Set-Cookie', createOtpCookie(otpToken));
      authRouteLog('otp cookie write success', { email: maskReporterEmail(email) });
    } catch (cookieError: any) {
      authRouteError('otp cookie write failure', {
        email: maskReporterEmail(email),
        error: cookieError?.message || 'COOKIE_WRITE_FAILED',
      });
      throw cookieError;
    }

    return res.status(200).json({
      ok: true,
      email,
      expiresAt: getOtpExpiryIso(),
      debugCode: 'debugCode' in delivery ? delivery.debugCode : undefined,
    });
  } catch (error: any) {
    authRouteError('request failed', {
      email: maskReporterEmail(email),
      error: error?.message || 'REPORTER_PORTAL_EMAIL_SEND_FAILED',
      hasAuthSecret: Boolean(process.env.REPORTER_PORTAL_AUTH_SECRET || process.env.NEXTAUTH_SECRET),
      hasResendKey: Boolean(resolveReporterPortalResendKey()),
      hasFromEmail: Boolean(resolveReporterPortalFromEmail()),
      siteUrl: resolveSiteUrl(req),
      sendsViaBackend: false,
    });
    return res.status(503).json({ ok: false, message: 'REPORTER_PORTAL_EMAIL_SEND_FAILED' });
  }
}