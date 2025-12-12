// pages/api/admin/news/[...slug].ts - Catch-all proxy for admin news subroutes
import type { NextApiRequest, NextApiResponse } from 'next'
import axios from 'axios'

const ADMIN_API_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL || 'http://localhost:5000/api'
const ADMIN_API_KEY = process.env.ADMIN_API_KEY

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Basic CORS to match other admin routes
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') {
    res.status(200).end()
    return
  }

  try {
    const slugParam = req.query.slug
    const slug = Array.isArray(slugParam) ? slugParam.join('/') : String(slugParam || '')

    const adminUrl = `${ADMIN_API_URL}/news/${slug}`.replace(/\/+$/, '')

    // Remove our catch-all param from forwarded query
    const { slug: _omit, ...forwardQuery } = req.query as Record<string, any>

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    }
    if (ADMIN_API_KEY) headers.Authorization = `Bearer ${ADMIN_API_KEY}`

    const adminResponse = await axios({
      method: (req.method || 'GET').toLowerCase() as any,
      url: adminUrl,
      params: forwardQuery,
      data: req.method !== 'GET' ? req.body : undefined,
      headers,
      timeout: 10000,
    })

    res.status(200).json(adminResponse.data)
  } catch (error: any) {
    // Gracefully handle 404s for GET routes without noisy logs
    const status = error?.response?.status
    if (status === 404 && req.method === 'GET') {
      return res.status(200).json({ items: [], source: 'empty' })
    }

    // Do not break the app; provide sensible fallbacks
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Admin news subroute proxy error:', error?.message || error)
    }

    if (req.method === 'GET') {
      // For breaking/trending, return an empty items list as a safe default
      res.status(200).json({ items: [] })
    } else {
      res.status(503).json({ success: false, message: 'Admin news endpoint unavailable' })
    }
  }
}
