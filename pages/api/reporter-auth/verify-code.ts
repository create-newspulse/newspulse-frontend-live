import type { NextApiRequest, NextApiResponse } from 'next';
import { forwardReporterProxyCookies, getReporterForwardCookieHeader, readReporterProxyBody, resolveReporterAuthProxyUrl } from '../../../lib/reporterAuthProxy';
import {
  clearChallengeCookie,
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

function isSessionExpiredVerifyFailure(code: string | null, status: number, data: any): boolean {
  if (status === 401) {
    return true;
  }
  if (code === 'SESSION_EXPIRED' || code === 'REPORTER_SESSION_MISSING' || code === 'REPORTER_VERIFY_SESSION_MISSING') {
    return true;
  }
  return status >= 500 && /SESSION|REPORTER_SESSION_MISSING|REPORTER_VERIFY_SESSION_MISSING/i.test(String(code || data?.message || ''));
}

function normalizeVerifyProxyFailure(status: number, code: string | null, data: any, text: string) {
  if (isSessionExpiredVerifyFailure(code, status, data)) {
    return {
      status: 401,
      body: { ok: false, code: 'SESSION_EXPIRED', message: 'SESSION_EXPIRED', backendCode: code },
    };
  }

  if (status >= 500) {
    return {
      status: 503,
      body: {
        ok: false,
        code: 'REPORTER_VERIFY_CODE_FAILED',
        message: 'REPORTER_VERIFY_CODE_FAILED',
        backendCode: code,
        backendMessage: text || null,
      },
    };
  }

  return {
    status,
    body: data || { ok: false, code: code || 'REPORTER_VERIFY_CODE_FAILED', message: text || 'REPORTER_VERIFY_CODE_FAILED' },
  };
}

function shouldClearChallenge(code: string | null, status: number, data: any): boolean {
  if (isSessionExpiredVerifyFailure(code, status, data)) {
    return true;
  }
  if (typeof data?.attemptsRemaining === 'number' && data.attemptsRemaining <= 0) {
    return true;
  }
  return code === 'SESSION_EXPIRED'
    || code === 'REPORTER_SESSION_MISSING'
    || code === 'REPORTER_VERIFY_SESSION_MISSING'
    || code === 'OTP_EXPIRED_OR_MISSING'
    || code === 'REPORTER_OTP_EXPIRED'
    || code === 'REPORTER_OTP_MISSING';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED', message: 'METHOD_NOT_ALLOWED' });
  }

  const email = normalizeReporterAuthEmail(req.body?.email);
  const code = String(req.body?.code || '').trim();
  const backendUrl = resolveReporterAuthProxyUrl('/api/reporter-auth/verify-code');

  if (backendUrl) {
    try {
      const upstream = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(getReporterForwardCookieHeader(req) ? { cookie: getReporterForwardCookieHeader(req) } : {}),
        },
        body: JSON.stringify({ email, code }),
      });
      const { data, text } = await readReporterProxyBody(upstream);
      const responseCode = String(data?.code || data?.message || '').trim() || null;

      if (!upstream.ok) {
        forwardReporterProxyCookies(res, upstream.headers, shouldClearChallenge(responseCode, upstream.status || 500, data) ? [clearChallengeCookie()] : []);
        const normalizedFailure = normalizeVerifyProxyFailure(upstream.status || 500, responseCode, data, text);
        return res.status(normalizedFailure.status).json(normalizedFailure.body);
      }

      forwardReporterProxyCookies(res, upstream.headers, [clearChallengeCookie()]);

      return res.status(200).json({ ...(data || {}), ok: data?.ok !== false, email: data?.email || email });
    } catch {
      return res.status(503).json({ ok: false, code: 'REPORTER_VERIFY_CODE_FAILED', message: 'REPORTER_VERIFY_CODE_FAILED' });
    }
  }

  const otpCookie = String(req.cookies?.np_reporter_portal_otp || '');
  const otpPayload = getOtpFromCookie(otpCookie);

  if (!otpPayload || otpPayload.email !== email) {
    res.setHeader('Set-Cookie', [clearOtpCookie(), clearChallengeCookie()]);
    return res.status(400).json({ ok: false, code: 'OTP_EXPIRED_OR_MISSING', message: 'OTP_EXPIRED_OR_MISSING' });
  }

  const expectedHash = hashOtp(email, code);
  if (expectedHash !== otpPayload.otpHash) {
    const nextAttempts = otpPayload.attempts + 1;
    if (!hasOtpAttemptsRemaining(nextAttempts)) {
      res.setHeader('Set-Cookie', [clearOtpCookie(), clearChallengeCookie()]);
      return res.status(400).json({ ok: false, code: 'OTP_INVALID', message: 'OTP_INVALID', attemptsRemaining: 0 });
    }

    const updatedToken = updateOtpAttempts(otpCookie, nextAttempts);
    if (updatedToken) {
      res.setHeader('Set-Cookie', createOtpCookie(updatedToken));
    }
    return res.status(400).json({ ok: false, code: 'OTP_INVALID', message: 'OTP_INVALID', attemptsRemaining: getOtpAttemptsRemaining(nextAttempts), expiresAt: getOtpExpiryIso() });
  }

  const sessionToken = createSessionToken(email);
  res.setHeader('Set-Cookie', [createSessionCookie(sessionToken), clearOtpCookie(), clearChallengeCookie()]);
  return res.status(200).json({ ok: true, email, sessionToken });
}