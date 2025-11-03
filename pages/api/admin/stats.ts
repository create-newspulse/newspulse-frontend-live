// pages/api/admin/stats.ts - Admin Panel Stats Proxy with fallback
import type { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

const ADMIN_API_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL || 'http://localhost:5000/api';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const headers: any = { 'Content-Type': 'application/json' };
    if (ADMIN_API_KEY) headers.Authorization = `Bearer ${ADMIN_API_KEY}`;

    const { data } = await axios.get(`${ADMIN_API_URL}/admin/stats`, { headers, timeout: 8000 });
    return res.status(200).json(data);
  } catch (err) {
    // Fallback demo stats so the widget works in dev without admin backend
    return res.status(200).json({
      totalNews: 1523,
      publishedToday: 34,
      totalReads: 84012,
      activeUsers: 219,
      topCategory: 'Technology',
      lastUpdate: new Date().toISOString(),
      source: 'fallback'
    });
  }
}
