import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../../../lib/publicApiBase';
import { normalizePublicViralVideo, normalizePublicViralVideosPayload } from '../../../../lib/publicViralVideos';

function noStore(res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function normalizeOrigin(raw: unknown): string {
  return String(raw || '').trim().replace(/\/+$/, '').replace(/\/api\/?$/, '');
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function appendQuery(url: string, query: URLSearchParams): string {
  const qs = query.toString();
  return qs ? `${url}?${qs}` : url;
}

function readSlug(req: NextApiRequest): string {
  const raw = Array.isArray(req.query.slug) ? req.query.slug[0] : req.query.slug;
  return String(raw || '').trim();
}

function normalizeSinglePayload(raw: unknown) {
  if (isRecord(raw)) {
    const candidate = raw.item || raw.video || (isRecord(raw.data) ? raw.data.item || raw.data.video : null);
    const video = normalizePublicViralVideo(candidate || raw);
    if (video) return video;
  }
  return normalizePublicViralVideo(raw);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  noStore(res);

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, item: null, message: 'METHOD_NOT_ALLOWED' });
  }

  const slug = readSlug(req);
  if (!slug) {
    return res.status(400).json({ ok: false, item: null, message: 'MISSING_SLUG' });
  }

  const origin = normalizeOrigin(getPublicApiBaseUrl());
  if (!origin) {
    return res.status(200).json({ ok: false, item: null, message: 'PUBLIC_API_BASE_NOT_CONFIGURED' });
  }

  const encodedSlug = encodeURIComponent(slug);
  const directCandidates = [
    `${origin}/api/public/viral-videos/${encodedSlug}`,
    `${origin}/admin-api/public/viral-videos/${encodedSlug}`,
  ];

  for (const url of directCandidates) {
    try {
      const upstream = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json', 'Cache-Control': 'no-store', Pragma: 'no-cache' },
        cache: 'no-store',
      });
      const json = await upstream.json().catch(() => null);
      const item = normalizeSinglePayload(json);
      if (upstream.ok && item) return res.status(200).json({ ok: true, item });
    } catch {
      // Try the next known public Viral Videos contract.
    }
  }

  const query = new URLSearchParams();
  query.set('limit', '100');
  const listCandidates = [
    appendQuery(`${origin}/api/public/viral-videos`, query),
    appendQuery(`${origin}/admin-api/public/viral-videos`, query),
    appendQuery(`${origin}/api/public/viral-videos/list`, query),
    appendQuery(`${origin}/admin-api/public/viral-videos/list`, query),
  ];

  for (const url of listCandidates) {
    try {
      const upstream = await fetch(url, {
        method: 'GET',
        headers: { Accept: 'application/json', 'Cache-Control': 'no-store', Pragma: 'no-cache' },
        cache: 'no-store',
      });
      const json = await upstream.json().catch(() => null);
      const normalized = normalizePublicViralVideosPayload(json);
      const item = normalized.items.find((video) => video.slug === slug || video.id === slug);
      if (upstream.ok && item) return res.status(200).json({ ok: true, item });
    } catch {
      // Try the next known public Viral Videos contract.
    }
  }

  return res.status(404).json({ ok: false, item: null, message: 'VIRAL_VIDEO_NOT_FOUND' });
}