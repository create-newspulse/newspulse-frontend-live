import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../../../lib/publicApiBase';

type JsonRecord = Record<string, unknown>;

function noStore(res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function normalizeOrigin(raw: unknown): string {
  return String(raw || '').trim().replace(/\/+$/, '').replace(/\/api\/?$/, '');
}

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function fallbackPayload(message?: string) {
  return {
    ok: true,
    item: null,
    video: null,
    selectionMode: 'manual',
    settings: { frontendEnabled: false },
    ...(message ? { message } : {}),
  };
}

function normalizeVideo(value: unknown) {
  if (!isRecord(value)) return value;
  return {
    ...value,
    homepageFeatured: value.homepageFeatured === true || value.featured === true,
  };
}

function normalizePayload(payload: JsonRecord): JsonRecord {
  const item = normalizeVideo(payload.item || payload.video || null);
  const data = isRecord(payload.data) ? {
    ...payload.data,
    item: normalizeVideo(payload.data.item || payload.data.video || null),
    video: normalizeVideo(payload.data.video || payload.data.item || null),
  } : payload.data;

  return {
    ...payload,
    item,
    video: normalizeVideo(payload.video || payload.item || null),
    data,
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  noStore(res);

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const origin = normalizeOrigin(getPublicApiBaseUrl());
  if (!origin) {
    return res.status(200).json(fallbackPayload('PUBLIC_API_BASE_NOT_CONFIGURED'));
  }

  const query = new URLSearchParams();
  const language = Array.isArray(req.query.language) ? req.query.language[0] : req.query.language;
  const lang = Array.isArray(req.query.lang) ? req.query.lang[0] : req.query.lang;
  const effectiveLang = String(language || lang || '').trim().toLowerCase();
  if (effectiveLang) query.set('language', effectiveLang);

  const suffix = query.toString() ? `?${query.toString()}` : '';
  const candidates = [
    `${origin}/api/public/viral-videos/featured${suffix}`,
    `${origin}/admin-api/public/viral-videos/featured${suffix}`,
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
      if (upstream.ok && isRecord(json)) {
        return res.status(200).json(normalizePayload(json));
      }
    } catch {
      // Try the next known public Viral Videos contract.
    }
  }

  return res.status(200).json(fallbackPayload('VIRAL_VIDEOS_FEATURED_UNAVAILABLE'));
}
