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
    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body ?? {}),
    })

    // Try to parse JSON; if not JSON, pass through status with empty body
    let data: any = null
    try {
      data = await upstream.json()
    } catch {
      // ignore
    }

    // Mirror status. Ensure JSON response shape is consistent.
    if (data !== null && typeof data === 'object') {
      return res.status(upstream.status).json(data)
    }
    return res.status(upstream.status).json({ success: upstream.ok })
  } catch (error: any) {
    return res.status(502).json({ success: false, error: 'Upstream error' })
  }
}
