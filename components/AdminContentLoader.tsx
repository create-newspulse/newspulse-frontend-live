// components/AdminContentLoader.tsx - Live Content from Admin Panel
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchCategoryNews } from '../lib/fetchCategoryNews';
import { fetchPublicNews } from '../lib/publicNewsApi';

interface AdminContentLoaderProps {
  category?: string;
  limit?: number;
  showBreaking?: boolean;
  children: (data: {
    news: any[];
    breakingNews: any[];
    loading: boolean;
    isConnected: boolean;
    lastUpdated: Date | null;
  }) => React.ReactNode;
}

/**
 * 🔗 Admin Content Loader - Connects Frontend with Admin Panel
 * This component automatically loads content from your admin panel
 */
const AdminContentLoader: React.FC<AdminContentLoaderProps> = ({
  category,
  limit = 10,
  showBreaking = true,
  children
}) => {
  const refreshInterval = 300000; // 5 minutes
  const [news, setNews] = useState<any[]>([]);
  const [breakingNews, setBreakingNews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const load = async (signal?: AbortSignal) => {
    setLoading(true);

    try {
      if (category) {
        const res = await fetchCategoryNews({ categoryKey: category, limit });
        if (signal?.aborted) return;
        setNews(res.items || []);
      } else {
        const res = await fetchPublicNews({ limit, signal });
        if (signal?.aborted) return;
        setNews(res.items || []);
      }

      // We intentionally do not fetch breaking news via admin endpoints.
      // Breaking ticker (if enabled) can be wired to a public endpoint elsewhere.
      setBreakingNews([]);
      setIsConnected(true);
      setLastUpdated(new Date());
    } catch (err) {
      if (signal?.aborted) return;
      setIsConnected(false);
      setBreakingNews([]);
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  };

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);

    const id = setInterval(() => {
      load();
    }, refreshInterval);

    return () => {
      controller.abort();
      clearInterval(id);
    };
  }, [category, limit]);

  // Determine which news to display
  const displayNews = news.slice(0, limit);
  const displayBreaking = showBreaking ? breakingNews : [];
  const isLoading = loading;

  return (
    <>
      {/* Connection Status Indicator */}
      <AnimatePresence>
        {!isConnected && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-4 right-4 z-50 bg-yellow-100 dark:bg-yellow-900 border border-yellow-400 text-yellow-800 dark:text-yellow-200 px-4 py-2 rounded-lg shadow-lg"
          >
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">
                Admin Panel Offline - Using Cached Content
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live Update Indicator */}
      {isConnected && lastUpdated && (
        <div className="mb-4 text-center">
          <div className="inline-flex items-center space-x-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-3 py-1 rounded-full text-xs">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span>Live • Updated {lastUpdated.toLocaleTimeString()}</span>
          </div>
        </div>
      )}

      {/* Render children with admin data */}
      {children({
        news: displayNews,
        breakingNews: displayBreaking,
        loading: isLoading,
        isConnected,
        lastUpdated
      })}
    </>
  );
};

export default AdminContentLoader;