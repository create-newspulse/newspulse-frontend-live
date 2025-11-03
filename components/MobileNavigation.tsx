import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRouter } from 'next/router';
import { BookmarkCounter } from './BookmarkButton';
// Reverted: remove react-i18next usage and inline LanguageSelector

interface MobileNavigationProps {
  isDark?: boolean;
  onThemeToggle?: () => void;
}

export const MobileNavigation: React.FC<MobileNavigationProps> = ({ 
  isDark = false, 
  onThemeToggle 
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const router = useRouter();

  const menuItems = [
    { label: 'Home', icon: '🏠', href: '/', active: router.pathname === '/' },
    { label: 'Breaking', icon: '🔴', href: '/breaking', active: false },
    { label: 'Categories', icon: '📂', href: '/categories', active: false },
    { label: 'Search', icon: '🔍', href: '/search', active: false },
    { label: 'Bookmarks', icon: '🔖', href: '/bookmarks', active: false },
    { label: 'Settings', icon: '⚙️', href: '/settings', active: false }
  ];

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
    // Prevent body scroll when menu is open
    document.body.style.overflow = !isMenuOpen ? 'hidden' : 'auto';
  };

  const closeMenu = () => {
    setIsMenuOpen(false);
    document.body.style.overflow = 'auto';
  };

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-dark-primary/95 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Logo */}
          <motion.h1 
            className="text-xl font-black bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent"
            whileTap={{ scale: 0.95 }}
          >
            News Pulse
          </motion.h1>

          {/* Right side controls */}
          <div className="flex items-center space-x-3">
            <BookmarkCounter className="text-xs" />
            
            {/* Theme toggle */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={onThemeToggle}
              className="p-2 rounded-full bg-gray-100 dark:bg-dark-accent text-gray-700 dark:text-dark-text"
            >
              <span className="text-lg">{isDark ? '☀️' : '🌙'}</span>
            </motion.button>

            {/* Hamburger menu */}
            <motion.button
              whileTap={{ scale: 0.9 }}
              onClick={toggleMenu}
              className="p-2 rounded-full bg-blue-600 text-white"
              aria-label="Toggle menu"
            >
              <motion.div
                animate={isMenuOpen ? { rotate: 180 } : { rotate: 0 }}
                transition={{ duration: 0.3 }}
              >
                {isMenuOpen ? '✕' : '☰'}
              </motion.div>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={closeMenu}
              className="lg:hidden fixed inset-0 bg-black/50 z-40"
            />

            {/* Menu Panel */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 20, stiffness: 100 }}
              className="lg:hidden fixed top-0 right-0 h-full w-80 max-w-[80vw] bg-white dark:bg-dark-primary shadow-2xl z-50 overflow-y-auto"
            >
              {/* Menu Header */}
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-gray-900 dark:text-dark-text">Menu</h2>
                  <motion.button
                    whileTap={{ scale: 0.9 }}
                    onClick={closeMenu}
                    className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-dark-accent"
                  >
                    <span className="text-xl">✕</span>
                  </motion.button>
                </div>
              </div>

              {/* Menu Items */}
              <div className="p-6">
                <nav className="space-y-2">
                  {menuItems.map((item, index) => (
                    <motion.a
                      key={item.href}
                      href={item.href}
                      initial={{ opacity: 0, x: 50 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      onClick={(e) => {
                        e.preventDefault();
                        closeMenu();
                        // Add navigation logic here
                      }}
                      className={`
                        flex items-center space-x-4 p-4 rounded-xl transition-all duration-200
                        ${item.active 
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' 
                          : 'hover:bg-gray-100 dark:hover:bg-dark-accent text-gray-700 dark:text-dark-text'
                        }
                      `}
                    >
                      <span className="text-xl">{item.icon}</span>
                      <span className="font-medium">{item.label}</span>
                      {item.active && (
                        <motion.div
                          layoutId="activeIndicator"
                          className="ml-auto w-2 h-2 rounded-full bg-blue-600"
                        />
                      )}
                    </motion.a>
                  ))}
                </nav>

                {/* Additional Actions */}
                <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="space-y-3">
                    <button className="w-full flex items-center justify-center space-x-2 p-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold">
                      <span>📱</span>
                      <span>Install App</span>
                    </button>
                    
                    <button className="w-full flex items-center justify-center space-x-2 p-3 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-dark-text rounded-xl">
                      <span>📧</span>
                      <span>Newsletter</span>
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Bottom Navigation (always visible on mobile) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-dark-primary/95 backdrop-blur-md border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-around py-2">
          {menuItems.slice(0, 5).map((item, index) => (
            <motion.button
              key={item.href}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                // Add navigation logic here
              }}
              className={`
                flex flex-col items-center space-y-1 p-2 rounded-lg min-w-[60px]
                ${item.active 
                  ? 'text-blue-600 dark:text-blue-400' 
                  : 'text-gray-500 dark:text-gray-400'
                }
              `}
            >
              <span className="text-lg">{item.icon}</span>
              <span className="text-xs font-medium">{item.label}</span>
              {item.active && (
                <motion.div
                  layoutId="bottomActiveIndicator"
                  className="w-1 h-1 rounded-full bg-blue-600"
                />
              )}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Spacer for bottom navigation */}
      <div className="lg:hidden h-16" />
    </>
  );
};