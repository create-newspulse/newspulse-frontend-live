import type { NextApiRequest, NextApiResponse } from 'next';
import { getPublicApiBaseUrl } from '../../../lib/publicApiBase';
import { getSessionFromCookie } from '../../../lib/reporterPortalAuth';

function shouldLogReporterProxyDebug(): boolean {
  const isJest = Boolean((globalThis as any)?.jest) || (typeof process !== 'undefined' && Boolean((process.env as any)?.JEST_WORKER_ID));
  return process.env.NODE_ENV === 'development' && !isJest;
}

function logReporterProxyDebug(event: string, details: Record<string, unknown>) {
  if (!shouldLogReporterProxyDebug()) {
    return;
  }
  // eslint-disable-next-line no-console
  console.info(`[api/community-reporter/my-stories] ${event}`, details);
}

function resolveReporterSessionEmail(req: NextApiRequest): string {
  const cookieToken = String(req.cookies?.np_reporter_portal_session || '').trim();
  const authorization = String(req.headers.authorization || '').trim();
  const bearerToken = authorization.toLowerCase().startsWith('bearer ') ? authorization.slice(7).trim() : '';
  const session = getSessionFromCookie(cookieToken) || getSessionFromCookie(bearerToken);
  return String(session?.email || '').trim().toLowerCase();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const emailRaw = String(req.query.email ?? '').trim();
  if (!emailRaw) {
    return res.status(400).json({ ok: false, message: 'email is required' });
  }

  const email = emailRaw.toLowerCase();
  const reporterSessionEmail = resolveReporterSessionEmail(req);
  if (reporterSessionEmail && reporterSessionEmail !== email) {
    return res.status(403).json({ ok: false, code: 'REPORTER_EMAIL_MISMATCH', message: 'REPORTER_EMAIL_MISMATCH' });
  }
  const base = String(getPublicApiBaseUrl() || '').trim().replace(/\/+$/, '');
  if (!base) {
    console.error('[api/community-reporter/my-stories] backend base URL not configured');
    return res.status(500).json({ ok: false, message: 'BACKEND_URL_NOT_CONFIGURED' });
  }
  const targetUrl = `${base}/api/community-reporter/my-stories?email=${encodeURIComponent(email)}`;
  const forwardedCookie = String(req.headers.cookie || '');
  const forwardedAuthorization = String(req.headers.authorization || '');

  try {
    logReporterProxyDebug('proxy request', {
      targetUrl,
      hasCookie: Boolean(forwardedCookie),
      hasAuthorization: Boolean(forwardedAuthorization),
    });
    const upstream = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        cookie: forwardedCookie,
        authorization: forwardedAuthorization,
      },
    });

    const text = await upstream.text().catch(() => '');
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch {}
    logReporterProxyDebug('proxy response', {
      targetUrl,
      status: upstream.status || 500,
      responseCode: String(json?.code || '').trim() || null,
      responseMessage: String(json?.message || '').trim() || null,
    });

    if (!upstream.ok) {
      console.error('[api/community-reporter/my-stories] upstream error', upstream.status, text);
      return res.status(upstream.status || 500).json(json || { ok: false, message: 'UPSTREAM_ERROR' });
    }

    try {
      const raw = json ?? (text ? JSON.parse(text) : {});
      const stories = Array.isArray((raw as any).stories)
        ? (raw as any).stories
        : Array.isArray((raw as any).items)
        ? (raw as any).items
        : Array.isArray((raw as any).data?.stories)
        ? (raw as any).data.stories
        : [];
      return res.status(200).json({ ok: true, stories });
    } catch (parseErr) {
      console.error('[api/community-reporter/my-stories] parse error', parseErr);
      return res.status(500).json({ ok: false, message: 'PROXY_PARSE_ERROR' });
    }
  } catch (err) {
    console.error('[api/community-reporter/my-stories] exception', err);
    return res.status(500).json({ ok: false, message: 'PROXY_ERROR' });
  }
}
