// pages/api/admin/[...path].ts - Generic Admin API proxy for nested routes
import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'

const ADMIN_API_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL || 'http://localhost:5000/api'
const ADMIN_API_KEY = process.env.ADMIN_API_KEY

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  try {
    const { method, query, body } = req
    const path = Array.isArray(query.path) ? query.path.join('/') : String(query.path || '')

    const url = `${ADMIN_API_URL}/${path}`

    const headers: any = { 'Content-Type': 'application/json' }
    if (ADMIN_API_KEY) headers.Authorization = `Bearer ${ADMIN_API_KEY}`

    const response = await axios({
      method: method?.toLowerCase() as any,
      url,
      params: req.query,
      data: method !== 'GET' ? body : undefined,
      headers,
      timeout: 10000,
      validateStatus: () => true,
    })

    res.status(response.status || 200).json(response.data)
  } catch (err: any) {
    console.warn('Admin generic proxy error:', err?.message || err)
    res.status(503).json({ success: false, message: 'Admin API unavailable' })
  }
}
