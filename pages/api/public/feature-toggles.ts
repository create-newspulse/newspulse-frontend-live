import type { NextApiRequest, NextApiResponse } from 'next'

import { getPublicApiBaseUrl } from '../../../lib/publicApiBase'

function noStore(res: NextApiResponse) {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.setHeader('Pragma', 'no-cache')
  res.setHeader('Expires', '0')
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  noStore(res)

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' })
  }

  const base = getPublicApiBaseUrl().trim().replace(/\/+$/, '')
  if (!base) {
    return res.status(200).json({ ok: false, message: 'PUBLIC_API_BASE_NOT_CONFIGURED' })
  }
  const targetUrl = `${base}/api/public/feature-toggles`

  try {
    const upstream = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
      },
      cache: 'no-store',
    })

    const text = await upstream.text().catch(() => '')

    if (!upstream.ok) {
      let json: any = null
      try { json = text ? JSON.parse(text) : null } catch {}
      return res
        .status(upstream.status || 500)
        .json(json || { ok: false, message: 'Could not load feature toggles.' })
    }

    try {
      const json = text ? JSON.parse(text) : { ok: false }
      return res.status(upstream.status || 200).json(json)
    } catch {
      return res.status(upstream.status || 200).json({ ok: false })
    }
  } catch (err) {
    return res
      .status(500)
      .json({ ok: false, message: 'Could not load feature toggles.' })
  }
}
