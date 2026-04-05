import type { NextApiRequest, NextApiResponse } from 'next';
import { getPublicApiBaseUrl } from '../../../lib/publicApiBase';

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
  const base = String(getPublicApiBaseUrl() || '').trim().replace(/\/+$/, '');
  if (!base) {
    console.error('[api/community-reporter/my-stories] backend base URL not configured');
    return res.status(500).json({ ok: false, message: 'BACKEND_URL_NOT_CONFIGURED' });
  }
  const targetUrl = `${base}/api/community-reporter/my-stories?email=${encodeURIComponent(email)}`;

  try {
    const forwardedCookie = String(req.headers.cookie || '').trim();
    logReporterProxyDebug('proxy request', {
      targetUrl,
      hasCookie: Boolean(forwardedCookie),
      credentialsEnabled: true,
    });
    const upstream = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(forwardedCookie ? { cookie: forwardedCookie } : {}),
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
