import type { NextApiRequest, NextApiResponse } from 'next';

function getApiBase(): string {
  return String(process.env.NEXT_PUBLIC_API_BASE || '').trim().replace(/\/+$/, '');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.setHeader('Allow', 'GET,POST');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const id = String(req.query.id || '').trim();
  if (!id) return res.status(400).json({ ok: false, message: 'MISSING_ID' });

  const base = getApiBase();
  if (!base) return res.status(200).json({ ok: false });

  const targetUrl = `${base}/api/public/ads/${encodeURIComponent(id)}/click`;

  try {
    const upstream = await fetch(targetUrl, {
      method: req.method || 'POST',
      headers: { Accept: 'application/json' },
    });

    const text = await upstream.text().catch(() => '');
    try {
      const json = text ? JSON.parse(text) : { ok: upstream.ok };
      return res.status(200).json(json);
    } catch {
      return res.status(200).json({ ok: upstream.ok });
    }
  } catch {
    return res.status(200).json({ ok: false });
  }
}
