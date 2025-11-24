import type { NextApiRequest, NextApiResponse } from 'next'

// Server-side proxy to avoid browser CORS. Forwards POST to backend.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://newspulse-backend-real.onrender.com'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ success: false, error: 'Method Not Allowed' })
  }

  const targetUrl = `${API_BASE_URL.replace(/\/+$/, '')}/api/community/submissions`

  try {
    // Minimal diagnostics without logging PII content
    try {
      console.log('[Community API] Forwarding submission to backend', {
        url: targetUrl,
        // Do not log field values; only presence/lengths
        fields: {
          name: typeof (req.body?.name) === 'string',
          email: typeof (req.body?.email) === 'string',
          location: typeof (req.body?.location) === 'string',
          category: req.body?.category,
          headlineLen: typeof (req.body?.headline) === 'string' ? req.body.headline.length : undefined,
          storyLen: typeof (req.body?.story) === 'string' ? req.body.story.length : undefined,
        },
      })
    } catch {}

    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(req.body ?? {}),
    })

    // Read as text then attempt JSON parse for robust handling
    const raw = await upstream.text()
    let data: any = null
    try { data = raw ? JSON.parse(raw) : null } catch {}

    try {
      console.log('[Community API] Upstream status/body', upstream.status, raw?.slice(0, 200))
    } catch {}

    // Mirror status. Ensure JSON response shape is consistent and include message if any.
    if (data !== null && typeof data === 'object') {
      return res.status(upstream.status).json(data)
    }
    return res.status(upstream.status).json({ success: upstream.ok, message: raw })
  } catch (error: any) {
    return res.status(502).json({ success: false, error: 'Upstream error' })
  }
}
