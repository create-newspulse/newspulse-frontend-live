import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../../lib/publicApiBase';

type BroadcastType = 'breaking' | 'live';

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

async function fetchItems(origin: string, type: BroadcastType, req: NextApiRequest): Promise<any[]> {
  const lang = String((req.query as any)?.lang || '').toLowerCase().trim();
  const langParam = lang === 'en' || lang === 'hi' || lang === 'gu' ? `&lang=${encodeURIComponent(lang)}` : '';
  const upstream = await fetch(`${origin}/api/public/broadcast/items?type=${encodeURIComponent(type)}${langParam}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      cookie: String(req.headers.cookie || ''),
      authorization: String(req.headers.authorization || ''),
    },
  });
  const json = await safeJson(upstream);
  if (!upstream.ok || !json) return [];
  if (Array.isArray(json)) return json;
  if (Array.isArray(json.items)) return json.items;
  if (Array.isArray(json.data)) return json.data;
  return [];
}

async function fetchSettings(origin: string, req: NextApiRequest): Promise<any | null> {
  const upstream = await fetch(`${origin}/api/public/broadcast/settings`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      cookie: String(req.headers.cookie || ''),
      authorization: String(req.headers.authorization || ''),
    },
  });
  const json = await safeJson(upstream);
  if (!upstream.ok || !json) return null;
  return json;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  noStore(res);

  const base = getPublicApiBaseUrl();
  const origin = toOrigin(base);

  const qLang = String((req.query as any)?.lang || '').toLowerCase().trim();
  const langParam = qLang === 'en' || qLang === 'hi' || qLang === 'gu' ? `?lang=${encodeURIComponent(qLang)}` : '';

  // Fail open: keep UI alive even if env not configured.
  if (!origin) {
    return res.status(200).json({ ok: true, settings: { breaking: { enabled: true, mode: 'AUTO', speedSec: 18 }, live: { enabled: true, mode: 'AUTO', speedSec: 24 } }, items: { breaking: [], live: [] } });
  }

  // Preferred: single backend call.
  try {
    const upstream = await fetch(`${origin}/api/public/broadcast${langParam}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        cookie: String(req.headers.cookie || ''),
        authorization: String(req.headers.authorization || ''),
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
    });

    const json = await safeJson(upstream);
    if (upstream.ok && json) {
      return res.status(200).json(json);
    }
  } catch {
    // fall back below
  }

  // Fallback: fetch items/settings separately.
  try {
    const [breaking, live, settings] = await Promise.all([
      fetchItems(origin, 'breaking', req),
      fetchItems(origin, 'live', req),
      fetchSettings(origin, req),
    ]);

    return res.status(200).json({
      ok: true,
      settings: settings?.settings ?? settings,
      items: { breaking, live },
    });
  } catch {
    return res.status(200).json({ ok: true, settings: { breaking: { enabled: true, mode: 'AUTO', speedSec: 18 }, live: { enabled: true, mode: 'AUTO', speedSec: 24 } }, items: { breaking: [], live: [] } });
  }
}
