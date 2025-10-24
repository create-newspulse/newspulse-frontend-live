import React from 'react';
import { motion } from 'framer-motion';
import { useBookmarks } from '../hooks/useBookmarks';
import { trackFeatureUsage } from '../hooks/useAnalytics';

interface BookmarkButtonProps {
  article: {
    id: string;
    title: string;
    excerpt: string;
    image?: string;
    source: string;
    category: string;
    publishedAt: string;
    url: string;
  };
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const BookmarkButton: React.FC<BookmarkButtonProps> = ({ 
  article, 
  size = 'md', 
  className = '' 
}) => {
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const bookmarked = isBookmarked(article.id);

  const sizeClasses = {
    sm: 'w-6 h-6 text-sm',
    md: 'w-8 h-8 text-base',
    lg: 'w-10 h-10 text-lg'
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    toggleBookmark({
      id: article.id,
      title: article.title,
      excerpt: article.excerpt,
      image: article.image || '',
      source: article.source,
      category: article.category,
      publishedAt: article.publishedAt,
      url: article.url
    });

    // Track bookmark usage
    trackFeatureUsage('bookmark', bookmarked ? 'remove' : 'add', article.id);
  };

  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={handleToggle}
      className={`
        relative rounded-full bg-white/90 dark:bg-dark-secondary/90 backdrop-blur-sm 
        border border-gray-200 dark:border-gray-600 shadow-lg
        hover:bg-white dark:hover:bg-dark-secondary transition-all duration-200
        flex items-center justify-center ${sizeClasses[size]} ${className}
      `}
      aria-label={bookmarked ? 'Remove bookmark' : 'Add bookmark'}
      title={bookmarked ? 'Remove from bookmarks' : 'Save for later'}
    >
      <motion.span
        animate={{ 
          scale: bookmarked ? [1, 1.3, 1] : 1,
          color: bookmarked ? '#f59e0b' : '#6b7280'
        }}
        transition={{ duration: 0.3 }}
        className="select-none"
      >
        {bookmarked ? '🔖' : '📌'}
      </motion.span>
      
      {/* Pulse animation when bookmarked */}
      {bookmarked && (
        <motion.div
          initial={{ scale: 0, opacity: 0.8 }}
          animate={{ scale: 2, opacity: 0 }}
          transition={{ duration: 0.6 }}
          className="absolute inset-0 rounded-full bg-yellow-400"
        />
      )}
    </motion.button>
  );
};

// Bookmarks counter for navigation
export const BookmarkCounter: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { bookmarkCount } = useBookmarks();

  if (bookmarkCount === 0) return null;

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      className={`
        inline-flex items-center px-3 py-1 rounded-full 
        bg-yellow-500 text-white text-sm font-semibold shadow-lg ${className}
      `}
    >
      <span className="mr-1">🔖</span>
      <span>{bookmarkCount}</span>
    </motion.div>
  );
};