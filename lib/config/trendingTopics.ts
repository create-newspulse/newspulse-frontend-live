export type TrendingTopicColorKey =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'muted'
  | '__default';

export type TrendingTopic = {
  key: string;
  label: string;
  href: string;
  colorKey: TrendingTopicColorKey;
};

export const DEFAULT_TRENDING_TOPICS: TrendingTopic[] = [
  { key: 'breaking', label: 'Breaking', href: '/breaking', colorKey: '__default' },
  { key: 'sports', label: 'Sports', href: '/sports', colorKey: '__default' },
  { key: 'markets', label: 'Markets', href: '/topic/markets', colorKey: '__default' },
  { key: 'tech-ai', label: 'Tech & AI', href: '/topic/tech-ai', colorKey: '__default' },
];
