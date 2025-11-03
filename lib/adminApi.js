// lib/adminApi.js - Professional Admin API Integration
import axios from 'axios';

/**
 * 🔗 Admin API Bridge - Connects Frontend with Admin Panel
 * Based on 50 years of news website architecture experience
 */

// Resolve Admin API base URL with browser safety:
// - In the browser: ALWAYS use the local Next.js proxy at /api/admin so we never
//   leak or depend on an external hostname that might be misconfigured.
// - In Node (rare for this module): fall back to env or localhost.
const ADMIN_API_URL = typeof window !== 'undefined'
  ? '/api/admin'
  : (process.env.NEXT_PUBLIC_ADMIN_API_URL || 'http://localhost:5000/api');

const adminApi = axios.create({
  baseURL: ADMIN_API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for authentication
adminApi.interceptors.request.use((config) => {
  // Add admin token if available (for authenticated requests)
  const adminToken = process.env.ADMIN_API_KEY || '';
  if (adminToken) {
    config.headers.Authorization = `Bearer ${adminToken}`;
  }
  return config;
});

// Response interceptor for error handling
adminApi.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('Admin API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

/**
 * 📰 News Content API - Fetch published content
 */
export const newsApi = {
  // Get published news for frontend display
  getPublishedNews: async (params = {}) => {
    const { page = 1, limit = 10, category, language = 'en' } = params;
    
    try {
      const response = await adminApi.get('/news', {
        params: { 
          page, 
          limit, 
          category, 
          language,
          status: 'published'  // Only get published content
        }
      });
      return response.data;
    } catch (error) {
      // Fallback to demo content if admin API is unavailable
      return {
        items: [
          {
            _id: 'demo-1',
            title: 'Welcome to News Pulse - Your Trusted News Source',
            content: 'News Pulse brings you the latest, most reliable news from around the world.',
            category: 'General',
            language: 'en',
            publishedAt: new Date().toISOString(),
            image: '/fallback.jpg',
            reads: 0,
            engagement: 0
          }
        ],
        total: 1,
        page: 1
      };
    }
  },

  // Get breaking news
  getBreakingNews: async () => {
    try {
      const response = await adminApi.get('/news/breaking');
      return response.data;
    } catch (error) {
      return { items: [] };
    }
  },

  // Get trending stories
  getTrendingNews: async (limit = 5) => {
    try {
      const response = await adminApi.get('/news/trending', {
        params: { limit }
      });
      return response.data;
    } catch (error) {
      return { items: [] };
    }
  },

  // Get news by category
  getNewsByCategory: async (category, limit = 10) => {
    try {
      const response = await adminApi.get(`/news/category/${category}`, {
        params: { limit, status: 'published' }
      });
      return response.data;
    } catch (error) {
      return { items: [] };
    }
  },

  // Get single news article
  getNewsById: async (id) => {
    try {
      const response = await adminApi.get(`/news/${id}`);
      // Increment read count
      adminApi.post(`/news/${id}/view`).catch(() => {}); // Silent fail
      return response.data;
    } catch (error) {
      return null;
    }
  },

  // Search news
  searchNews: async (query, filters = {}) => {
    try {
      const response = await adminApi.get('/news/search', {
        params: { q: query, ...filters, status: 'published' }
      });
      return response.data;
    } catch (error) {
      return { items: [], total: 0 };
    }
  }
};

/**
 * 📊 Analytics API - Track user engagement
 */
export const analyticsApi = {
  // Track page view via local shim that always returns 200
  trackPageView: async (data) => {
    try {
      await fetch('/api/analytics/pageview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          timestamp: new Date().toISOString(),
          userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : '',
          referrer: typeof window !== 'undefined' ? document.referrer : ''
        })
      });
    } catch (error) {
      // Silent fail for analytics
      console.warn('Analytics tracking failed:', error.message);
    }
  },

  // Track user interaction
  trackInteraction: async (data) => {
    try {
      await fetch('/api/analytics/interaction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, timestamp: new Date().toISOString() })
      });
    } catch (error) {
      console.warn('Interaction tracking failed:', error.message);
    }
  },

  // Track search query
  trackSearch: async (query, results) => {
    try {
      await fetch('/api/analytics/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, resultsCount: results, timestamp: new Date().toISOString() })
      });
    } catch (error) {
      console.warn('Search tracking failed:', error.message);
    }
  }
};

/**
 * ⚙️ Configuration API - Get frontend settings
 */
export const configApi = {
  // Get frontend configuration
  getConfig: async () => {
    try {
      const response = await adminApi.get('/config/frontend');
      return response.data;
    } catch (error) {
      // Return default config if admin API unavailable
      return {
        siteName: 'News Pulse',
        logoUrl: '/logo.png',
        themeColor: '#1f2937',
        enablePWA: true,
        enableDarkMode: true,
        enableVoiceSearch: true,
        enableAnalytics: true,
        socialLinks: {
          twitter: '',
          facebook: '',
          instagram: ''
        }
      };
    }
  },

  // Get live settings (for real-time features)
  getLiveSettings: async () => {
    try {
      const response = await adminApi.get('/config/live');
      return response.data;
    } catch (error) {
      return {
        breakingNewsEnabled: true,
        autoRefreshInterval: 300000, // 5 minutes
        maxArticlesPerPage: 12
      };
    }
  }
};

/**
 * 🎯 Content Management API - For dynamic content
 */
export const contentApi = {
  // Get homepage layout
  getHomepageLayout: async () => {
    try {
      const response = await adminApi.get('/content/homepage');
      return response.data;
    } catch (error) {
      return {
        sections: [
          { type: 'breaking', enabled: true, title: 'Breaking News' },
          { type: 'trending', enabled: true, title: 'Trending Now' },
          { type: 'categories', enabled: true, title: 'Latest News' }
        ]
      };
    }
  },

  // Get navigation menu
  getNavigationMenu: async () => {
    try {
      const response = await adminApi.get('/content/navigation');
      return response.data;
    } catch (error) {
      return {
        items: [
          { label: 'Home', path: '/', active: true },
          { label: 'India', path: '/india', active: true },
          { label: 'World', path: '/international', active: true },
          { label: 'Business', path: '/business', active: true },
          { label: 'Technology', path: '/science-technology', active: true },
          { label: 'Gujarat', path: '/gujarat', active: true }
        ]
      };
    }
  }
};

export default {
  newsApi,
  analyticsApi,
  configApi,
  contentApi
};