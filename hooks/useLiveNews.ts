import { useState, useEffect, useCallback } from 'react';
import { useI18n } from '../src/i18n/LanguageProvider';

interface NewsArticle {
  id: string;
  title: string;
  excerpt: string;
  content: string;
  image: string;
  source: string;
  category: string;
  publishedAt: string;
  author: string;
  url: string;
}

interface NewsResponse {
  success: boolean;
  articles: NewsArticle[];
  totalResults: number;
  language: string;
  lastUpdated: string;
}

export const useLiveNews = (category: string = 'all', autoRefresh: boolean = true) => {
  const { t } = useI18n();
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  const fetchNews = useCallback(async (cat: string = category) => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`/api/live-news?category=${cat}&limit=20`);
      const data: NewsResponse = await response.json();
      
      if (data.success) {
        setNews(data.articles);
        setLastUpdated(data.lastUpdated);
      } else {
        setError(t('liveNews.failedToFetch'));
      }
    } catch (err) {
      setError(t('errors.networkError'));
      console.error('News fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [category, t]);

  // Initial load
  useEffect(() => {
    fetchNews();
  }, [fetchNews]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(() => {
      fetchNews();
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [fetchNews, autoRefresh]);

  const refreshNews = () => fetchNews();
  const loadCategoryNews = (cat: string) => fetchNews(cat);

  return {
    news,
    loading,
    error,
    lastUpdated,
    refreshNews,
    loadCategoryNews
  };
};

// Hook for search functionality
export const useNewsSearch = () => {
  const [searchResults, setSearchResults] = useState<NewsArticle[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const performSearch = async (query: string, articles: NewsArticle[]) => {
    setIsSearching(true);
    setSearchQuery(query);

    // Simulate search delay
    await new Promise(resolve => setTimeout(resolve, 300));

    const results = articles.filter(article => 
      article.title.toLowerCase().includes(query.toLowerCase()) ||
      article.excerpt.toLowerCase().includes(query.toLowerCase()) ||
      article.category.toLowerCase().includes(query.toLowerCase())
    );

    setSearchResults(results);
    setIsSearching(false);

    return results;
  };

  const clearSearch = () => {
    setSearchResults([]);
    setSearchQuery('');
  };

  return {
    searchResults,
    searchQuery,
    isSearching,
    performSearch,
    clearSearch
  };
};