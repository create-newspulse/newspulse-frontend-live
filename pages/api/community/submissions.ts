import type { NextApiRequest, NextApiResponse } from 'next'

// Server-side proxy to avoid browser CORS. Forwards POST to backend with a
// minimal, backend-compatible payload to prevent schema mismatches.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://newspulse-backend-real.onrender.com'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ success: false, error: 'method_not_allowed' })
  }

  const targetUrl = `${API_BASE_URL.replace(/\/+$/, '')}/api/community/submissions`

  try {
    const raw = (req.body && typeof req.body === 'object') ? req.body : {}

    // Normalize incoming fields from the client
    const name = (raw.name || raw.userName || '').toString().trim()
    const email = (raw.email || '').toString().trim()
    const location = (raw.location || raw.city || '').toString().trim()
    const category = (raw.category ?? '').toString()
    const headline = (raw.headline || '').toString().trim()
    const storyText = (raw.story || raw.body || '').toString().trim()

    // Build minimal backend payload – DO NOT include new reporter-detail fields
    // Keep story under the legacy key that backend accepted; include both for safety
    const backendPayload: Record<string, any> = {
      name,
      email,
      location,
      category,
      headline,
      body: storyText,
      story: storyText,
    }

    // Small diagnostic without PII values
    try {
      console.log('[community-submit] forwarding', {
        url: targetUrl,
        keys: Object.keys(backendPayload),
        headlineLen: headline.length,
        storyLen: storyText.length,
      })
    } catch {}

    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(backendPayload),
    })

    const upstreamText = await upstream.text()
    let upstreamJson: any = null
    try { upstreamJson = upstreamText ? JSON.parse(upstreamText) : null } catch {}

    if (!upstream.ok) {
      console.error('[community-submit] upstream error', upstream.status, upstreamText?.slice(0, 200))
      return res.status(502).json({ success: false, error: 'submit_failed' })
    }

    // Success passthrough (prefer JSON if available)
    if (upstreamJson && typeof upstreamJson === 'object') {
      return res.status(200).json(upstreamJson)
    }
    return res.status(200).json({ success: true })
  } catch (err: any) {
    console.error('[community-submit] proxy exception', err?.message)
    return res.status(500).json({ success: false, error: 'submit_failed' })
  }
}
