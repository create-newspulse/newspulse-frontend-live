import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../../../lib/publicApiBase';

function normalizeLoopbackBase(base: string): string {
  return String(base || '').replace(/^http:\/\/localhost(?=[:/]|$)/i, 'http://127.0.0.1');
}

function normalizeOrigin(base: string): string {
  return String(base || '').trim().replace(/\/+$/, '').replace(/\/api\/?$/, '');
}

export default async function publicPushDiagnosticsHandler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'Method Not Allowed' });
  }

  const origin = normalizeLoopbackBase(normalizeOrigin(getPublicApiBaseUrl()));
  if (!origin) {
    return res.status(500).json({ ok: false, message: 'Backend URL not configured' });
  }

  try {
    const upstream = await fetch(`${origin}/api/public/push/diagnostics`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const text = await upstream.text().catch(() => '');
    const json = text
      ? (() => {
          try {
            return JSON.parse(text);
          } catch {
            return null;
          }
        })()
      : null;

    return res.status(upstream.status || 200).json(json || { ok: upstream.ok, message: text || 'Push diagnostics unavailable' });
  } catch {
    return res.status(502).json({ ok: false, message: 'Push diagnostics endpoint unreachable' });
  }
}