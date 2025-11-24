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
    // Normalize/augment incoming fields so backend can handle either naming convention
    const incoming = (req.body && typeof req.body === 'object') ? { ...req.body } : {}
    if (incoming.userName && !incoming.name) incoming.name = incoming.userName
    if (incoming.body && !incoming.story) incoming.story = incoming.body
    // Some backends may still expect story under 'body' so ensure both present
    if (incoming.story && !incoming.body) incoming.body = incoming.story
    // Pass confirm flag if present (was previously omitted on client payload)
    if (typeof incoming.confirm === 'undefined' && typeof req.body?.confirm === 'boolean') {
      incoming.confirm = req.body.confirm
    }

    // Minimal diagnostics without logging PII content
    try {
      console.log('[Community API] Forwarding submission to backend', {
        url: targetUrl,
        // Do not log field values; only presence/lengths
        fields: {
          name: typeof incoming.name === 'string',
          userName: typeof incoming.userName === 'string',
          email: typeof incoming.email === 'string',
          location: typeof incoming.location === 'string',
          category: incoming.category,
          headlineLen: typeof incoming.headline === 'string' ? incoming.headline.length : undefined,
          storyLen: typeof incoming.story === 'string' ? incoming.story.length : undefined,
          bodyLen: typeof incoming.body === 'string' ? incoming.body.length : undefined,
          mediaLink: typeof incoming.mediaLink === 'string',
          confirm: typeof incoming.confirm === 'boolean' ? incoming.confirm : undefined,
        },
      })
    } catch {}

    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(incoming),
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
    console.error('[Community API] Internal proxy error', error?.message)
    return res.status(500).json({ success: false, error: 'Proxy internal error', detail: error?.message })
  }
}
