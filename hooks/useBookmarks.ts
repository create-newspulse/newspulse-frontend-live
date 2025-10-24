import { useState, useEffect, useCallback } from 'react';

interface BookmarkedArticle {
  id: string;
  title: string;
  excerpt: string;
  image: string;
  source: string;
  category: string;
  publishedAt: string;
  bookmarkedAt: string;
  url: string;
}

export const useBookmarks = () => {
  const [bookmarks, setBookmarks] = useState<BookmarkedArticle[]>([]);
  const [loading, setLoading] = useState(true);

  // Load bookmarks from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const savedBookmarks = localStorage.getItem('news-pulse-bookmarks');
        if (savedBookmarks) {
          setBookmarks(JSON.parse(savedBookmarks));
        }
      } catch (error) {
        console.error('Error loading bookmarks:', error);
      } finally {
        setLoading(false);
      }
    }
  }, []);

  // Save bookmarks to localStorage whenever bookmarks change
  useEffect(() => {
    if (typeof window !== 'undefined' && !loading) {
      try {
        localStorage.setItem('news-pulse-bookmarks', JSON.stringify(bookmarks));
      } catch (error) {
        console.error('Error saving bookmarks:', error);
      }
    }
  }, [bookmarks, loading]);

  const addBookmark = useCallback((article: Omit<BookmarkedArticle, 'bookmarkedAt'>) => {
    const bookmarkedArticle: BookmarkedArticle = {
      ...article,
      bookmarkedAt: new Date().toISOString()
    };
    
    setBookmarks(prev => {
      // Check if already bookmarked
      if (prev.some(bookmark => bookmark.id === article.id)) {
        return prev;
      }
      return [bookmarkedArticle, ...prev];
    });
  }, []);

  const removeBookmark = useCallback((articleId: string) => {
    setBookmarks(prev => prev.filter(bookmark => bookmark.id !== articleId));
  }, []);

  const isBookmarked = useCallback((articleId: string) => {
    return bookmarks.some(bookmark => bookmark.id === articleId);
  }, [bookmarks]);

  const toggleBookmark = useCallback((article: Omit<BookmarkedArticle, 'bookmarkedAt'>) => {
    if (isBookmarked(article.id)) {
      removeBookmark(article.id);
    } else {
      addBookmark(article);
    }
  }, [isBookmarked, addBookmark, removeBookmark]);

  const clearAllBookmarks = useCallback(() => {
    setBookmarks([]);
  }, []);

  const getBookmarksByCategory = useCallback((category: string) => {
    return bookmarks.filter(bookmark => 
      bookmark.category.toLowerCase() === category.toLowerCase()
    );
  }, [bookmarks]);

  const searchBookmarks = useCallback((query: string) => {
    return bookmarks.filter(bookmark =>
      bookmark.title.toLowerCase().includes(query.toLowerCase()) ||
      bookmark.excerpt.toLowerCase().includes(query.toLowerCase())
    );
  }, [bookmarks]);

  return {
    bookmarks,
    loading,
    addBookmark,
    removeBookmark,
    isBookmarked,
    toggleBookmark,
    clearAllBookmarks,
    getBookmarksByCategory,
    searchBookmarks,
    bookmarkCount: bookmarks.length
  };
};