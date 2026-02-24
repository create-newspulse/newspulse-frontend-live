import React, { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

interface LazyImageProps {
  src: string;
  alt: string;
  width?: number;
  height?: number;
  className?: string;
  priority?: boolean;
  fallback?: string;
}

export const LazyImage: React.FC<LazyImageProps> = ({
  src,
  alt,
  width = 400,
  height = 300,
  className = '',
  priority = false,
  fallback = '/images/placeholder.jpg'
}) => {
  const [imageSrc, setImageSrc] = useState(fallback);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLDivElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!imgRef.current || priority) {
      setIsInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      {
        threshold: 0.1,
        rootMargin: '50px'
      }
    );

    observer.observe(imgRef.current);

    return () => observer.disconnect();
  }, [priority]);

  // Load image when in view
  useEffect(() => {
    if (isInView && src && src !== fallback) {
      const img = new window.Image();
      img.onload = () => {
        setImageSrc(src);
        setIsLoaded(true);
      };
      img.onerror = () => {
        setImageSrc(fallback);
        setIsLoaded(true);
      };
      img.src = src;
    }
  }, [isInView, src, fallback]);

  return (
    <div 
      ref={imgRef}
      className={`relative overflow-hidden bg-gray-200 dark:bg-gray-700 ${className}`}
      style={{ aspectRatio: `${width}/${height}` }}
    >
      {isInView && (
        <Image
          src={imageSrc}
          alt={alt}
          fill
          className={`object-cover transition-opacity duration-500 ${
            isLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          priority={priority}
          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          quality={85}
        />
      )}
      
      {!isLoaded && isInView && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      )}
    </div>
  );
};

// Optimized news card component
interface OptimizedNewsCardProps {
  article: {
    id: string;
    title: string;
    excerpt: string;
    image?: string;
    source: string;
    category: string;
    publishedAt: string;
  };
  priority?: boolean;
  onClick?: () => void;
}

export const OptimizedNewsCard: React.FC<OptimizedNewsCardProps> = ({ 
  article, 
  priority = false,
  onClick 
}) => {
  return (
    <article 
      className="group cursor-pointer bg-white dark:bg-dark-secondary rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden"
      onClick={onClick}
    >
      <div className="relative">
        <LazyImage
          src={article.image || ''}
          alt={article.title}
          width={400}
          height={250}
          className="w-full h-48 rounded-t-2xl"
          priority={priority}
        />
        
        <div className="absolute top-3 left-3">
          <span className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full">
            {article.category}
          </span>
        </div>
      </div>
      
      <div className="p-6">
        <h3 className="font-bold text-lg text-gray-900 dark:text-dark-text mb-3 line-clamp-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
          {article.title}
        </h3>
        
        <p className="text-gray-600 dark:text-dark-text-secondary text-sm mb-4 line-clamp-3">
          {article.excerpt}
        </p>
        
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <span>{article.source}</span>
          <span>{new Date(article.publishedAt).toLocaleDateString()}</span>
        </div>
      </div>
    </article>
  );
};