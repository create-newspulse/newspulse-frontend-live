import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../../../../lib/publicApiBase';

function getApiBase(): string {
  return String(getPublicApiBaseUrl() || '').trim().replace(/\/+$/, '');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const base = getApiBase();
  if (!base) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({});
  }

  const id = String(req.query.id || '').trim();
  if (!id) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(400).json({ ok: false, message: 'MISSING_ID' });
  }

  try {
    const upstream = await fetch(`${base}/api/public/news/${encodeURIComponent(id)}/translate`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        cookie: String(req.headers.cookie || ''),
        authorization: String(req.headers.authorization || ''),
      },
      body: typeof req.body === 'string' ? req.body : JSON.stringify(req.body ?? {}),
    });

    const text = await upstream.text().catch(() => '');

    if (!upstream.ok) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(upstream.status).json({ ok: false, message: 'UPSTREAM_ERROR' });
    }

    try {
      const json = text ? JSON.parse(text) : {};
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json(json);
    } catch {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({});
    }
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: false, message: 'NETWORK_ERROR' });
  }
}
