// components/AdminContentLoader.tsx - Live Content from Admin Panel
import React, { useEffect, useState } from 'react';
import { useAdminData } from '../hooks/useAdminData';
import { motion, AnimatePresence } from 'framer-motion';

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
  const {
    news,
    breakingNews,
    loading,
    error,
    isConnected,
    lastUpdated,
    getNewsByCategory
  } = useAdminData({
    refreshInterval: 300000, // 5 minutes
    enableRealtime: true,
    trackAnalytics: true
  });

  const [categoryNews, setCategoryNews] = useState([]);
  const [loadingCategory, setLoadingCategory] = useState(false);

  // Load category-specific news if specified
  useEffect(() => {
    if (category) {
      setLoadingCategory(true);
      getNewsByCategory(category, limit)
        .then(response => {
          setCategoryNews(response.items || []);
        })
        .finally(() => {
          setLoadingCategory(false);
        });
    }
  }, [category, limit, getNewsByCategory]);

  // Determine which news to display
  const displayNews = category ? categoryNews : news.slice(0, limit);
  const displayBreaking = showBreaking ? breakingNews : [];
  const isLoading = category ? loadingCategory : loading;

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