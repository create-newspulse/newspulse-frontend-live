import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../../../lib/publicApiBase';

function noStore(res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function toOrigin(base: string): string {
  return String(base || '').trim().replace(/\/+$/, '').replace(/\/api\/?$/, '');
}

async function safeJson(res: Response): Promise<any | null> {
  const text = await res.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  noStore(res);

  const base = getPublicApiBaseUrl();
  const origin = toOrigin(base);
  if (!origin) {
    return res.status(200).json({
      ok: true,
      settings: {
        breaking: { enabled: true, mode: 'AUTO', speedSec: 18 },
        live: { enabled: true, mode: 'AUTO', speedSec: 24 },
      },
    });
  }

  try {
    const upstream = await fetch(`${origin}/api/public/broadcast/settings`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        cookie: String(req.headers.cookie || ''),
        authorization: String(req.headers.authorization || ''),
      },
    });

    const json = await safeJson(upstream);
    if (!upstream.ok || !json) return res.status(200).json({ ok: true, settings: {} });
    return res.status(200).json(json);
  } catch {
    return res.status(200).json({ ok: true, settings: {} });
  }
}
