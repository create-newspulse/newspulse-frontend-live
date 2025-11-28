import type { NextApiRequest, NextApiResponse } from 'next'

// Server-side proxy to avoid browser CORS. Forwards POST to backend with a
// minimal, backend-compatible payload (headline, story, category only).
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://newspulse-backend-real.onrender.com'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ code: 'method_not_allowed' })
  }

  const targetUrl = `${API_BASE_URL.replace(/\/+$/, '')}/api/community/submissions`

  try {
    const body = (req.body && typeof req.body === 'object') ? req.body as Record<string, any> : {}

    // Map field names to the minimal backend expectation
    const headline = (body.headline || body.title || '').toString().trim()
    const story = (body.story || body.body || body.content || '').toString().trim()
    const category = (body.category || '').toString()

    const backendPayload = { headline, story, category }

    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(backendPayload),
    })

    if (!upstream.ok) {
      // Log concise server-side detail only
      console.error('[community-submit] upstream', upstream.status, upstream.statusText)
      return res.status(500).json({ code: 'submit_failed' })
    }

    // Forward upstream JSON if available
    const text = await upstream.text()
    try {
      const json = text ? JSON.parse(text) : { success: true }
      return res.status(200).json(json)
    } catch {
      return res.status(200).json({ success: true })
    }
  } catch (err: any) {
    console.error('[community-submit] exception', err?.message)
    return res.status(500).json({ code: 'submit_failed' })
  }
}
