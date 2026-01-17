import type { NextApiRequest, NextApiResponse } from 'next';

function getApiBase(): string {
  const raw = process.env.NEXT_PUBLIC_API_BASE || '';
  return String(raw).trim().replace(/\/+$/, '');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const base = getApiBase();
  if (!base) {
    // Avoid breaking the UI when env isn't configured.
    return res.status(200).json([]);
  }

  const targetUrl = `${base}/api/public/trending-topics`;

  try {
    const upstream = await fetch(targetUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    // If the backend route doesn't exist yet, don't break the UI.
    if (upstream.status === 404) {
      return res.status(200).json([]);
    }

    const text = await upstream.text().catch(() => '');
    if (!upstream.ok) {
      // Conservative fallback: keep UI alive.
      return res.status(200).json([]);
    }

    try {
      const json = text ? JSON.parse(text) : [];
      return res.status(200).json(json);
    } catch {
      return res.status(200).json([]);
    }
  } catch {
    return res.status(200).json([]);
  }
}
