import type { NextApiRequest, NextApiResponse } from 'next';
import { createMagicLinkToken, createOtpCookie, createOtpToken, generateOtpCode, getOtpExpiryIso, normalizeReporterAuthEmail, sendReporterPortalLoginEmail } from '../../../lib/reporterPortalAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const email = normalizeReporterAuthEmail(req.body?.email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, message: 'VALID_EMAIL_REQUIRED' });
  }

  try {
    const code = generateOtpCode();
    const otpToken = createOtpToken(email, code);
    const magicLinkToken = createMagicLinkToken(email);
    const baseUrl = String(process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_APP_URL || '').trim().replace(/\/+$/, '');
    const loginPath = `/reporter/login?token=${encodeURIComponent(magicLinkToken)}`;
    const magicLink = `${baseUrl || `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`}${loginPath}`;
    const delivery = await sendReporterPortalLoginEmail({ email, code, magicLink });

    res.setHeader('Set-Cookie', createOtpCookie(otpToken));
    return res.status(200).json({
      ok: true,
      email,
      expiresAt: getOtpExpiryIso(),
      debugCode: 'debugCode' in delivery ? delivery.debugCode : undefined,
    });
  } catch (error: any) {
    return res.status(503).json({ ok: false, message: error?.message || 'REPORTER_PORTAL_EMAIL_SEND_FAILED' });
  }
}