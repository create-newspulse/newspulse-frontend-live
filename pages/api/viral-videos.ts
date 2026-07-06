import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../lib/publicApiBase';
import { normalizePublicViralVideosPayload } from '../../lib/publicViralVideos';

function noStore(res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function normalizeOrigin(raw: unknown): string {
  return String(raw || '').trim().replace(/\/+$/, '').replace(/\/api\/?$/, '');
}

function appendQuery(url: string, query: URLSearchParams): string {
  const qs = query.toString();
  return qs ? `${url}?${qs}` : url;
}

function readFirst(value: unknown): string {
  return String(Array.isArray(value) ? value[0] : value || '').trim();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  noStore(res);

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, settings: { frontendEnabled: false }, items: [], message: 'METHOD_NOT_ALLOWED' });
  }

  const origin = normalizeOrigin(getPublicApiBaseUrl());
  if (!origin) {
    return res.status(503).json({ ok: false, settings: { frontendEnabled: false }, items: [], message: 'PUBLIC_API_BASE_NOT_CONFIGURED' });
  }

  const query = new URLSearchParams();
  query.set('period', readFirst(req.query.period) || 'all');
  query.set('limit', readFirst(req.query.limit) || '500');

  const lang = readFirst(req.query.lang || req.query.language).toLowerCase();
  if (lang) {
    query.set('lang', lang);
    query.set('language', lang);
  }

  const candidates = [
    appendQuery(`${origin}/api/viral-videos`, query),
    appendQuery(`${origin}/admin-api/viral-videos`, query),
    appendQuery(`${origin}/api/public/viral-videos`, query),
    appendQuery(`${origin}/admin-api/public/viral-videos`, query),
    appendQuery(`${origin}/api/public/viral-videos/list`, query),
    appendQuery(`${origin}/admin-api/public/viral-videos/list`, query),
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
      const json = await upstream.json().catch(() => null);
      const normalized = normalizePublicViralVideosPayload(json);
      if (upstream.ok && normalized.ok) {
        return res.status(200).json({
          ...normalized,
          meta: {
            nextCursor: '',
            hasMore: false,
          },
        });
      }
    } catch {
      // Try the next known Viral Videos contract.
    }
  }

  return res.status(502).json({ ok: false, settings: { frontendEnabled: false }, items: [], message: 'VIRAL_VIDEOS_UNAVAILABLE' });
}
