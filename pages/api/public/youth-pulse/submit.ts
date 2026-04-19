import type { NextApiRequest, NextApiResponse } from 'next'

import { getPublicApiBaseUrl } from '../../../../lib/publicApiBase'

function readJsonBody(req: NextApiRequest): Record<string, any> {
  if (req.body && typeof req.body === 'object') return req.body as Record<string, any>
  if (typeof req.body === 'string' && req.body.trim()) {
    try {
      return JSON.parse(req.body) as Record<string, any>
    } catch {
      return {}
    }
  }
  return {}
}

export default async function submitYouthPulsePublicHandler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const base = getPublicApiBaseUrl()
  if (!base) {
    console.error('[public/youth-pulse/submit]', new Error('Backend base URL not configured'))
    return res.status(500).json({ ok: false, message: 'Backend URL not configured' })
  }

  const targetUrl = `${base.replace(/\/+$/, '')}/api/community-reporter/submit`
  const body = readJsonBody(req)
  const normalized = {
    ...body,
    reporterType: 'community',
    desk: 'youth-pulse',
    submissionType: 'youth-pulse',
    source: body?.source || 'youth-pulse-public-frontend',
    autoPublish: false,
    publishRequested: false,
    moderationRequired: true,
  }

  try {
    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(normalized),
    })

    const text = await upstream.text().catch(() => '')

    if (!upstream.ok) {
      console.error('[public/youth-pulse/submit]', new Error(`Upstream error ${upstream.status}: ${text}`))
      try {
        const asJson = text ? JSON.parse(text) : { error: 'Upstream Error' }
        return res.status(upstream.status || 500).json(asJson)
      } catch {
        return res.status(upstream.status || 500).json({ error: text || 'Upstream Error' })
      }
    }

    try {
      const json = text ? JSON.parse(text) : { ok: true }
      return res.status(upstream.status || 200).json(json)
    } catch (err) {
      console.error('[public/youth-pulse/submit]', err)
      return res.status(200).json({ ok: true })
    }
  } catch (err) {
    console.error('[public/youth-pulse/submit]', err)
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}