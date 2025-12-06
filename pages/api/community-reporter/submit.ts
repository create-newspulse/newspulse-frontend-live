import type { NextApiRequest, NextApiResponse } from 'next'

// Backend origin as per requirements
const API_BASE_URL =
  process.env.NEWS_PULSE_BACKEND_URL ||
  process.env.API_BASE_URL ||
  'http://localhost:5000'

// Server-side proxy: /api/community-reporter/submit  →  backend
export default async function submitHandler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res
      .status(405)
      .json({ ok: false, message: 'METHOD_NOT_ALLOWED' })
  }

  const base = (API_BASE_URL || '').toString().trim()
  if (!base) {
    console.error('[community-reporter/submit] BACKEND_URL_MISSING')
    return res.status(500).json({ ok: false, message: 'BACKEND_URL_MISSING' })
  }
  const targetUrl = `${base.replace(/\/+$/,'')}/api/community-reporter/submit`

  try {
    const body = req.body && typeof req.body === 'object' ? (req.body as Record<string, any>) : {}
    const upstreamPayload = body

    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(upstreamPayload),
    })

    const text = await upstream.text().catch(() => '')

    if (!upstream.ok) {
      let json: any = null
      try {
        json = text ? JSON.parse(text) : null
      } catch {
        // ignore JSON parse error
      }

      console.error('[community-reporter/submit] upstream error', upstream.status, text)
      return res.status(upstream.status || 500).json({ ok: false, message: 'UPSTREAM_ERROR', status: upstream.status })
    }

    // Success – try to parse, fall back to { success: true }
    try {
      const json = text ? JSON.parse(text) : { ok: true }
      return res.status(upstream.status || 200).json(json)
    } catch {
      return res.status(upstream.status || 200).json({ ok: true })
    }
  } catch (err: any) {
    console.error('[community-reporter/submit] exception', err)
    return res.status(500).json({ ok: false, message: 'EXCEPTION' })
  }
}
