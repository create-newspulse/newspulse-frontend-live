import type { NextApiRequest, NextApiResponse } from 'next';

// Align with other community-reporter proxies (submit/withdraw)
const API_BASE_URL =
  process.env.NEWS_PULSE_BACKEND_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:5000';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const emailRaw = String(req.query.email ?? '').trim();
  if (!emailRaw) {
    return res.status(400).json({ ok: false, message: 'email is required' });
  }

  const email = emailRaw.toLowerCase();
  const base = (API_BASE_URL || '').toString().trim().replace(/\/+$/, '');
  const targetUrl = `${base}/api/community-reporter/my-stories?email=${encodeURIComponent(email)}`;

  try {
    const upstream = await fetch(targetUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    const text = await upstream.text().catch(() => '');

    if (!upstream.ok) {
      let json: any = null;
      try { json = text ? JSON.parse(text) : null; } catch {}
      console.error('[api/community-reporter/my-stories] upstream error', upstream.status, text);
      return res.status(upstream.status || 500).json(json || { ok: false, message: 'UPSTREAM_ERROR' });
    }

    try {
      const raw = text ? JSON.parse(text) : {};
      const stories = Array.isArray((raw as any).stories)
        ? (raw as any).stories
        : Array.isArray((raw as any).items)
        ? (raw as any).items
        : Array.isArray((raw as any).data?.stories)
        ? (raw as any).data.stories
        : [];
      return res.status(200).json({ ok: true, stories });
    } catch (parseErr) {
      console.error('[api/community-reporter/my-stories] parse error', parseErr);
      return res.status(500).json({ ok: false, message: 'PROXY_PARSE_ERROR' });
    }
  } catch (err) {
    console.error('[api/community-reporter/my-stories] exception', err);
    return res.status(500).json({ ok: false, message: 'PROXY_ERROR' });
  }
}
