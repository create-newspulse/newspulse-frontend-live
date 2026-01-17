import type { NextApiRequest, NextApiResponse } from 'next';

function getApiBase(): string {
  return String(process.env.NEXT_PUBLIC_API_BASE || '').trim().replace(/\/+$/, '');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const id = String(req.query.id || '').trim();
  if (!id) return res.status(400).json({ ok: false, message: 'MISSING_ID' });

  const base = getApiBase();
  if (!base) return res.status(200).json({ story: null });

  const targetUrl = `${base}/api/public/stories/${encodeURIComponent(id)}`;

  try {
    const upstream = await fetch(targetUrl, { method: 'GET', headers: { Accept: 'application/json' } });
    const text = await upstream.text().catch(() => '');

    if (upstream.status === 404) return res.status(200).json({ story: null });
    if (!upstream.ok) return res.status(200).json({ story: null });

    try {
      const json = text ? JSON.parse(text) : { story: null };
      return res.status(200).json(json);
    } catch {
      return res.status(200).json({ story: null });
    }
  } catch {
    return res.status(200).json({ story: null });
  }
}
