import type { NextApiRequest, NextApiResponse } from 'next';

function getApiBase(): string {
  return String(process.env.NEXT_PUBLIC_API_BASE || '').trim().replace(/\/+$/, '');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const base = getApiBase();
  if (!base) {
    // Keep UI alive even if env not configured.
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ items: [], total: 0, page: 1, totalPages: 1, limit: 0 });
  }

  const qsIndex = (req.url || '').indexOf('?');
  const qs = qsIndex >= 0 ? (req.url || '').slice(qsIndex) : '';
  const targetUrl = `${base}/api/public/news${qs}`;

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
    // If backend is missing the route (or temporarily down), fail open.
    if (upstream.status === 404) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ items: [] });
    }

    if (!upstream.ok) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ items: [] });
    }

    try {
      const json = text ? JSON.parse(text) : { items: [] };
      // Cache article lists briefly; ticker/broadcast remains no-store elsewhere.
      // Vercel/edge caching varies by full URL (including query string like lang/category/q).
      res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=30');
      return res.status(200).json(json);
    } catch {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(200).json({ items: [] });
    }
  } catch {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ items: [] });
  }
}
