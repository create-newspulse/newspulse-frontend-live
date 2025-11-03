// pages/api/admin/analytics.ts - Analytics Proxy API  
import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

/**
 * 📊 Admin Panel Analytics Proxy
 * Handles user tracking and analytics data
 */

const ADMIN_API_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL || 'http://localhost:5000/api';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { type, data } = req.body;
    
    // Validate analytics data
    if (!type || !data) {
      res.status(400).json({ error: 'Invalid analytics data' });
      return;
    }

    // Add server-side metadata
    // Be defensive about runtime fields to avoid crashes (e.g., req.connection can be undefined)
    const clientIp = (req.headers['x-forwarded-for'] as string)
      || (req.socket && req.socket.remoteAddress)
      || null;

    const analyticsData = {
      ...data,
      timestamp: new Date().toISOString(),
      ip: clientIp,
      userAgent: req.headers['user-agent'] || null,
      referer: (req.headers as any)['referer'] || (req.headers as any)['referrer'] || null,
      serverTimestamp: Date.now()
    };

    // Try to send to admin panel
    try {
      await axios.post(`${ADMIN_API_URL}/analytics/${type}`, analyticsData, {
        headers: {
          'Content-Type': 'application/json',
          ...(ADMIN_API_KEY && { Authorization: `Bearer ${ADMIN_API_KEY}` })
        },
        timeout: 5000
      });
    } catch (adminError) {
      // Silent fail for analytics - don't break user experience
      console.warn('Analytics tracking failed:', adminError);
    }

    // Always return success to frontend
    res.status(200).json({ 
      success: true, 
      tracked: true,
      timestamp: analyticsData.timestamp 
    });

  } catch (error: any) {
    console.warn('Analytics proxy error:', error.message);
    
    // Return success even on error to avoid breaking user experience
    res.status(200).json({ 
      success: true, 
      tracked: false,
      error: 'Analytics temporarily unavailable'
    });
  }
}