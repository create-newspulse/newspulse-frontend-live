// pages/api/analytics/[event].ts - Friendly shim to proxy analytics events
import type { NextApiRequest, NextApiResponse } from 'next'

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

    // Prefer proxying through our existing admin proxy route to keep behavior consistent
    const proto = (req.headers['x-forwarded-proto'] as string) || 'http'
    const host = req.headers.host
    const baseUrl = `${proto}://${host}`

    const resp = await fetch(`${baseUrl}/api/admin/analytics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, data: payload })
    })

    // Bubble up the admin proxy response but never fail hard
    const json = await resp.json().catch(() => ({ success: true, tracked: false }))
    res.status(200).json(json)
  } catch (err: any) {
    console.warn('Analytics event proxy failed:', err?.message || err)
    // Always succeed to avoid noisy console errors in the UI
    res.status(200).json({ success: true, tracked: false })
  }
}
