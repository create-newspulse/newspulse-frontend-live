import { useEffect, useRef } from 'react';

// Extend Window interface for gtag
declare global {
  interface Window {
    gtag: (command: string, action: string, parameters?: any) => void;
  }
}

// Enhanced analytics for News Pulse
export const usePageAnalytics = () => {
  const startTimeRef = useRef<number>(Date.now());
  const isVisibleRef = useRef<boolean>(true);
  const readingTimeRef = useRef<number>(0);

  useEffect(() => {
    // Track page view
    if (typeof window !== 'undefined' && window.gtag) {
      window.gtag('event', 'page_view', {
        page_title: document.title,
        page_location: window.location.href,
        custom_parameter: 'homepage_visit'
      });
    }

    // Monitor visibility changes
    const handleVisibilityChange = () => {
      if (document.hidden) {
        isVisibleRef.current = false;
        readingTimeRef.current += Date.now() - startTimeRef.current;
      } else {
        isVisibleRef.current = true;
        startTimeRef.current = Date.now();
      }
    };

    // Track total engagement time on page unload
    const handleBeforeUnload = () => {
      const totalTime = readingTimeRef.current + 
        (isVisibleRef.current ? Date.now() - startTimeRef.current : 0);
      
      if (typeof window !== 'undefined' && window.gtag) {
        window.gtag('event', 'engagement_time', {
          engagement_time_msec: totalTime,
          page_title: document.title,
          page_location: window.location.href
        });
      }

      // Send to custom analytics endpoint
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/api/analytics/engagement', JSON.stringify({
          url: window.location.href,
          title: document.title,
          timeSpent: totalTime,
          timestamp: Date.now()
        }));
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);
};

// Track article interactions
export const trackArticleClick = (articleId: string, title: string, category: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'article_click', {
      article_id: articleId,
      article_title: title,
      article_category: category,
      event_category: 'engagement',
      event_label: 'article_interaction'
    });
  }

  // Send to custom analytics
  fetch('/api/analytics/article-click', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      articleId,
      title,
      category,
      timestamp: Date.now(),
      referrer: document.referrer,
      userAgent: navigator.userAgent
    })
  }).catch(console.error);
};

// Track search queries
export const trackSearch = (query: string, resultsCount: number) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'search', {
      search_term: query,
      results_count: resultsCount,
      event_category: 'search',
      event_label: 'news_search'
    });
  }

  fetch('/api/analytics/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query,
      resultsCount,
      timestamp: Date.now()
    })
  }).catch(console.error);
};

// Track feature usage
export const trackFeatureUsage = (feature: string, action: string, value?: string) => {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', 'feature_usage', {
      feature_name: feature,
      action_type: action,
      feature_value: value,
      event_category: 'user_interaction'
    });
  }

  fetch('/api/analytics/feature-usage', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      feature,
      action,
      value,
      timestamp: Date.now()
    })
  }).catch(console.error);
};

// Performance monitoring hook
export const usePerformanceMonitoring = () => {
  useEffect(() => {
    // Monitor Core Web Vitals
    const observer = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => {
        if (typeof window !== 'undefined' && window.gtag) {
          switch (entry.entryType) {
            case 'largest-contentful-paint':
              window.gtag('event', 'web_vitals', {
                name: 'LCP',
                value: Math.round(entry.startTime),
                event_category: 'performance'
              });
              break;
            
            case 'first-input':
              window.gtag('event', 'web_vitals', {
                name: 'FID',  
                value: Math.round((entry as any).processingStart - entry.startTime),
                event_category: 'performance'
              });
              break;
            
            case 'layout-shift':
              if (!(entry as any).hadRecentInput) {
                window.gtag('event', 'web_vitals', {
                  name: 'CLS',
                  value: Math.round((entry as any).value * 1000),
                  event_category: 'performance'
                });
              }
              break;
          }
        }
      });
    });

    if ('PerformanceObserver' in window) {
      observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
    }

    return () => {
      if ('PerformanceObserver' in window) {
        observer.disconnect();
      }
    };
  }, []);
};