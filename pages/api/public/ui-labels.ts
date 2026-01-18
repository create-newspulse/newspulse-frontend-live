import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../../lib/publicApiBase';

function toOrigin(base: string): string {
  const trimmed = String(base || '').trim();
  if (!trimmed) return '';
  return trimmed.replace(/\/+$/, '').replace(/\/api\/?$/, '');
}

function noStore(res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Pragma', 'no-cache');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  noStore(res);

  const base = getPublicApiBaseUrl();
  const origin = toOrigin(base);
  if (!origin) return res.status(200).json({ ok: true, labels: {} });

  const lang = String((req.query as any)?.lang || '').toLowerCase().trim();
  const langParam = lang === 'en' || lang === 'hi' || lang === 'gu' ? `?lang=${encodeURIComponent(lang)}` : '';

  try {
    const upstream = await fetch(`${origin}/api/public/ui-labels${langParam}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        cookie: String(req.headers.cookie || ''),
        authorization: String(req.headers.authorization || ''),
      },
    });

    const text = await upstream.text().catch(() => '');
    if (!upstream.ok) {
      return res.status(200).json({ ok: true, labels: {} });
    }

    try {
      const json = text ? JSON.parse(text) : null;
      return res.status(200).json(json ?? { ok: true, labels: {} });
    } catch {
      return res.status(200).json({ ok: true, labels: {} });
    }
  } catch {
    return res.status(200).json({ ok: true, labels: {} });
  }
}
