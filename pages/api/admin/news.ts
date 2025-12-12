// pages/api/admin/news.ts - Admin Panel Proxy API
import { NextApiRequest, NextApiResponse } from 'next';
import axios from 'axios';

/**
 * 🔗 Admin Panel Proxy - News API
 * Securely proxies requests to admin panel backend
 * Handles authentication and error fallbacks
 */

const ADMIN_API_URL = process.env.NEXT_PUBLIC_ADMIN_API_URL || 'http://localhost:5000/api';
const ADMIN_API_KEY = process.env.ADMIN_API_KEY;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { method, query, body } = req;
    
    // Build admin API URL
    const adminUrl = `${ADMIN_API_URL}/news`;
    
    // Prepare headers
    const headers: any = {
      'Content-Type': 'application/json',
    };
    
    if (ADMIN_API_KEY) {
      headers.Authorization = `Bearer ${ADMIN_API_KEY}`;
    }

    // Make request to admin panel
    const adminResponse = await axios({
      method: method?.toLowerCase() as any,
      url: adminUrl,
      params: query,
      data: method !== 'GET' ? body : undefined,
      headers,
      timeout: 10000
    });

    // Return admin panel response
    res.status(200).json(adminResponse.data);

  } catch (error: any) {
    // Gracefully handle 404 from backend without noisy logs
    const status = error?.response?.status;
    if (status === 404 && req.method === 'GET') {
      return res.status(200).json({ items: [], source: 'empty' });
    }

    // Minimal logging for other errors
    if (process.env.NODE_ENV !== 'production') {
      console.warn('Admin API proxy error:', error?.message);
    }
    
    // Fallback response when admin panel is unavailable
    if (req.method === 'GET') {
      res.status(200).json({
        items: [
          {
            _id: 'fallback-news-1',
            title: 'News Pulse - Your Trusted News Source',
            content: 'Welcome to News Pulse, bringing you the latest news from around the world with real-time updates and comprehensive coverage.',
            excerpt: 'Stay informed with our comprehensive news coverage...',
            category: 'General',
            language: req.query.language || 'en',
            publishedAt: new Date().toISOString(),
            image: '/fallback.jpg',
            author: 'News Pulse Team',
            source: 'News Pulse',
            reads: 1250,
            engagement: 85,
            isBreaking: false,
            isTrending: false,
            tags: ['news', 'updates', 'world'],
            slug: 'welcome-to-news-pulse'
          },
          {
            _id: 'fallback-news-2',
            title: 'Real-time News Updates Available',
            content: 'Our platform provides real-time news updates with advanced features including dark mode, voice search, and offline reading capabilities.',
            excerpt: 'Experience the future of news consumption...',
            category: 'Technology',
            language: req.query.language || 'en',
            publishedAt: new Date(Date.now() - 3600000).toISOString(),
            image: '/fallback.jpg',
            author: 'Tech Team',
            source: 'News Pulse',
            reads: 980,
            engagement: 92,
            isBreaking: false,
            isTrending: true,
            tags: ['technology', 'features', 'updates'],
            slug: 'real-time-news-updates'
          }
        ],
        total: 2,
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 10,
        hasMore: false,
        lastUpdated: new Date().toISOString(),
        source: 'fallback'
      });
    } else {
      res.status(503).json({
        success: false,
        message: 'Admin panel temporarily unavailable',
        error: 'SERVICE_UNAVAILABLE'
      });
    }
  }
}