import type { NextApiRequest, NextApiResponse } from 'next'

import { getPublicApiBaseUrl } from '../../../../lib/publicApiBase'
import { normalizePublicFounderToggles } from '../../../../lib/publicFounderToggles'

function normalizeLoopbackBase(base: string): string {
  return String(base || '').replace(/^http:\/\/localhost(?=[:/]|$)/i, 'http://127.0.0.1')
}

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

async function isYouthPulseSubmissionClosed(base: string): Promise<boolean> {
  const targetUrl = `${base.replace(/\/+$/, '')}/api/public/feature-toggles`

  try {
    const response = await fetch(targetUrl, {
      method: 'GET',
      headers: { Accept: 'application/json', 'Cache-Control': 'no-store', Pragma: 'no-cache' },
      cache: 'no-store',
    })
    const data = await response.json().catch(() => null)
    if (!response.ok) return false
    return normalizePublicFounderToggles(data).youthPulseSubmissionsClosed
  } catch {
    return false
  }
}

export default async function submitYouthPulsePublicHandler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const configuredBase = getPublicApiBaseUrl()
  const base = normalizeLoopbackBase(configuredBase)
  if (!base) {
    console.error('[public/youth-pulse/submit]', new Error('Backend base URL not configured'))
    return res.status(500).json({ ok: false, message: 'Backend URL not configured' })
  }

  const targetUrl = `${base.replace(/\/+$/, '')}/api/public/community-reporter/submit`
  if (await isYouthPulseSubmissionClosed(base)) {
    return res.status(403).json({ ok: false, message: 'Youth Pulse submissions are temporarily closed.' })
  }

  const body = readJsonBody(req)
  const normalized = {
    ...body,
    reporterType: 'community',
    desk: 'youth-pulse',
    submissionType: 'youth-pulse',
    source: body?.source || 'youth_pulse',
    autoPublish: false,
    publishRequested: false,
    moderationRequired: true,
  }

  if (process.env.NODE_ENV !== 'production') {
    console.info('[public/youth-pulse/submit] proxy request', {
      configuredBase,
      resolvedBase: base,
      targetUrl,
      method: 'POST',
      requestBody: normalized,
    })
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

    if (process.env.NODE_ENV !== 'production') {
      console.info('[public/youth-pulse/submit] proxy response', {
        targetUrl,
        status: upstream.status,
        body: text,
      })
    }

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
    console.error('[public/youth-pulse/submit]', {
      targetUrl,
      requestBody: normalized,
      error: err,
    })
    return res.status(500).json({ error: 'Internal Server Error' })
  }
}