import { DEFAULT_TRENDING_TOPICS, type TrendingTopic } from '../src/config/trendingTopics';

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

function getApiOrigin(): string {
  return trimTrailingSlashes(process.env.NEXT_PUBLIC_API_ORIGIN || 'http://localhost:5000');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function normalizeItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (isRecord(payload)) {
    const items = payload.items;
    if (Array.isArray(items)) return items;
  }
  return [];
}

function toSearchHref(label: string): string {
  return `/search?q=${encodeURIComponent(label)}`;
}

function normalizeTopic(raw: unknown): TrendingTopic | null {
  if (!isRecord(raw)) return null;

  const key = typeof raw.key === 'string' ? raw.key.trim() : '';
  const label = typeof raw.label === 'string' ? raw.label.trim() : '';
  const rawHref = typeof raw.href === 'string' ? raw.href.trim() : '';
  const colorKey = typeof raw.colorKey === 'string' ? raw.colorKey.trim() : '';

  if (!key || !label || !colorKey) return null;

  // If backend doesn't provide a valid href, route to search temporarily.
  // (UI/route still works and avoids a "dead" chip.)
  const href = rawHref && rawHref.startsWith('/') ? rawHref : toSearchHref(label);

  return {
    key,
    label,
    href,
    // Keep runtime validation permissive, but fall back to __default if unexpected.
    colorKey: (colorKey as TrendingTopic['colorKey']) || '__default',
  };
}

export function getTrendingTopicsRequestUrl(): string {
  return `${getApiOrigin()}/api/public/trending-topics`;
}

export async function getTrendingTopics(): Promise<TrendingTopic[]> {
  // In SSR/Node contexts, return defaults (never fetch from backend in SSR here).
  if (typeof window === 'undefined') return DEFAULT_TRENDING_TOPICS;

  try {
    const url = getTrendingTopicsRequestUrl();
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return DEFAULT_TRENDING_TOPICS;

    const json = (await res.json()) as unknown;
    const rawItems = normalizeItems(json);

    const seen = new Set<string>();
    const topics = rawItems
      .map(normalizeTopic)
      .filter((t): t is TrendingTopic => {
        if (!t) return false;

        // The UI already renders a special "Trending" label chip.
        // Prevent duplicates if backend accidentally includes it.
        const normalizedKey = t.key.toLowerCase();
        if (normalizedKey === 'trending') return false;

        // Case-insensitive de-dupe by key, keep first occurrence.
        if (seen.has(normalizedKey)) return false;
        seen.add(normalizedKey);
        return true;
      });

    // If API returns empty, keep defaults.
    return topics.length ? topics : DEFAULT_TRENDING_TOPICS;
  } catch {
    return DEFAULT_TRENDING_TOPICS;
  }
}
