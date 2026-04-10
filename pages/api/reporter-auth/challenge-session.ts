import type { NextApiRequest, NextApiResponse } from 'next';
import { getChallengeFromCookie, getOtpFromCookie, getSessionFromCookie } from '../../../lib/reporterPortalAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED', message: 'METHOD_NOT_ALLOWED' });
  }

  const challengeToken = String(req.cookies?.np_reporter_portal_challenge || '').trim();
  const challengePayload = getChallengeFromCookie(challengeToken);
  if (challengePayload) {
    return res.status(200).json({
      ok: true,
      challenge: {
        email: challengePayload.email,
        expiresAt: new Date(challengePayload.exp).toISOString(),
      },
    });
  }

  const otpToken = String(req.cookies?.np_reporter_portal_otp || '').trim();
  const otpPayload = getOtpFromCookie(otpToken);
  if (otpPayload) {
    return res.status(200).json({
      ok: true,
      challenge: {
        email: otpPayload.email,
        expiresAt: new Date(otpPayload.exp).toISOString(),
        attemptsRemaining: Math.max(0, 5 - otpPayload.attempts),
      },
    });
  }

  const sessionToken = String(req.cookies?.np_reporter_portal_session || '').trim();
  const sessionPayload = getSessionFromCookie(sessionToken);
  if (sessionPayload) {
    return res.status(200).json({
      ok: true,
      challenge: {
        email: sessionPayload.email,
        expiresAt: new Date(sessionPayload.exp).toISOString(),
      },
    });
  }

  return res.status(401).json({ ok: false, code: 'SESSION_EXPIRED', message: 'SESSION_EXPIRED' });
}