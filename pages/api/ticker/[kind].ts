import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../../lib/publicApiBase';

type Kind = 'breaking' | 'live' | 'national-live';

type JsonRecord = Record<string, unknown>;

function noStore(res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

function toOrigin(base: string): string {
  return String(base || '').trim().replace(/\/+$/, '').replace(/\/api\/?$/, '');
}

async function safeJson(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return { ok: false, message: 'INVALID_JSON_FROM_UPSTREAM', raw: text } satisfies JsonRecord;
  }
}

function isKnownKind(v: string): v is Kind {
  return v === 'breaking' || v === 'live' || v === 'national-live';
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  noStore(res);

  const kindRaw = String((req.query as any)?.kind || '').toLowerCase().trim();
  if (!isKnownKind(kindRaw)) {
    return res.status(400).json({ ok: false, message: 'INVALID_TICKER_KIND' });
  }

  const qLang = String((req.query as any)?.lang || '').toLowerCase().trim();
  const qLimitRaw = String((req.query as any)?.limit || '').trim();
  const qHoursRaw = String((req.query as any)?.hours || '').trim();

  const qs = new URLSearchParams();
  if (qLang === 'en' || qLang === 'hi' || qLang === 'gu') qs.set('lang', qLang);
  if (kindRaw === 'national-live') {
    // Only the national-live contract currently accepts these.
    if (/^\d+$/.test(qLimitRaw)) qs.set('limit', qLimitRaw);
    if (/^\d+$/.test(qHoursRaw)) qs.set('hours', qHoursRaw);
  }
  const query = qs.toString();
  const queryParam = query ? `?${query}` : '';

  const base = getPublicApiBaseUrl();
  const origin = toOrigin(base);

  // Fail open: keep UI alive even if env not configured.
  if (!origin) {
    return res.status(200).json({ ok: true, items: [] });
  }

  // 1) Preferred (requested) backend contract: /api/ticker/:kind
  try {
    const upstream = await fetch(`${origin}/api/ticker/${encodeURIComponent(kindRaw)}${queryParam}`, {
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

    // If endpoint doesn't exist upstream, fall back to the broadcast items endpoint.
    if (upstream.status !== 404) {
      // For non-404 errors, still fall through to broadcast as a best effort.
    }
  } catch {
    // fall back below
  }

  // 2) Fallback backend contract: /api/public/broadcast/items?type=breaking|live
  if (kindRaw === 'national-live') {
    return res.status(200).json({ ok: false, message: 'TICKER_UPSTREAM_UNSUPPORTED', items: [] });
  }

  try {
    const qs = new URLSearchParams();
    qs.set('type', kindRaw);
    if (qLang === 'en' || qLang === 'hi' || qLang === 'gu') qs.set('lang', qLang);

    const upstream = await fetch(`${origin}/api/public/broadcast/items?${qs.toString()}`, {
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

    return res.status(200).json({ ok: false, message: `TICKER_UPSTREAM_FAILED_${upstream.status}`, items: [] });
  } catch (e: any) {
    return res.status(200).json({ ok: false, message: String(e?.message || 'TICKER_UPSTREAM_FAILED'), items: [] });
  }
}
