import type { NextApiRequest, NextApiResponse } from 'next';
import { forwardReporterProxyCookies, getReporterForwardCookieHeader, resolveReporterAuthProxyUrl } from '../../../lib/reporterAuthProxy';
import { clearChallengeCookie, clearOtpCookie, clearSessionCookie } from '../../../lib/reporterPortalAuth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const backendUrl = resolveReporterAuthProxyUrl('/api/reporter-auth/logout', req);
  if (backendUrl) {
    try {
      const upstream = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          ...(getReporterForwardCookieHeader(req) ? { cookie: getReporterForwardCookieHeader(req) } : {}),
        },
      });
      forwardReporterProxyCookies(res, upstream.headers, [clearSessionCookie(), clearOtpCookie(), clearChallengeCookie()]);
      return res.status(200).json({ ok: true });
    } catch {}
  }

  res.setHeader('Set-Cookie', [clearSessionCookie(), clearOtpCookie(), clearChallengeCookie()]);
  return res.status(200).json({ ok: true });
}