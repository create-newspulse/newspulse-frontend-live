// pages/api/analytics/[event].ts - Same-origin proxy for News Pulse first-party article analytics
import type { NextApiRequest, NextApiResponse } from 'next'
import { getApiOrigin } from '../../../lib/publicNewsApi'

// Verified News Pulse backend analytics contract (flat JSON body).
const BACKEND_EVENT_PATHS: Record<string, string> = {
  'article-view': '/api/analytics/article/view',
  'engaged-read': '/api/analytics/article/engagement',
  'scroll-milestone': '/api/analytics/article/scroll',
  'article-heartbeat': '/api/analytics/article/heartbeat',
}

// A backend outage would otherwise emit one log line per reader event.
export const FAILURE_LOG_WINDOW_MS = 60_000
const failureLogState = new Map<string, { lastLoggedAt: number; suppressed: number }>()

function warnForwardingFailureThrottled(eventType: string, status: number | 'error') {
  const key = `${eventType}:${status}`
  const now = Date.now()
  const state = failureLogState.get(key)

  if (state && now - state.lastLoggedAt < FAILURE_LOG_WINDOW_MS) {
    state.suppressed += 1
    return
  }

  const suppressed = state?.suppressed ?? 0
  failureLogState.set(key, { lastLoggedAt: now, suppressed: 0 })

  const detail = status === 'error' ? 'unreachable' : `status ${status}`
  const tail = suppressed > 0 ? ` (${suppressed} similar suppressed in the last ${FAILURE_LOG_WINDOW_MS / 1000}s)` : ''
  console.warn(`Analytics forwarding failed for "${eventType}" (${detail})${tail}`)
}

export function __resetAnalyticsFailureLogStateForTests() {
  failureLogState.clear()
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Basic CORS headers; mirror admin analytics route
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { event } = req.query
  const rawType = Array.isArray(event) ? event[0] : event
  const safeType = typeof rawType === 'string' ? rawType : String(rawType || 'event')

  try {
    // Normalize body: sendBeacon may send text/plain; try to parse JSON if it's a string
    let payload: any = req.body ?? {}
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload)
      } catch {
        payload = {}
      }
    }
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) payload = {}

    const backendPath = BACKEND_EVENT_PATHS[safeType]
    if (!backendPath) {
      res.status(200).json({ success: true, tracked: false, reason: 'unsupported_event' })
      return
    }

    const origin = getApiOrigin()
    if (!origin) {
      res.status(200).json({ success: true, tracked: false, reason: 'backend_not_configured' })
      return
    }

    const resp = await fetch(`${origin}${backendPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!resp.ok) {
      warnForwardingFailureThrottled(safeType, resp.status)
      res.status(502).json({ success: false, tracked: false })
      return
    }

    // Let the backend override `tracked` when it intentionally skips or dedupes an event.
    const json = await resp.json().catch(() => null)
    const merged = json && typeof json === 'object' && !Array.isArray(json) ? json : {}
    res.status(200).json({ success: true, tracked: true, ...merged })
  } catch {
    // Never expose backend internals; log only the event name and outcome.
    warnForwardingFailureThrottled(safeType, 'error')
    res.status(502).json({ success: false, tracked: false })
  }
}
