// hooks/useAdminData.ts - Professional Admin Integration Hook
import { useState, useEffect, useCallback } from 'react';
import { newsApi, analyticsApi, configApi } from '../lib/adminApi';

/**
 * 🔗 Admin Data Integration Hook
 * Connects frontend with admin panel data in real-time
 * Based on 50 years of news website architecture experience
 */

interface NewsItem {
  _id: string;
  title: string;
  content: string;
  category: string;
  language: string;
  publishedAt: string;
  image?: string;
  reads: number;
  engagement: number;
  isBreaking?: boolean;
  isTrending?: boolean;
}

interface UseAdminDataOptions {
  refreshInterval?: number;
  enableRealtime?: boolean;
  trackAnalytics?: boolean;
}

export const useAdminData = (options: UseAdminDataOptions = {}) => {
  const {
    refreshInterval = 300000, // 5 minutes
    enableRealtime = true,
    trackAnalytics = true
  } = options;

  // State management
  const [news, setNews] = useState<NewsItem[]>([]);
  const [breakingNews, setBreakingNews] = useState<NewsItem[]>([]);
  const [trendingNews, setTrendingNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch news data from admin panel
  const fetchNews = useCallback(async (params = {}) => {
    try {
      setLoading(true);
      setError(null);

      const [newsResponse, breakingResponse, trendingResponse] = await Promise.all([
        newsApi.getPublishedNews(params),
        newsApi.getBreakingNews(),
        newsApi.getTrendingNews(5)
      ]);

      setNews(newsResponse.items || []);
      setBreakingNews(breakingResponse.items || []);
      setTrendingNews(trendingResponse.items || []);
      setLastUpdated(new Date());

      // Track analytics if enabled
      if (trackAnalytics) {
        analyticsApi.trackPageView({
          page: 'homepage',
          newsCount: newsResponse.total || 0,
          breakingCount: breakingResponse.items?.length || 0
        });
      }

    } catch (err) {
      console.warn('Admin data fetch failed, using fallback:', err);
      setError('Unable to connect to admin panel');
      
      // Fallback data when admin panel is unavailable
      setNews([
        {
          _id: 'fallback-1',
          title: 'Welcome to News Pulse - Your Trusted News Source',
          content: 'Stay informed with the latest news from around the world.',
          category: 'General',
          language: 'en',
          publishedAt: new Date().toISOString(),
          image: '/fallback.jpg',
          reads: 0,
          engagement: 0
        }
      ]);
      setBreakingNews([]);
      setTrendingNews([]);
    } finally {
      setLoading(false);
    }
  }, [trackAnalytics]);

  // Search functionality
  const searchNews = useCallback(async (query: string, filters = {}) => {
    try {
      const response = await newsApi.searchNews(query, filters);
      
      if (trackAnalytics) {
        analyticsApi.trackSearch(query, response.total || 0);
      }
      
      return response;
    } catch (err) {
      console.warn('Search failed:', err);
      return { items: [], total: 0 };
    }
  }, [trackAnalytics]);

  // Get news by category
  const getNewsByCategory = useCallback(async (category: string, limit = 10) => {
    try {
      const response = await newsApi.getNewsByCategory(category, limit);
      return response;
    } catch (err) {
      console.warn(`Failed to fetch ${category} news:`, err);
      return { items: [] };
    }
  }, []);

  // Track article view
  const trackArticleView = useCallback(async (articleId: string, articleTitle: string) => {
    if (trackAnalytics) {
      try {
        await analyticsApi.trackInteraction({
          type: 'article_view',
          articleId,
          articleTitle,
          timestamp: new Date().toISOString()
        });
      } catch (err) {
        console.warn('Failed to track article view:', err);
      }
    }
  }, [trackAnalytics]);

  // Initial data fetch
  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  // Real-time updates
  useEffect(() => {
    if (!enableRealtime) return;

    const interval = setInterval(() => {
      fetchNews();
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [fetchNews, refreshInterval, enableRealtime]);

  // Return hook interface
  return {
    // Data
    news,
    breakingNews,
    trendingNews,
    loading,
    error,
    lastUpdated,

    // Actions
    fetchNews,
    searchNews,
    getNewsByCategory,
    trackArticleView,
    
    // Utilities
    refresh: () => fetchNews(),
    isConnected: !error && news.length > 0
  };
};

/**
 * 🎯 Admin Configuration Hook
 */
export const useAdminConfig = () => {
  type AdminConfig = Record<string, unknown>;
  const [config, setConfig] = useState<AdminConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const [siteConfig, liveSettings] = await Promise.all<AdminConfig[]>([
          configApi.getConfig(),
          configApi.getLiveSettings()
        ]);
        
        setConfig({ ...siteConfig, ...liveSettings });
      } catch (err) {
        console.warn('Failed to fetch admin config:', err);
        // Use default config
        setConfig({
          siteName: 'News Pulse',
          themeColor: '#1f2937',
          enablePWA: true,
          enableDarkMode: true,
          breakingNewsEnabled: true,
          autoRefreshInterval: 300000
        });
      } finally {
        setLoading(false);
      }
    };

    fetchConfig();
  }, []);

  return { config, loading };
};

/**
 * 🔄 Real-time Connection Status Hook
 */
export const useAdminConnection = () => {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  useEffect(() => {
    const checkConnection = async () => {
      try {
        // Try to fetch a simple endpoint to check connection
        await newsApi.getPublishedNews({ limit: 1 });
        setIsConnected(true);
        setConnectionStatus('connected');
      } catch (err) {
        setIsConnected(false);
        setConnectionStatus('disconnected');
      }
    };

    checkConnection();
    
    // Check connection every 30 seconds
    const interval = setInterval(checkConnection, 30000);
    return () => clearInterval(interval);
  }, []);

  return { isConnected, connectionStatus };
};

export default useAdminData;