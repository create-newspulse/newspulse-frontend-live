import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../../../lib/publicApiBase';
import { normalizePublicViralVideosPayload } from '../../../../lib/publicViralVideos';

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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  noStore(res);

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, settings: { frontendEnabled: false }, items: [], message: 'METHOD_NOT_ALLOWED' });
  }

  const origin = normalizeOrigin(getPublicApiBaseUrl());
  if (!origin) {
    return res.status(200).json({ ok: false, settings: { frontendEnabled: false }, items: [], message: 'PUBLIC_API_BASE_NOT_CONFIGURED' });
  }

  const upstreamQuery = new URLSearchParams();
  const language = Array.isArray(req.query.language) ? req.query.language[0] : req.query.language;
  const lang = Array.isArray(req.query.lang) ? req.query.lang[0] : req.query.lang;
  const homepage = Array.isArray(req.query.homepage) ? req.query.homepage[0] : req.query.homepage;
  const limit = Array.isArray(req.query.limit) ? req.query.limit[0] : req.query.limit;
  const effectiveLang = String(language || lang || '').trim().toLowerCase();
  if (effectiveLang) {
    upstreamQuery.set(lang ? 'lang' : 'language', effectiveLang);
    upstreamQuery.set(lang ? 'language' : 'lang', effectiveLang);
  }
  if (limit) upstreamQuery.set('limit', String(limit));

  const candidates = [
    appendQuery(`${origin}/api/public/viral-videos`, upstreamQuery),
    appendQuery(`${origin}/admin-api/public/viral-videos`, upstreamQuery),
    appendQuery(`${origin}/api/public/viral-videos/list`, upstreamQuery),
    appendQuery(`${origin}/admin-api/public/viral-videos/list`, upstreamQuery),
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
        const homepageOnly = String(homepage || '').trim() === '1' || String(homepage || '').toLowerCase() === 'true';
        const max = Math.max(0, Math.floor(Number(limit || 0)) || 0);
        const items = (homepageOnly ? normalized.items.filter((item) => item.showOnHomepage) : normalized.items).slice(0, max || undefined);
        return res.status(200).json({ ...normalized, items });
      }
    } catch {
      // Try the next known public Viral Videos contract.
    }
  }

  return res.status(200).json({ ok: false, settings: { frontendEnabled: false }, items: [], message: 'VIRAL_VIDEOS_UNAVAILABLE' });
}
