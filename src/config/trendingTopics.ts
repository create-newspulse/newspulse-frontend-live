export type TrendingColorKey =
  | 'trending'
  | 'breaking'
  | 'sports'
  | 'gold'
  | 'fuel'
  | 'weather'
  | 'gujarat'
  | 'markets'
  | 'tech'
  | 'education'
  | '__default';

export type TrendingTopic = {
  key: string;
  label: string;
  href: string;
  colorKey: TrendingColorKey;
};

// Edit defaults here. To temporarily override without touching code, edit public/trending-topics.override.json.
// Keep this list in the exact order requested.
// NOTE: `href` values are intentionally routed to existing pages to avoid 404s.
export const DEFAULT_TRENDING_TOPICS: TrendingTopic[] = [
  { key: 'breaking', label: 'Breaking', href: '/breaking', colorKey: 'breaking' },
  { key: 'sports', label: 'Sports', href: '/sports', colorKey: 'sports' },
  { key: 'gold-rates', label: 'Gold rates', href: '/business', colorKey: 'gold' },
  { key: 'fuel-prices', label: 'Fuel Prices', href: '/business', colorKey: 'fuel' },
  { key: 'weather', label: 'Weather', href: '/national', colorKey: 'weather' },
  { key: 'gujarat', label: 'Gujarat', href: '/regional/gujarat', colorKey: 'gujarat' },
  { key: 'markets', label: 'Markets', href: '/business', colorKey: 'markets' },
  { key: 'tech-ai', label: 'Tech & AI', href: '/science-technology', colorKey: 'tech' },
  { key: 'education', label: 'Education', href: '/youth-pulse', colorKey: 'education' },
];
