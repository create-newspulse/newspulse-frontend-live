import { DEFAULT_TRENDING_TOPICS, type TrendingColorKey, type TrendingTopic } from '../config/trendingTopics';

const OVERRIDE_PATH = '/trending-topics.override.json';

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

const ALLOWED_COLOR_KEYS = new Set<TrendingColorKey>([
  'trending',
  'breaking',
  'sports',
  'gold',
  'fuel',
  'weather',
  'gujarat',
  'markets',
  'tech',
  'education',
  '__default',
]);

function toSearchHref(label: string): string {
  return `/search?q=${encodeURIComponent(label)}`;
}

function normalizeTopic(raw: unknown): TrendingTopic | null {
  if (!isRecord(raw)) return null;

  const key = typeof raw.key === 'string' ? raw.key.trim() : '';
  const label = typeof raw.label === 'string' ? raw.label.trim() : '';
  const rawHref = typeof raw.href === 'string' ? raw.href.trim() : '';

  if (!key || !label) return null;

  // If override file doesn't provide a valid href, route to search temporarily.
  const href = rawHref && rawHref.startsWith('/') ? rawHref : toSearchHref(label);

  const rawColorKey = typeof raw.colorKey === 'string' ? (raw.colorKey as TrendingColorKey) : '__default';
  const colorKey: TrendingColorKey = ALLOWED_COLOR_KEYS.has(rawColorKey) ? rawColorKey : '__default';

  return { key, label, href, colorKey };
}

export async function getTrendingTopics(): Promise<TrendingTopic[]> {
  // In SSR/Node contexts, never fetch from `public/`.
  if (typeof window === 'undefined') return DEFAULT_TRENDING_TOPICS;

  try {
    const res = await fetch(OVERRIDE_PATH, { cache: 'no-store' });
    if (!res.ok) return DEFAULT_TRENDING_TOPICS;

    const json = (await res.json()) as unknown;
    if (!Array.isArray(json)) return DEFAULT_TRENDING_TOPICS;

    const seen = new Set<string>();
    const normalized = json
      .map(normalizeTopic)
      .filter((t): t is TrendingTopic => {
        if (!t) return false;
        if (seen.has(t.key)) return false;
        seen.add(t.key);
        return true;
      });

    return normalized.length ? normalized : DEFAULT_TRENDING_TOPICS;
  } catch {
    return DEFAULT_TRENDING_TOPICS;
  }
}
