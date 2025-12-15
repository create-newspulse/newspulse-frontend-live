import Head from 'next/head';
import Script from 'next/script';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useLanguage } from '../utils/LanguageContext';
import { useTheme } from '../utils/ThemeContext';
import { useLiveNews, useNewsSearch } from '../hooks/useLiveNews';
import { usePageAnalytics, usePerformanceMonitoring, trackFeatureUsage, trackSearch } from '../hooks/useAnalytics';
import { useBookmarks } from '../hooks/useBookmarks';
import { BookmarkButton, BookmarkCounter } from '../components/BookmarkButton';
import { MobileNavigation } from '../components/MobileNavigation';
import { OptimizedNewsCard } from '../components/OptimizedComponents';
import { useResourcePreloader } from '../hooks/usePerformance';
import { motion, AnimatePresence } from 'framer-motion';
import AdminContentLoader from '../components/AdminContentLoader';
// AdminDashboard widget removed per request

// Advanced Language Toggle with Premium Design
const AdvancedLanguageToggle = () => {
  const { language, setLanguage } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  
  const languages = [
    { code: 'english', label: 'English', flag: '🇺🇸', native: 'English' },
    { code: 'hindi', label: 'Hindi', flag: '🇮🇳', native: 'हिन्दी' },
    { code: 'gujarati', label: 'Gujarati', flag: '🇮🇳', native: 'ગુજરાતી' }
  ];

  const currentLang = languages.find(lang => lang.code === language) || languages[0];

  const handleLanguageChange = (langCode: string) => {
    setLanguage(langCode);
    setIsOpen(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('lang', langCode);
    }
  };

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-2 text-white hover:bg-white/20 transition-all duration-300"
      >
        <span className="text-lg">{currentLang.flag}</span>
        <span className="font-medium">{currentLang.native}</span>
        <motion.span
          animate={{ rotate: isOpen ? 180 : 0 }}
          className="text-sm"
        >
          ▼
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            className="absolute top-full mt-2 left-0 bg-white rounded-2xl shadow-2xl border border-gray-100 overflow-hidden z-50 min-w-[200px]"
          >
            {languages.map((lang, index) => (
              <motion.button
                key={lang.code}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                onClick={() => handleLanguageChange(lang.code)}
                className={`w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-gradient-to-r hover:from-blue-50 hover:to-indigo-50 transition-all duration-200 ${
                  language === lang.code ? 'bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-900' : 'text-gray-700'
                }`}
              >
                <span className="text-xl">{lang.flag}</span>
                <div>
                  <div className="font-medium">{lang.label}</div>
                  <div className="text-sm opacity-70">{lang.native}</div>
                </div>
                {language === lang.code && (
                  <span className="ml-auto text-blue-600">✓</span>
                )}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Advanced Voice Button with Premium Animation
const AdvancedVoiceButton = () => {
  const [isListening, setIsListening] = useState(false);
  const [voiceAnimation, setVoiceAnimation] = useState(false);

  const handleVoiceClick = () => {
    setIsListening(!isListening);
    setVoiceAnimation(true);
    setTimeout(() => setVoiceAnimation(false), 2000);
    // Add voice functionality here
  };

  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      onClick={handleVoiceClick}
      className={`relative inline-flex items-center px-6 py-3 rounded-full font-semibold transition-all duration-300 shadow-lg ${
        isListening 
          ? 'bg-gradient-to-r from-red-500 to-pink-600 text-white shadow-red-200' 
          : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-blue-200 hover:shadow-xl'
      }`}
    >
      <motion.span 
        animate={voiceAnimation ? { 
          scale: [1, 1.2, 1], 
          rotate: [0, 360, 0] 
        } : {}}
        className="mr-3 text-xl"
      >
        �
      </motion.span>
      <span className="relative">
        {isListening ? 'Listening...' : 'Voice Search'}
      </span>
      
      {isListening && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: [1, 1.5, 1] }}
          transition={{ repeat: Infinity, duration: 1 }}
          className="absolute -right-1 -top-1 w-3 h-3 bg-red-400 rounded-full"
        />
      )}
      
      <motion.div
        className="absolute inset-0 rounded-full"
        animate={isListening ? {
          boxShadow: [
            '0 0 0 0 rgba(59, 130, 246, 0.7)',
            '0 0 0 10px rgba(59, 130, 246, 0)',
            '0 0 0 0 rgba(59, 130, 246, 0)'
          ]
        } : {}}
        transition={{ repeat: Infinity, duration: 1.5 }}
      />
    </motion.button>
  );
};

// Advanced Dark Mode Toggle
const AdvancedDarkModeToggle = () => {
  const { isDark, toggleTheme } = useTheme();

  return (
    <motion.button
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.9 }}
      onClick={toggleTheme}
      className="relative p-3 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 transition-all duration-300 shadow-lg"
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      <motion.div
        animate={{ rotate: isDark ? 180 : 0 }}
        transition={{ duration: 0.5, ease: "easeInOut" }}
        className="text-2xl"
      >
        {isDark ? '☀️' : '🌙'}
      </motion.div>
      
      <motion.div
        className="absolute inset-0 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500"
        initial={{ scale: 0, opacity: 0 }}
        animate={isDark ? { scale: 0, opacity: 0 } : { scale: 1.2, opacity: 0.2 }}
        transition={{ duration: 0.3 }}
      />
    </motion.button>
  );
};

// Advanced Search Component
const AdvancedSearchBar = ({ onSearch, articles = [] }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (query.length > 1) {
      const mockSuggestions = [
        'breaking news', 'technology updates', 'business news', 
        'sports highlights', 'entertainment news'
      ].filter(item => item.toLowerCase().includes(query.toLowerCase()));
      setSuggestions(mockSuggestions.slice(0, 5));
    } else {
      setSuggestions([]);
    }
  }, [query]);

  const handleSearch = (searchQuery = query) => {
    if (searchQuery.trim()) {
      onSearch && onSearch(searchQuery);
      setIsOpen(false);
      setQuery('');
    }
  };

  return (
    <div className="relative max-w-2xl mx-auto mb-12">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          placeholder="Search news, topics, or keywords..."
          className="w-full px-6 py-4 text-lg bg-white/90 dark:bg-dark-secondary/90 backdrop-blur-sm border-2 border-gray-200 dark:border-gray-600 rounded-2xl focus:border-blue-500 dark:focus:border-blue-400 focus:outline-none shadow-lg transition-all duration-300 text-gray-900 dark:text-dark-text"
        />
        
        <motion.button
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => handleSearch()}
          className="absolute right-4 top-1/2 transform -translate-y-1/2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          🔍
        </motion.button>
      </div>

      {/* Search Suggestions */}
      {isOpen && suggestions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full mt-2 w-full bg-white dark:bg-dark-secondary rounded-2xl shadow-2xl border border-gray-100 dark:border-gray-600 z-50 overflow-hidden"
        >
          <div className="p-3 border-b border-gray-100 dark:border-gray-600">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-dark-text">Suggestions</h4>
          </div>
          {suggestions.map((suggestion, index) => (
            <motion.button
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleSearch(suggestion)}
              className="w-full px-4 py-3 text-left hover:bg-blue-50 dark:hover:bg-dark-accent transition-colors flex items-center space-x-3"
            >
              <span className="text-gray-400">🔍</span>
              <span className="text-gray-700 dark:text-dark-text">{suggestion}</span>
            </motion.button>
          ))}
        </motion.div>
      )}
    </div>
  );
};

const categories = [
  'Breaking',
  'Regional',
  'National',
  'International',
  'Business',
  'Sci-Tech',
  'Sports',
  'Lifestyle',
  'Glamour',
  'Web Stories',
  'Viral Videos',
  'Editorial',
  'Youth Pulse',
  'Inspiration Hub',
  'Community Reporter'
];

export default function HomePage() {
  const { language } = useLanguage();
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const router = useRouter();
  
  // Live news integration
  const { news, loading, error, lastUpdated, refreshNews, loadCategoryNews } = useLiveNews();
  const { searchResults, searchQuery, isSearching, performSearch, clearSearch } = useNewsSearch();
  
  // Analytics and bookmarks hooks
  usePageAnalytics();
  usePerformanceMonitoring();
  const { bookmarkCount } = useBookmarks();
  const { isDark, toggleTheme } = useTheme();
  const { preloadImage, preloadFont } = useResourcePreloader();
  const [mounted, setMounted] = useState(false);

  // Preload critical resources
  useEffect(() => {
    // Preload hero background images
    preloadImage('https://images.unsplash.com/photo-1569163139394-de4e4f43e4e5?w=1200');
    // Avoid preloading a non-existent local font in dev to prevent 404 noise
    // preloadFont('/fonts/inter-var.woff2');
    setMounted(true);
  }, [preloadImage, preloadFont]);
  
  // Handle search with analytics
  const handleSearch = async (query: string) => {
    const results = await performSearch(query, news);
    trackSearch(query, results.length);
    trackFeatureUsage('search', 'query_executed', query);
  };
  
  // Handle theme toggle with analytics
  const handleThemeToggle = () => {
    trackFeatureUsage('dark_mode', 'toggle', isDark ? 'light' : 'dark');
  };

  const toggleVoice = () => setIsVoiceEnabled(prev => !prev);

  // Footer Quick Links with explicit hrefs (added Community Reporter)
  const quickLinks: { label: string; href: string }[] = [
    { label: 'About Us', href: '/about' },
    { label: 'Editorial Policy', href: '/editorial' },
    { label: 'Privacy Policy', href: '/privacy-policy' },
    { label: 'Terms of Service', href: '/terms-of-service' },
    { label: 'Contact', href: '/contact' },
    { label: 'Careers', href: '/careers' },
    { label: 'Community Reporter', href: '/community-reporter' },
    { label: 'Journalist Desk', href: '/journalist-desk' }
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-dark-primary text-black dark:text-dark-text overflow-x-hidden transition-colors duration-300">
      <Head>
        <title>News Pulse</title>
        <meta name="description" content="Top headlines & live breaking news from around the world – curated by News Pulse." />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* Mobile Navigation */}
      <MobileNavigation isDark={isDark} onThemeToggle={toggleTheme} />

      {/* Breaking News Ticker */}
      <div className="bg-black overflow-hidden whitespace-nowrap py-2">
        <motion.div
          className="text-white font-bold text-base inline-block"
          initial={{ x: '100%' }}
          animate={{ x: '-100%' }}
          transition={{ duration: 30, repeat: Infinity, ease: 'linear' }}
        >
          You’re viewing the preview edition of News Pulse. Some sections and features are still being refined and new updates are rolling out step by step.
        </motion.div>
      </div>

      {/* Advanced Hero Section with Premium Design */}
      <div className="relative min-h-screen flex items-center justify-center overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
          <div className="absolute inset-0 bg-black/40"></div>
          {/* Render animated particles only on client to avoid hydration mismatch */}
          {mounted && (
            <div className="absolute inset-0" suppressHydrationWarning>
              {Array.from({ length: 20 }).map((_, i) => {
                const left = Math.random() * 100;
                const top = Math.random() * 100;
                const duration = 3 + Math.random() * 2;
                const delay = Math.random() * 2;
                return (
                  <motion.div
                    key={i}
                    className="absolute w-2 h-2 bg-white/20 rounded-full"
                    style={{ left: `${left}%`, top: `${top}%` }}
                    animate={{ y: [0, -100, 0], opacity: [0, 1, 0] }}
                    transition={{ duration, repeat: Infinity, delay }}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="relative z-10 text-center text-white px-4 max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1 }}
          >
            <motion.h1 
              className="text-6xl md:text-8xl font-black mb-6 bg-gradient-to-r from-white via-blue-100 to-cyan-200 bg-clip-text text-transparent"
              animate={{ 
                backgroundPosition: ['0%', '100%', '0%'] 
              }}
              transition={{ 
                duration: 8, 
                repeat: Infinity, 
                ease: "linear" 
              }}
            >
              News Pulse
            </motion.h1>
            
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 1 }}
              className="mb-8"
            >
              <p className="text-2xl md:text-3xl mb-4 font-light">
                Your <span className="font-bold text-cyan-300">Pulse</span> on the World's Latest News
              </p>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1, duration: 0.8 }}
              className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-12"
            >
              <AdvancedVoiceButton />
              <AdvancedLanguageToggle />
              <AdvancedDarkModeToggle />
              <BookmarkCounter />
            </motion.div>

            {/* Breaking News Ticker */}
            <motion.div
              initial={{ opacity: 0, x: -100 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 1.5, duration: 1 }}
              className="bg-red-600/90 backdrop-blur-sm rounded-full px-6 py-3 inline-flex items-center space-x-3 shadow-2xl border border-red-400/30 min-w-0"
            >
              <motion.span
                animate={{ scale: [1, 1.2, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="w-3 h-3 bg-white rounded-full"
              />
              <span className="text-sm font-semibold uppercase tracking-wider shrink-0">BREAKING NEWS</span>
              <div className="relative flex-1 overflow-hidden min-w-0" aria-live="polite">
                <motion.div
                  className="text-sm whitespace-nowrap pr-6"
                  animate={{ x: ['100%', '-100%'] }}
                  transition={{ duration: 18, repeat: Infinity, ease: 'linear' }}
                >
                  News Pulse – Preview Edition is live. Thank you for testing with us.
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        </div>

        {/* Scroll Indicator */}
        <motion.div
          animate={{ y: [0, 10, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
        >
          <div className="w-6 h-10 border-2 border-white/50 rounded-full flex justify-center">
            <motion.div
              animate={{ y: [0, 16, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-1 h-3 bg-white/70 rounded-full mt-2"
            />
          </div>
        </motion.div>
      </div>

      {/* Advanced Search Section */}
      <section className="py-16 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-dark-secondary dark:to-dark-accent">
        <div className="max-w-7xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-8"
          >
            <h2 className="text-4xl font-black text-gray-900 dark:text-dark-text mb-4">
              Find Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Story</span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-dark-text-secondary max-w-2xl mx-auto">
              Search through thousands of articles to find exactly what you're looking for
            </p>
          </motion.div>
          
          <AdvancedSearchBar onSearch={handleSearch} />
        </div>
      </section>

      {/* Breaking News & Live Updates */}
      <section className="py-20 bg-white relative">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Main Breaking News */}
            <div className="lg:col-span-2">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                className="mb-8"
                id="breaking"
              >
                <div className="flex items-center space-x-3 mb-6">
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="w-4 h-4 bg-red-500 rounded-full"
                  />
                  <h2 className="text-4xl font-black text-gray-900">Breaking News</h2>
                </div>
                
{loading ? (
                  <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-3xl p-8 border border-red-100 shadow-lg">
                    <div className="animate-pulse">
                      <div className="h-6 bg-gray-300 rounded mb-4"></div>
                      <div className="h-4 bg-gray-200 rounded mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                    </div>
                  </div>
                ) : news.length > 0 ? (
                  <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-3xl p-8 border border-red-100 dark:border-red-800 shadow-lg">
                    <motion.h3 
                      className="text-2xl font-bold text-gray-900 dark:text-dark-text mb-4 leading-tight"
                      whileHover={{ scale: 1.02 }}
                    >
                      {news[0].title}
                    </motion.h3>
                    <p className="text-gray-700 dark:text-dark-text-secondary text-lg leading-relaxed mb-6">
                      {news[0].excerpt}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-dark-text-secondary">
                        <span>📍 {news[0].source}</span>
                        <span>⏰ {new Date(news[0].publishedAt).toLocaleTimeString()}</span>
                        <span>👤 {news[0].author}</span>
                      </div>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="bg-red-600 text-white px-6 py-2 rounded-full font-semibold hover:bg-red-700 transition-colors"
                      >
                        Read More
                      </motion.button>
                    </div>
                  </div>
                ) : (
                  <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-3xl p-8 border border-red-100 shadow-lg">
                    <p className="text-gray-700 text-center">No breaking news available at the moment.</p>
                  </div>
                )}
              </motion.div>

              {/* Live Admin Content Grid */}
              <AdminContentLoader limit={8} showBreaking={true}>
                {({ news, breakingNews, loading, isConnected }) => (
                  <div className="space-y-8">
                    {/* Breaking News Banner */}
                    {breakingNews.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="bg-gradient-to-r from-red-600 to-red-700 rounded-2xl p-6 text-white shadow-xl"
                      >
                        <div className="flex items-center space-x-3 mb-4">
                          <div className="bg-white text-red-600 px-3 py-1 rounded-full text-sm font-bold animate-pulse">
                            🔴 BREAKING
                          </div>
                          <div className="text-sm opacity-90">
                            {new Date(breakingNews[0].publishedAt).toLocaleTimeString()}
                          </div>
                        </div>
                        <h3 className="text-xl font-bold mb-2">{breakingNews[0].title}</h3>
                        <p className="text-red-100">{breakingNews[0].excerpt || breakingNews[0].content?.substring(0, 150) + '...'}</p>
                      </motion.div>
                    )}

                    {/* News Grid */}
                    <div className="grid md:grid-cols-2 gap-6">
                      {loading ? (
                        // Loading skeleton
                        Array.from({ length: 4 }).map((_, index) => (
                          <div key={index} className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 animate-pulse">
                            <div className="w-12 h-12 bg-gray-200 rounded-full mb-4"></div>
                            <div className="flex space-x-2 mb-3">
                              <div className="w-16 h-6 bg-gray-200 rounded-full"></div>
                              <div className="w-20 h-6 bg-gray-200 rounded-full"></div>
                            </div>
                            <div className="w-full h-6 bg-gray-200 rounded mb-2"></div>
                            <div className="w-3/4 h-4 bg-gray-200 rounded"></div>
                          </div>
                        ))
                      ) : (
                        news.map((article, index) => (
                          <motion.div
                            key={article._id || index}
                            initial={{ opacity: 0, y: 30 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: index * 0.1 }}
                            whileHover={{ y: -5, scale: 1.02 }}
                            className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg border border-gray-100 dark:border-gray-700 cursor-pointer group relative"
                            onClick={() => window.location.href = `/news/${article._id || article.slug}`}
                          >
                            {/* Article Image or Icon */}
                            <div className="mb-4">
                              {article.image && article.image !== '/fallback.jpg' ? (
                                <img 
                                  src={article.image} 
                                  alt={article.title}
                                  className="w-full h-32 object-cover rounded-lg"
                                  loading="lazy"
                                />
                              ) : (
                                <div className="text-4xl">
                                  {article.category === 'Technology' ? '🚀' :
                                   article.category === 'Sports' ? '⚽' :
                                   article.category === 'Business' ? '💼' :
                                   article.category === 'Health' ? '🏥' :
                                   article.category === 'Environment' ? '🌍' :
                                   article.category === 'Culture' ? '🎭' : '📰'}
                                </div>
                              )}
                            </div>

                            {/* Article Meta */}
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center space-x-2">
                                <span className="bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 px-3 py-1 rounded-full text-xs font-semibold">
                                  {article.category}
                                </span>
                                <span className="text-gray-500 dark:text-gray-400 text-xs">
                                  {new Date(article.publishedAt).toLocaleString()}
                                </span>
                              </div>
                              
                              {/* Connection Status Indicator */}
                              <div className="flex items-center space-x-2">
                                {isConnected ? (
                                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="Live from Admin Panel"></div>
                                ) : (
                                  <div className="w-2 h-2 bg-yellow-500 rounded-full" title="Cached Content"></div>
                                )}
                                
                                {/* Bookmark Button */}
                                <BookmarkButton 
                                  article={article} 
                                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                                />
                              </div>
                            </div>

                            {/* Article Content */}
                            <h4 className="font-bold text-gray-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors line-clamp-2">
                              {article.title}
                            </h4>
                            
                            <p className="text-gray-600 dark:text-gray-300 text-sm line-clamp-3 leading-relaxed">
                              {article.excerpt || article.content?.substring(0, 150) + '...'}
                            </p>

                            {/* Article Stats */}
                            <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
                              <div className="flex items-center space-x-4 text-xs text-gray-500 dark:text-gray-400">
                                <span className="flex items-center space-x-1">
                                  <span>👁️</span>
                                  <span>{article.reads || 0}</span>
                                </span>
                                <span className="flex items-center space-x-1">
                                  <span>💬</span>
                                  <span>{article.engagement || 0}%</span>
                                </span>
                              </div>
                              
                              <div className="text-xs text-gray-400 dark:text-gray-500">
                                {article.source === 'fallback' ? 'Cached' : 'Live'}
                              </div>
                            </div>
                          </motion.div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </AdminContentLoader>
            </div>

            {/* Sidebar - Trending & Live Updates */}
            <div className="space-y-8">
              {/* Trending Stories */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-3xl p-6 border border-purple-100"
              >
                <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                  <span className="mr-3">🔥</span>
                  Trending Now
                </h3>
                <div className="space-y-4">
                  {[
                    "Revolutionary Medical Breakthrough Announced",
                    "Space Mission Reaches New Milestone",
                    "Economic Indicators Show Positive Trends",
                    "Cultural Exchange Program Expands Globally",
                    "Innovation in Renewable Energy Sector"
                  ].map((trend, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      whileHover={{ x: 5 }}
                      className="flex items-start space-x-3 cursor-pointer group"
                    >
                      <span className="text-purple-600 font-bold text-sm mt-1">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <p className="text-gray-700 text-sm group-hover:text-purple-700 transition-colors">
                        {trend}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>

              {/* Live Updates */}
              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="bg-gradient-to-br from-green-50 to-teal-50 rounded-3xl p-6 border border-green-100"
              >
                <h3 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
                  <motion.span
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="mr-3 text-green-500"
                  >
                    🔴
                  </motion.span>
                  Live Updates
                </h3>
                <div className="space-y-4">
                  {[
                    { time: "2 min", update: "Market closes with significant gains" },
                    { time: "5 min", update: "Press conference concludes successfully" },
                    { time: "12 min", update: "International summit begins in Geneva" },
                    { time: "18 min", update: "New research findings published" },
                    { time: "25 min", update: "Technology expo attracts record attendance" }
                  ].map((item, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.5, delay: index * 0.1 }}
                      className="flex items-start space-x-3 pb-3 border-b border-green-100/50 last:border-b-0"
                    >
                      <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full font-semibold">
                        {item.time}
                      </span>
                      <p className="text-gray-700 text-sm flex-1">
                        {item.update}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* Advanced Categories Section */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-40">
          <div className="w-full h-full" style={{
            backgroundImage: `url("data:image/svg+xml,%3csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3e%3cg fill='none' fill-rule='evenodd'%3e%3cg fill='%239C92AC' fill-opacity='0.05'%3e%3ccircle cx='30' cy='30' r='2'/%3e%3c/g%3e%3c/g%3e%3c/svg%3e")`,
          }} />
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center mb-16"
          >
            <h2 className="text-5xl font-black text-gray-900 mb-4">
              Explore <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">Categories</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Dive deep into the stories that matter to you
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {categories.map((category, index) => {
              const categoryIcons: Record<string, string> = {
                'Breaking': '🛑',
                'Regional': '🗺️',
                'National': '🏛️',
                'International': '🌍',
                'Business': '💼',
                'Sci-Tech': '�',
                'Sports': '⚽',
                'Lifestyle': '🧘',
                'Glamour': '✨',
                'Web Stories': '📚',
                'Viral Videos': '🎥',
                'Editorial': '🖋️',
                'Youth Pulse': '🎓',
                'Inspiration Hub': '🌄'
                , 'Community Reporter': '📝'
              };

              const routeMap: Record<string, string | { type: 'anchor', target: string }> = {
                'Breaking': { type: 'anchor', target: '#breaking' },
                'Regional': '/regional',
                'National': '/national',
                'International': '/international',
                'Business': '/business',
                'Sci-Tech': '/science-technology',
                'Sports': '/sports',
                'Lifestyle': '/lifestyle',
                'Glamour': '/glamour',
                'Web Stories': '/web-stories',
                'Viral Videos': '/viral-videos',
                'Editorial': '/editorial',
                'Youth Pulse': '/youth-pulse',
                'Inspiration Hub': '/inspiration-hub'
                , 'Community Reporter': '/community-reporter'
              };

              const handleCategoryClick = (cat: string) => {
                const target = routeMap[cat];
                if (!target) return;
                if (typeof target === 'string') {
                  router.push(target);
                } else if (target.type === 'anchor') {
                  // Smooth scroll to anchor
                  const el = document.querySelector(target.target);
                  if (el) {
                    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  } else {
                    // Fallback: navigate to home with hash
                    router.push('/' + target.target);
                  }
                }
              };
              
              return (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 50 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: index * 0.1 }}
                  whileHover={{ 
                    y: -10, 
                    scale: 1.05,
                    boxShadow: "0 20px 40px rgba(0,0,0,0.1)"
                  }}
                  className="group cursor-pointer"
                  onClick={() => handleCategoryClick(category)}
                >
                  <div className="bg-white rounded-3xl p-8 text-center shadow-lg border border-gray-100 hover:border-blue-200 transition-all duration-300 h-full">
                    <motion.div
                      whileHover={{ scale: 1.2, rotate: 10 }}
                      className="text-6xl mb-6"
                    >
                      {categoryIcons[category] || '📰'}
                    </motion.div>
                    
                    <h3 className="text-2xl font-bold text-gray-800 mb-3 group-hover:text-blue-600 transition-colors">
                      {category}
                    </h3>
                    
                    <p className="text-gray-600 text-sm mb-6">
                      {category === 'Community Reporter' ? 'Submit your local stories & tips' : 'Latest updates and breaking stories'}
                    </p>
                    
                    <motion.div
                      className="w-full h-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full"
                      initial={{ scaleX: 0 }}
                      whileInView={{ scaleX: 1 }}
                      transition={{ duration: 0.8, delay: index * 0.1 + 0.5 }}
                    />
                    
                    <div className="mt-4 text-blue-600 font-semibold text-sm group-hover:text-purple-600 transition-colors">
                      {category === 'Community Reporter' ? 'Contribute Now →' : 'Explore Now →'}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Premium Features Section */}
      <section className="py-20 bg-gradient-to-r from-blue-900 via-purple-900 to-indigo-900 relative overflow-hidden">
        <div className="absolute inset-0 bg-black/30"></div>
        <div className="relative z-10 max-w-7xl mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center text-white mb-16"
          >
            <h2 className="text-5xl font-black mb-4">
              Why Choose <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">News Pulse</span>?
            </h2>
            <p className="text-xl opacity-90 max-w-3xl mx-auto">
              Experience journalism redefined with cutting-edge technology and unparalleled storytelling
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: '🚀',
                title: 'AI-Powered Insights',
                description: 'Advanced algorithms deliver personalized news recommendations tailored to your interests'
              },
              {
                icon: '⚡',
                title: 'Real-time Updates',
                description: 'Stay ahead with lightning-fast breaking news notifications and live coverage'
              },
              {
                icon: '🎯',
                title: 'Fact-Checked Content',
                description: 'Trust in our rigorous verification process ensuring accuracy and reliability'
              }
            ].map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: index * 0.2 }}
                className="text-center bg-white/10 backdrop-blur-md rounded-3xl p-8 border border-white/20"
              >
                <motion.div
                  whileHover={{ scale: 1.2, rotate: 10 }}
                  className="text-6xl mb-6"
                >
                  {feature.icon}
                </motion.div>
                <h3 className="text-2xl font-bold mb-4 text-white">{feature.title}</h3>
                <p className="text-white/80 leading-relaxed">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Premium App Download Section */}
      <section className="py-20 bg-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 to-purple-50"></div>
        <div className="relative z-10 max-w-7xl mx-auto px-4">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-5xl font-black text-gray-900 mb-6">
                Take <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-purple-600">News Pulse</span> Everywhere
              </h2>
              <p className="text-xl text-gray-600 mb-8 leading-relaxed">
                Download our award-winning mobile app and never miss a story. Available on all platforms with exclusive features.
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4 mb-8">
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center space-x-3 bg-black text-white px-6 py-4 rounded-2xl cursor-pointer shadow-lg"
                >
                  <span className="text-2xl">📱</span>
                  <div>
                    <div className="text-sm opacity-80">Download on the</div>
                    <div className="font-bold">App Store</div>
                  </div>
                </motion.div>
                
                <motion.div
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  className="flex items-center space-x-3 bg-gradient-to-r from-green-500 to-blue-600 text-white px-6 py-4 rounded-2xl cursor-pointer shadow-lg"
                >
                  <span className="text-2xl">🤖</span>
                  <div>
                    <div className="text-sm opacity-80">Get it on</div>
                    <div className="font-bold">Google Play</div>
                  </div>
                </motion.div>
              </div>

              <div className="flex items-center space-x-8 text-sm text-gray-600">
                <div className="flex items-center space-x-2">
                  <span className="text-yellow-500">⭐⭐⭐⭐⭐</span>
                  <span>4.8 Rating</span>
                </div>
                <div>1M+ Downloads</div>
                <div>Available in 12 Languages</div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 50 }}
              whileInView={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8 }}
              className="relative"
            >
              <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-3xl p-8 text-white text-center shadow-2xl">
                <div className="text-8xl mb-4">📱</div>
                <h3 className="text-2xl font-bold mb-2">Mobile App Preview</h3>
                <p className="opacity-90">Experience News Pulse on the go</p>
                <div className="mt-6 grid grid-cols-3 gap-4 text-sm">
                  <div>📊 Analytics</div>
                  <div>🔔 Notifications</div>
                  <div>📖 Offline Reading</div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Premium Footer */}
      <footer className="bg-gray-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/20 to-purple-900/20"></div>
        <div className="relative z-10">
          {/* Main Footer Content */}
          <div className="py-16 px-4 max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-4 md:grid-cols-2 gap-8">
              {/* Brand Section */}
              <div className="lg:col-span-2">
                <motion.h3 
                  className="text-4xl font-black mb-4 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent"
                  whileHover={{ scale: 1.05 }}
                >
                  News Pulse
                </motion.h3>
                <p className="text-gray-300 text-lg leading-relaxed mb-6 max-w-md">
                  Your trusted source for breaking news, in-depth analysis, and stories that matter. 
                  Delivering truth with integrity since our inception.
                </p>
                <div className="flex space-x-4">
                  {[
                    { name: 'Facebook', icon: '📘' },
                    { name: 'Twitter', icon: '🐦' },
                    { name: 'YouTube', icon: '📺' },
                    { name: 'LinkedIn', icon: '💼' },
                    { name: 'Instagram', icon: '📷' }
                  ].map((social, index) => (
                    <motion.a
                      key={index}
                      href="#"
                      whileHover={{ scale: 1.2, y: -2 }}
                      className="w-12 h-12 bg-white/10 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white/20 transition-all duration-300"
                    >
                      <span className="text-xl">{social.icon}</span>
                    </motion.a>
                  ))}
                </div>
              </div>

              {/* Quick Links */}
              <div>
                <h4 className="text-xl font-bold mb-6 text-blue-400">Quick Links</h4>
                <ul className="space-y-3">
                  {quickLinks.map((item) => (
                    <li key={item.label}>
                      <motion.a
                        href={item.href}
                        whileHover={{ x: 5 }}
                        className="text-gray-300 hover:text-white transition-colors duration-200"
                      >
                        {item.label}
                      </motion.a>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Business */}
              <div>
                <h4 className="text-xl font-bold mb-6 text-purple-400">Business</h4>
                <ul className="space-y-3">
                  {['Advertise With Us', 'Media Kit', 'Partnerships', 'RSS Feeds', 'API Access', 'Licensing'].map((link, index) => (
                    <li key={index}>
                      <motion.a
                        href="#"
                        whileHover={{ x: 5 }}
                        className="text-gray-300 hover:text-white transition-colors duration-200"
                      >
                        {link}
                      </motion.a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Footer Bottom */}
          <div className="border-t border-gray-800 py-8 px-4">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center">
              <div className="text-gray-400 text-sm mb-4 md:mb-0">
                © {new Date().getFullYear()} News Pulse. All rights reserved. | Powered by Innovation
              </div>
              <div className="flex items-center space-x-6 text-sm text-gray-400">
                <span>🌍 Available in 12 languages</span>
                <span>📱 Mobile & Web</span>
                <span>🔒 Secure & Private</span>
              </div>
            </div>
          </div>
        </div>
      </footer>

      {/* AdminDashboard widget removed */}
    </div>
  );
}
