import type { NextApiRequest, NextApiResponse } from 'next';
import {
  clearOtpCookie,
  createOtpCookie,
  createSessionCookie,
  createSessionToken,
  getOtpAttemptsRemaining,
  getOtpExpiryIso,
  getOtpFromCookie,
  hasOtpAttemptsRemaining,
  hashOtp,
  normalizeReporterAuthEmail,
  updateOtpAttempts,
} from '../../../lib/reporterPortalAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED', message: 'METHOD_NOT_ALLOWED' });
  }

  const email = normalizeReporterAuthEmail(req.body?.email);
  const code = String(req.body?.code || '').trim();
  const otpCookie = String(req.cookies?.np_reporter_portal_otp || '');
  const otpPayload = getOtpFromCookie(otpCookie);

  if (!otpPayload || otpPayload.email !== email) {
    res.setHeader('Set-Cookie', clearOtpCookie());
    return res.status(400).json({ ok: false, code: 'OTP_EXPIRED_OR_MISSING', message: 'OTP_EXPIRED_OR_MISSING' });
  }

  const expectedHash = hashOtp(email, code);
  if (expectedHash !== otpPayload.otpHash) {
    const nextAttempts = otpPayload.attempts + 1;
    if (!hasOtpAttemptsRemaining(nextAttempts)) {
      res.setHeader('Set-Cookie', clearOtpCookie());
      return res.status(400).json({ ok: false, code: 'OTP_INVALID', message: 'OTP_INVALID', attemptsRemaining: 0 });
    }

    const updatedToken = updateOtpAttempts(otpCookie, nextAttempts);
    if (updatedToken) {
      res.setHeader('Set-Cookie', createOtpCookie(updatedToken));
    }
    return res.status(400).json({ ok: false, code: 'OTP_INVALID', message: 'OTP_INVALID', attemptsRemaining: getOtpAttemptsRemaining(nextAttempts), expiresAt: getOtpExpiryIso() });
  }

  const sessionToken = createSessionToken(email);
  res.setHeader('Set-Cookie', [createSessionCookie(sessionToken), clearOtpCookie()]);
  return res.status(200).json({ ok: true, email, sessionToken });
}