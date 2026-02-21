import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../../../lib/publicApiBase';

function getApiBase(): string {
  return String(getPublicApiBaseUrl() || '').trim().replace(/\/+$/, '');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
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

  const qsIndex = (req.url || '').indexOf('?');
  const qs = qsIndex >= 0 ? (req.url || '').slice(qsIndex) : '';
  const targetUrl = `${base}/api/public/news/${encodeURIComponent(id)}${qs}`;

  try {
    const upstream = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        cookie: String(req.headers.cookie || ''),
        authorization: String(req.headers.authorization || ''),
      },
    });

    const text = await upstream.text().catch(() => '');
    if (upstream.status === 404) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(404).json({ ok: false, message: 'NOT_FOUND' });
    }

    if (!upstream.ok) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({});
    }

    try {
      const json = text ? JSON.parse(text) : {};
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30');
      return res.status(200).json(json);
    } catch {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({});
    }
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({});
  }
}
