import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';

export const AdvancedSearchBar = ({ onSearch, articles = [] }) => {
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // Search suggestions based on current articles
  const suggestions = useMemo(() => {
    if (!query || query.length < 2) return [];
    
    const words = articles.flatMap(article => 
      article.title.toLowerCase().split(' ')
    );
    
    const uniqueWords = Array.from(new Set(words))
      .filter(word => 
        word.length > 2 && 
        word.toLowerCase().includes(query.toLowerCase())
      )
      .slice(0, 5);
    
    return uniqueWords;
  }, [query, articles]);

  const handleSearch = (searchQuery = query) => {
    if (searchQuery.trim()) {
      onSearch({
        query: searchQuery,
        category: selectedCategory,
        timestamp: Date.now()
      });
      setIsOpen(false);
    }
  };

  return (
    <div className="relative max-w-2xl mx-auto">
      <div className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setIsOpen(true)}
          placeholder="Search news, topics, or keywords..."
          className="w-full px-6 py-4 text-lg bg-white/90 backdrop-blur-sm border-2 border-gray-200 rounded-2xl focus:border-blue-500 focus:outline-none shadow-lg transition-all duration-300"
        />
        
        <div className="absolute right-4 top-1/2 transform -translate-y-1/2 flex items-center space-x-2">
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-1 text-sm bg-gray-100 rounded-lg border-0 focus:outline-none"
          >
            <option value="all">All Categories</option>
            <option value="politics">Politics</option>
            <option value="business">Business</option>
            <option value="technology">Technology</option>
            <option value="sports">Sports</option>
            <option value="entertainment">Entertainment</option>
          </select>
          
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => handleSearch()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            🔍
          </motion.button>
        </div>
      </div>

      {/* Search Suggestions */}
      {isOpen && suggestions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full mt-2 w-full bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden"
        >
          <div className="p-3 border-b border-gray-100">
            <h4 className="text-sm font-semibold text-gray-700">Suggestions</h4>
          </div>
          {suggestions.map((suggestion, index) => (
            <motion.button
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleSearch(suggestion)}
              className="w-full px-4 py-3 text-left hover:bg-blue-50 transition-colors flex items-center space-x-3"
            >
              <span className="text-gray-400">🔍</span>
              <span className="text-gray-700">{suggestion}</span>
            </motion.button>
          ))}
        </motion.div>
      )}
    </div>
  );
};

// Hook for search functionality
export const useNewsSearch = (articles) => {
  const [searchResults, setSearchResults] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);

  const performSearch = async ({ query, category }) => {
    setIsSearching(true);
    setSearchQuery(query);

    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 300));

    const results = articles.filter(article => {
      const matchesQuery = 
        article.title.toLowerCase().includes(query.toLowerCase()) ||
        article.excerpt.toLowerCase().includes(query.toLowerCase());
      
      const matchesCategory = 
        category === 'all' || article.category === category;

      return matchesQuery && matchesCategory;
    });

    setSearchResults(results);
    setIsSearching(false);
  };

  return {
    searchResults,
    searchQuery,
    isSearching,
    performSearch,
    clearSearch: () => {
      setSearchResults([]);
      setSearchQuery('');
    }
  };
};