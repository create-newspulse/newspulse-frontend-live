import type { NextApiRequest, NextApiResponse } from 'next'

// Resolve backend origin strictly from env (no localhost default)
const RAW_API_BASE_URL =
  process.env.NEWS_PULSE_BACKEND_URL ||
  process.env.API_BASE_URL ||
  ''

// Server-side proxy: /api/community-reporter/submit  →  backend
export default async function submitHandler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  // Allow only POST
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  // Validate required env vars used by this route
  const base = (RAW_API_BASE_URL || '').toString().trim()
  if (!base) {
    console.error('[community-reporter/submit]', new Error('Missing env var: API_BASE_URL'))
    return res.status(500).json({ error: 'Missing env var: API_BASE_URL' })
  }

  const targetUrl = `${base.replace(/\/+$/, '')}/api/community-reporter/submit`

  try {
    // Pages Router: body is available on req.body when Content-Type: application/json
    const body =
      req.body && typeof req.body === 'object' ? (req.body as Record<string, any>) : {}

    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    })

    const text = await upstream.text().catch(() => '')

    // If backend fails, propagate status and include response text safely as JSON
    if (!upstream.ok) {
      console.error('[community-reporter/submit]', new Error(`Upstream error ${upstream.status}: ${text}`))

      // Try to forward backend JSON as-is when possible
      try {
        const asJson = text ? JSON.parse(text) : { error: 'Upstream Error' }
        return res.status(upstream.status || 500).json(asJson)
      } catch {
        return res
          .status(upstream.status || 500)
          .json({ error: text || 'Upstream Error' })
      }
    }

    // Success – attempt JSON parse, fallback to { ok: true }
    try {
      const json = text ? JSON.parse(text) : { ok: true }
      return res.status(upstream.status || 200).json(json)
    } catch (err) {
      console.error('[community-reporter/submit]', err)
      return res.status(200).json({ ok: true })
    }
  } catch (err) {
    console.error('[community-reporter/submit]', err)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}
