import type { NextApiRequest, NextApiResponse } from 'next';
import { forwardReporterProxyCookies, getReporterForwardCookieHeader, readReporterProxyBody, resolveReporterAuthProxyUrl } from '../../../lib/reporterAuthProxy';
import { clearSessionCookie, getSessionFromCookie } from '../../../lib/reporterPortalAuth';

function resolveSessionEmail(data: any): string {
  return String(
    data?.session?.email ||
    data?.email ||
    data?.reporter?.email ||
    data?.user?.email ||
    ''
  ).trim().toLowerCase();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const backendUrl = resolveReporterAuthProxyUrl('/api/reporter-auth/session');
  if (backendUrl) {
    try {
      const upstream = await fetch(backendUrl, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...(getReporterForwardCookieHeader(req) ? { cookie: getReporterForwardCookieHeader(req) } : {}),
        },
      });
      const { data, text } = await readReporterProxyBody(upstream);

      if (!upstream.ok) {
        forwardReporterProxyCookies(res, upstream.headers, [clearSessionCookie()]);
        return res.status(401).json({ ok: false, code: 'SESSION_EXPIRED', message: 'SESSION_EXPIRED', backendCode: String(data?.code || data?.message || '').trim() || null });
      }

      const email = resolveSessionEmail(data);
      if (!email) {
        forwardReporterProxyCookies(res, upstream.headers, [clearSessionCookie()]);
        return res.status(401).json({ ok: false, code: 'SESSION_EXPIRED', message: 'SESSION_EXPIRED' });
      }

      forwardReporterProxyCookies(res, upstream.headers);
      return res.status(200).json({
        ok: true,
        session: {
          email,
          expiresAt: typeof data?.session?.expiresAt === 'string' ? data.session.expiresAt : undefined,
        },
      });
    } catch {
      return res.status(503).json({ ok: false, code: 'SESSION_CHECK_FAILED', message: 'SESSION_CHECK_FAILED' });
    }
  }

  const token = String(req.cookies?.np_reporter_portal_session || '').trim();
  const session = getSessionFromCookie(token);
  if (!session) {
    res.setHeader('Set-Cookie', clearSessionCookie());
    return res.status(401).json({ ok: false, code: 'SESSION_EXPIRED', message: 'SESSION_EXPIRED' });
  }

  return res.status(200).json({ ok: true, session: { email: session.email, expiresAt: new Date(session.exp).toISOString() } });
}