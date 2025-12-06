import type { NextApiRequest, NextApiResponse } from 'next';

// Keep the same base URL logic as submit.ts
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ success: false, error: 'method_not_allowed' });
  }

  const email = String(req.query.email ?? '').trim();
  const base = API_BASE_URL.replace(/\/+$/,'');
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
      return res.status(upstream.status || 500).json(json || { success: false, error: 'submit_failed' });
    }

    try {
      const json = text ? JSON.parse(text) : { success: true, stories: [] };
      return res.status(200).json(json);
    } catch {
      return res.status(200).json({ success: true, stories: [] });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'submit_failed' });
  }
}
