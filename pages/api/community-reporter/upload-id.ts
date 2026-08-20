import type { NextApiRequest, NextApiResponse } from 'next'
import { getPublicApiBaseUrl } from '../../../lib/publicApiBase'

// Important: keep raw stream for multipart/form-data
export const config = {
  api: {
    bodyParser: false,
  },
}

function getBackendBaseUrl(): string {
  return getPublicApiBaseUrl().trim().replace(/\/+$/, '')
}

export default async function uploadIdHandler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' })
  }

  const base = getBackendBaseUrl()
  if (!base) {
    console.error(
      '[community-reporter/upload-id]',
      new Error('Backend base URL not configured'),
    )
    return res
      .status(500)
      .json({ ok: false, message: 'BACKEND_NOT_CONFIGURED' })
  }

  const targetUrl = `${base}/api/community-reporter/upload-id`

  // Forward the multipart stream as-is
  const headers: Record<string, any> = { ...req.headers }
  delete headers.host
  delete headers.connection
  headers.accept = 'application/json'

  try {
    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers,
      // NextApiRequest is a Node readable stream.
      body: req as any,
    })

    const text = await upstream.text().catch(() => '')

    // Try to forward JSON as-is
    try {
      const json = text ? JSON.parse(text) : null
      return res.status(upstream.status || 200).json(json ?? { ok: upstream.ok })
    } catch {
      return res
        .status(upstream.status || 200)
        .json({ ok: upstream.ok, message: text || undefined })
    }
  } catch (err) {
    console.error('[community-reporter/upload-id]', err)
    return res
      .status(500)
      .json({ ok: false, message: 'UPLOAD_PROXY_FAILED' })
  }
}
