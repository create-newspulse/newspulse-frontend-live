import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../../../lib/publicApiBase';

function noStore(res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function normalizeOrigin(base: string): string {
  return String(base || '').trim().replace(/\/+$/, '').replace(/\/api\/?$/, '');
}

async function safeJson(res: Response): Promise<unknown | null> {
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

  const origin = normalizeOrigin(getPublicApiBaseUrl());
  if (!origin) {
    return res.status(503).json({ ok: false, items: [], message: 'PUBLIC_API_BASE_NOT_CONFIGURED' });
  }

  const candidates = [
    `${origin}/api/live-tv/schedule/upcoming`,
    `${origin}/admin-api/public/live-tv/schedule/upcoming`,
    `${origin}/api/public/live-tv/schedule/upcoming`,
    `${origin}/api/live-tv/upcoming`,
    `${origin}/api/public/live-tv/upcoming`,
  ];

  for (const url of candidates) {
    try {
      const upstream = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'Cache-Control': 'no-store',
          Pragma: 'no-cache',
        },
        cache: 'no-store',
      });

      const json = await safeJson(upstream);
      if (upstream.ok && json) return res.status(200).json(json);
    } catch {
      // Try the next known Live TV schedule contract.
    }
  }

  return res.status(502).json({ ok: false, items: [], message: 'LIVE_TV_UPCOMING_SCHEDULE_UNAVAILABLE' });
}