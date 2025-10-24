import { useEffect, useState } from 'react';

interface PerformanceMetrics {
  lcp: number | null; // Largest Contentful Paint
  fid: number | null; // First Input Delay
  cls: number | null; // Cumulative Layout Shift
  ttfb: number | null; // Time to First Byte
  fcp: number | null; // First Contentful Paint
}

export const usePerformanceMetrics = () => {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    lcp: null,
    fid: null,
    cls: null,
    ttfb: null,
    fcp: null
  });

  useEffect(() => {
    // Performance Observer for Core Web Vitals
    if (typeof window !== 'undefined' && 'PerformanceObserver' in window) {
      const observer = new PerformanceObserver((list) => {
        list.getEntries().forEach((entry) => {
          switch (entry.entryType) {
            case 'largest-contentful-paint':
              setMetrics(prev => ({ ...prev, lcp: entry.startTime }));
              break;
            case 'first-input':
              const fidEntry = entry as any;
              setMetrics(prev => ({ 
                ...prev, 
                fid: fidEntry.processingStart - fidEntry.startTime 
              }));
              break;
            case 'layout-shift':
              const clsEntry = entry as any;
              if (!clsEntry.hadRecentInput) {
                setMetrics(prev => ({ 
                  ...prev, 
                  cls: (prev.cls || 0) + clsEntry.value 
                }));
              }
              break;
          }
        });
      });

      try {
        observer.observe({ entryTypes: ['largest-contentful-paint', 'first-input', 'layout-shift'] });
      } catch (e) {
        console.warn('Performance Observer not supported:', e);
      }

      // Navigation timing for TTFB and FCP
      const navigationEntry = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      if (navigationEntry) {
        setMetrics(prev => ({
          ...prev,
          ttfb: navigationEntry.responseStart - navigationEntry.requestStart,
        }));
      }

      // First Contentful Paint
      const fcpEntry = performance.getEntriesByName('first-contentful-paint')[0];
      if (fcpEntry) {
        setMetrics(prev => ({ ...prev, fcp: fcpEntry.startTime }));
      }

      return () => observer.disconnect();
    }
  }, []);

  return metrics;
};

// Resource preloader hook
export const useResourcePreloader = () => {
  const preloadResource = (href: string, as: string, type?: string) => {
    if (typeof document !== 'undefined') {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = href;
      link.as = as;
      if (type) link.type = type;
      document.head.appendChild(link);
    }
  };

  const preloadImage = (src: string) => {
    if (typeof window !== 'undefined') {
      const img = new Image();
      img.src = src;
    }
  };

  const preloadFont = (href: string) => {
    preloadResource(href, 'font', 'font/woff2');
  };

  return { preloadResource, preloadImage, preloadFont };
};

// Memory usage monitor
export const useMemoryMonitor = () => {
  const [memoryInfo, setMemoryInfo] = useState<any>(null);

  useEffect(() => {
    const updateMemoryInfo = () => {
      if ('memory' in performance) {
        setMemoryInfo((performance as any).memory);
      }
    };

    updateMemoryInfo();
    const interval = setInterval(updateMemoryInfo, 10000); // Every 10 seconds

    return () => clearInterval(interval);
  }, []);

  return memoryInfo;
};

// Connection speed detector
export const useConnectionSpeed = () => {
  const [connectionSpeed, setConnectionSpeed] = useState<string>('unknown');
  const [isSlowConnection, setIsSlowConnection] = useState(false);

  useEffect(() => {
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      
      const updateConnection = () => {
        setConnectionSpeed(connection.effectiveType || 'unknown');
        setIsSlowConnection(['slow-2g', '2g'].includes(connection.effectiveType));
      };

      updateConnection();
      connection.addEventListener('change', updateConnection);

      return () => connection.removeEventListener('change', updateConnection);
    }
  }, []);

  return { connectionSpeed, isSlowConnection };
};

// Performance budget checker
export const usePerformanceBudget = () => {
  const metrics = usePerformanceMetrics();
  const { isSlowConnection } = useConnectionSpeed();

  const budgets = {
    lcp: 2500, // 2.5 seconds
    fid: 100,  // 100 milliseconds
    cls: 0.1,  // 0.1
    ttfb: 600, // 600 milliseconds
    fcp: 1800  // 1.8 seconds
  };

  const violations = Object.entries(metrics)
    .filter(([key, value]) => {
      if (value === null) return false;
      const budget = budgets[key as keyof typeof budgets];
      return value > budget;
    })
    .map(([key]) => key);

  const score = Object.entries(metrics).reduce((acc, [key, value]) => {
    if (value === null) return acc;
    const budget = budgets[key as keyof typeof budgets];
    const ratio = Math.min(value / budget, 2); // Cap at 2x budget
    return acc + (1 - ratio / 2) * 20; // Each metric worth 20 points
  }, 0);

  return {
    metrics,
    violations,
    score: Math.max(0, Math.min(100, score)),
    isSlowConnection,
    recommendations: violations.map(violation => {
      switch (violation) {
        case 'lcp':
          return 'Optimize largest contentful paint by improving server response times and optimizing images';
        case 'fid':
          return 'Reduce first input delay by minimizing JavaScript execution time';
        case 'cls':
          return 'Improve cumulative layout shift by setting image dimensions and avoiding dynamic content insertion';
        case 'ttfb':
          return 'Reduce time to first byte by optimizing server configuration and using CDN';
        case 'fcp':
          return 'Improve first contentful paint by optimizing critical rendering path';
        default:
          return `Optimize ${violation} performance`;
      }
    })
  };
};