import type { NextApiRequest, NextApiResponse } from 'next';

// Prefer same env logic as submit
const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  '';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const storyId = String(req.query.id || '').trim();
  if (!storyId) {
    return res.status(400).json({ ok: false, message: 'MISSING_STORY_ID' });
  }

  const base = (API_BASE_URL || '').toString().trim().replace(/\/+$/, '');
  if (!base) {
    return res.status(500).json({ ok: false, message: 'NEXT_PUBLIC_API_URL not set' });
  }
  const targetUrl = `${base}/api/public/community-reporter/${encodeURIComponent(storyId)}/withdraw`;

  try {
    const payload = req.body && typeof req.body === 'object' ? req.body : {};
    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await upstream.text().catch(() => '');

    if (!upstream.ok) {
      let json: any = null;
      try { json = text ? JSON.parse(text) : null; } catch {}
      return res.status(upstream.status || 500).json(json || { ok: false, message: 'UPSTREAM_ERROR' });
    }

    try {
      const json = text ? JSON.parse(text) : { ok: true };
      return res.status(upstream.status || 200).json(json);
    } catch {
      return res.status(upstream.status || 200).json({ ok: true });
    }
  } catch (err) {
    return res.status(500).json({ ok: false, message: 'EXCEPTION' });
  }
}
