// Enhanced analytics for News Pulse
import { useEffect } from 'react';

// Performance monitoring
export const usePerformanceMonitoring = () => {
  useEffect(() => {
    // Monitor Core Web Vitals
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        switch (entry.entryType) {
          case 'largest-contentful-paint':
            console.log('LCP:', entry.startTime);
            // Send to analytics
            gtag('event', 'web_vitals', {
              name: 'LCP',
              value: Math.round(entry.startTime),
              custom_parameter: 'performance'
            });
            break;
          
          case 'first-input':
            console.log('FID:', entry.processingStart - entry.startTime);
            gtag('event', 'web_vitals', {
              name: 'FID',
              value: Math.round(entry.processingStart - entry.startTime),
              custom_parameter: 'performance'
            });
            break;
          
          case 'layout-shift':
            if (!entry.hadRecentInput) {
              console.log('CLS:', entry.value);
              gtag('event', 'web_vitals', {
                name: 'CLS',
                value: Math.round(entry.value * 1000),
                custom_parameter: 'performance'
              });
            }
            break;
        }
      });
    });

    observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });

    return () => observer.disconnect();
  }, []);
};

// User engagement tracking
export const useEngagementTracking = () => {
  useEffect(() => {
    let startTime = Date.now();
    let isVisible = true;
    let readingTime = 0;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        isVisible = false;
        readingTime += Date.now() - startTime;
      } else {
        isVisible = true;
        startTime = Date.now();
      }
    };

    const handleBeforeUnload = () => {
      const totalTime = readingTime + (isVisible ? Date.now() - startTime : 0);
      
      gtag('event', 'page_engagement', {
        engagement_time_msec: totalTime,
        page_title: document.title,
        page_location: window.location.href
      });
      
      // Send to custom analytics endpoint
      navigator.sendBeacon('/api/analytics/engagement', JSON.stringify({
        url: window.location.href,
        title: document.title,
        timeSpent: totalTime,
        timestamp: Date.now()
      }));
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
};

// Article interaction tracking
export const trackArticleInteraction = (action, articleId, metadata = {}) => {
  gtag('event', 'article_interaction', {
    action,
    article_id: articleId,
    ...metadata
  });

  // Send to custom analytics
  fetch('/api/analytics/article-interaction', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      articleId,
      metadata,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      referrer: document.referrer
    })
  }).catch(console.error);
};

// Search analytics
export const trackSearchQuery = (query, category, resultsCount) => {
  gtag('event', 'search', {
    search_term: query,
    category,
    results_count: resultsCount
  });

  fetch('/api/analytics/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      category,
      resultsCount,
      timestamp: Date.now()
    })
  }).catch(console.error);
};