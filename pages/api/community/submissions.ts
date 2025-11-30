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

    // Map from our form keys to backend expectations (be lenient with aliases)
    const name = (body.reporterName || body.fullName || body.name || body.userName || '').toString().trim()
    const email = (body.reporterEmail || body.email || '').toString().trim()
    const phone = (body.reporterPhone || body.phone || '').toString().trim()
    const city = (body.city || body.location || '').toString().trim()
    const headline = (body.headline || body.title || '').toString().trim()
    const story = (body.story || body.body || body.content || '').toString().trim()
    const category = (body.category || '').toString()
    const consent = typeof body.acceptPolicy === 'boolean' ? body.acceptPolicy : (typeof body.confirm === 'boolean' ? body.confirm : undefined)
    const ageGroup = (body.ageGroup ?? '').toString()

    const backendPayload: Record<string, any> = {
      name,
      email,
      phone,
      city,
      headline,
      body: story,
      category,
    }
    if (typeof consent === 'boolean') backendPayload.consent = consent
    if (ageGroup) backendPayload.ageGroup = ageGroup
    // Send the original payload as `meta` for non-breaking backend visibility if useful
    backendPayload.meta = { ...(body || {}) }

    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(backendPayload),
    })

    if (!upstream.ok) {
      const errorText = await upstream.text().catch(() => '')
      console.error('[community-submit] upstream', upstream.status, upstream.statusText, errorText)
      // Forward upstream status if possible for easier debugging
      return res.status(upstream.status || 500).json({ error: 'submit_failed', upstream: errorText || upstream.statusText })
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
    return res.status(500).json({ error: 'submit_failed' })
  }
}
