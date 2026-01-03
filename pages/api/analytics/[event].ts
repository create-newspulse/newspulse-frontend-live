// pages/api/analytics/[event].ts - Friendly shim to proxy analytics events
import type { NextApiRequest, NextApiResponse } from 'next'
import { getApiOrigin } from '../../../lib/publicNewsApi'

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
  const type = Array.isArray(event) ? event[0] : event

  try {
    // Normalize body: sendBeacon may send text/plain; try to parse JSON if it's a string
    let payload: any = req.body ?? {}
    if (typeof payload === 'string') {
      try {
        payload = JSON.parse(payload)
      } catch {
        // keep as-is if not JSON
      }
    }

    // Public site must not depend on admin-only proxy routes.
    // Forward to a public backend analytics endpoint if available; otherwise no-op (200).
    const origin = getApiOrigin()
    const safeType = typeof type === 'string' ? type : String(type || 'event')
    const candidates = [
      `${origin}/api/analytics/${encodeURIComponent(safeType)}`,
      `${origin}/api/public/analytics/${encodeURIComponent(safeType)}`,
      `${origin}/api/analytics`,
      `${origin}/api/public/analytics`,
    ]

    let lastStatus: number | undefined
    for (const url of candidates) {
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({ type: safeType, data: payload }),
        })
        lastStatus = resp.status
        if (!resp.ok) continue

        const json = await resp.json().catch(() => ({ success: true, tracked: true }))
        res.status(200).json(json)
        return
      } catch {
        continue
      }
    }

    res.status(200).json({ success: true, tracked: false, status: lastStatus })
  } catch (err: any) {
    console.warn('Analytics event proxy failed:', err?.message || err)
    // Always succeed to avoid noisy console errors in the UI
    res.status(200).json({ success: true, tracked: false })
  }
}
