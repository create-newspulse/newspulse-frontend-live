import type { NextApiRequest, NextApiResponse } from 'next';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const reporterId = String(req.query.reporterId ?? '').trim();
  const email = String(req.query.email ?? '').trim();
  const base = API_BASE_URL.replace(/\/+$/,'');
  const qs = reporterId ? `reporterId=${encodeURIComponent(reporterId)}` : `email=${encodeURIComponent(email)}`;
  const targetUrl = `${base}/api/community-reporter/my-stories?${qs}`;

  try {
    const upstream = await fetch(targetUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });

    const text = await upstream.text().catch(() => '');

    if (!upstream.ok) {
      console.error('[community-reporter/my-stories] upstream error', upstream.status, text);
      let json: any = null;
      try { json = text ? JSON.parse(text) : null; } catch {}
      return res.status(upstream.status || 500).json(json || { ok: false, message: 'UPSTREAM_ERROR' });
    }

    try {
      const json = text ? JSON.parse(text) : { ok: true, items: [] };
      return res.status(upstream.status || 200).json(json);
    } catch {
      return res.status(upstream.status || 200).json({ ok: true, items: [] });
    }
  } catch (err: any) {
    console.error('[community-reporter/my-stories] exception', err);
    return res.status(500).json({ ok: false, message: 'EXCEPTION' });
  }
}
