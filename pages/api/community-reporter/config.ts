import type { NextApiRequest, NextApiResponse } from 'next'
import { getPublicApiBaseUrl } from '../../../lib/publicApiBase'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' })
  }

  const base = getPublicApiBaseUrl().trim().replace(/\/+$/, '')
  if (!base) {
    return res.status(500).json({ ok: false, message: 'BACKEND_NOT_CONFIGURED' })
  }
  const targetUrl = `${base}/api/community-reporter/config`

  try {
    const upstream = await fetch(targetUrl, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    })

    const text = await upstream.text().catch(() => '')

    if (!upstream.ok) {
      console.error('[community-reporter/config] upstream error', upstream.status, text)
      let json: any = null
      try { json = text ? JSON.parse(text) : null } catch {}
      return res
        .status(upstream.status || 500)
        .json(json || { ok: false, message: 'Could not load community reporter config.' })
    }

    try {
      const json = text ? JSON.parse(text) : { ok: false }
      return res.status(upstream.status || 200).json(json)
    } catch {
      return res.status(upstream.status || 200).json({ ok: false })
    }
  } catch (err) {
    console.error('[community-reporter/config] exception', err)
    return res
      .status(500)
      .json({ ok: false, message: 'Could not load community reporter config.' })
  }
}
