import Link from 'next/link';
import React from 'react';

type HeaderLogoProps = {
  className?: string;
};

const BRAND_TEXT_COLORS = {
  news: '#00193A',
  pulse: '#0656EC',
  tagline: '#64748B',
} as const;

export default function HeaderLogo({ className = '' }: HeaderLogoProps) {
  return (
    <Link
      href="/"
      className={`inline-flex min-w-0 items-center ${className}`}
      style={{ gap: 10 }}
      aria-label="News Pulse home"
    >
      <img
        src="/brand/news-pulse-final-mark.png"
        alt=""
        aria-hidden="true"
        className="newsPulseLogo block h-auto shrink-0 object-contain"
        style={{ width: 'clamp(48px, 5.5vw, 84px)', height: 'auto', objectFit: 'contain', flexShrink: 0, opacity: 1, filter: 'none' }}
      />
      <span className="flex shrink-0 flex-col justify-center" style={{ rowGap: 2 }}>
        <span
          className="brandName block whitespace-nowrap font-bold"
          style={{ fontSize: 'clamp(15px, 1.25vw, 18px)', lineHeight: 1.05 }}
        >
          <span className="brandNews" style={{ color: BRAND_TEXT_COLORS.news }}>News</span>{' '}
          <span className="brandPulse" style={{ color: BRAND_TEXT_COLORS.pulse }}>Pulse</span>
        </span>
        <span
          className="brandTagline block whitespace-nowrap font-medium"
          style={{ color: BRAND_TEXT_COLORS.tagline, fontSize: 'clamp(12px, 0.95vw, 13px)', lineHeight: 1.15 }}
        >
          Your pulse on the world’s latest news
        </span>
      </span>
    </Link>
  );
}