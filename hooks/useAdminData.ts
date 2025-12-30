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

  const getApiOrigin = useCallback(() => {
    const origin =
      process.env.NEXT_PUBLIC_API_ORIGIN ||
      process.env.NEXT_PUBLIC_API_BASE_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      'https://newspulse-backend-real.onrender.com';

    return origin.replace(/\/+$/, '');
  }, []);

  const normalizeNewsResponse = useCallback((payload: any) => {
    const items = Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.news)
        ? payload.news
        : Array.isArray(payload)
          ? payload
          : [];

    const total =
      typeof payload?.total === 'number'
        ? payload.total
        : typeof payload?.count === 'number'
          ? payload.count
          : items.length;

    return { items, total };
  }, []);

  const fetchPublicNews = useCallback(
    async (params: Record<string, string | number | boolean | undefined>) => {
      const apiOrigin = getApiOrigin();
      const searchParams = new URLSearchParams();

      for (const [key, value] of Object.entries(params)) {
        if (value === undefined) continue;
        searchParams.set(key, String(value));
      }

      const url = `${apiOrigin}/api/public/news?${searchParams.toString()}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Public news fetch failed (${response.status})`);
      }

      const payload = await response.json();
      return normalizeNewsResponse(payload);
    },
    [getApiOrigin, normalizeNewsResponse]
  );

  // Fetch news data from public API (no auth)
  const fetchNews = useCallback(async (params: Record<string, unknown> = {}) => {
    try {
      setLoading(true);
      setError(null);

      const limit =
        typeof (params as any)?.limit === 'number'
          ? (params as any).limit
          : 50;

      const newsResponse = await fetchPublicNews({ limit });
      const allItems = newsResponse.items || [];

      setNews(allItems);
      setBreakingNews(
        allItems.filter(
          (item: any) =>
            item?.isBreaking === true ||
            String(item?.category || '').toLowerCase() === 'breaking'
        )
      );
      setTrendingNews(
        allItems
          .filter((item: any) => item?.isTrending === true)
          .slice(0, 5)
      );
      setLastUpdated(new Date());

      // Track analytics if enabled
      if (trackAnalytics) {
        try {
          analyticsApi.trackPageView({
            page: 'homepage',
            newsCount: newsResponse.total || 0,
            breakingCount: allItems.filter((item: any) => item?.isBreaking === true)
              .length,
          });
        } catch (err) {
          console.warn('Analytics tracking failed:', err);
        }
      }

    } catch (err) {
      console.warn('Public news fetch failed, using fallback:', err);
      setError('Unable to load news');
      
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
      const response = await fetchPublicNews({ category, limit });
      return response;
    } catch (err) {
      console.warn(`Failed to fetch ${category} news:`, err);
      return { items: [] };
    }
  }, [fetchPublicNews]);

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