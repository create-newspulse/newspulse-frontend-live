import { DEFAULT_TRENDING_TOPICS, type TrendingTopic } from '../src/config/trendingTopics';
import { getPublicApiBaseUrl } from './publicApiBase';
import type { RouteLocale } from './localizedArticleFields';

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

function getApiOrigin(): string {
  return trimTrailingSlashes(getPublicApiBaseUrl() || '');
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
  throw new Error('Invalid legacy trending response');
}

function toSearchHref(label: string): string {
  return `/search?q=${encodeURIComponent(label)}`;
}

function normalizeTopic(raw: unknown): TrendingTopic | null {
  if (!isRecord(raw)) return null;

  const editorial = raw.source === 'editorial';
  const key = typeof raw.key === 'string' ? raw.key.trim() : '';
  const label = typeof raw.label === 'string' ? (editorial ? raw.label : raw.label.trim()) : '';
  const rawHref = typeof raw.href === 'string' ? raw.href.trim() : '';
  const rawColorKey = typeof raw.colorKey === 'string' ? raw.colorKey.trim() : '';

  if (!key || !label.trim() || !rawColorKey) return null;
  if (editorial && rawHref !== `/topic/${encodeURIComponent(key)}`) return null;

  // If backend doesn't provide a valid href, route to search temporarily.
  // (UI/route still works and avoids a "dead" chip.)
  const href = rawHref && rawHref.startsWith('/') ? rawHref : toSearchHref(label);
  const colorKey = DEFAULT_TRENDING_TOPICS.find((topic) => topic.colorKey === rawColorKey)?.colorKey
    ?? (rawColorKey === 'trending' ? 'trending' : '__default');

  return {
    key,
    label,
    href,
    colorKey,
    ...(editorial ? { source: 'editorial' as const } : {}),
  };
}

export function normalizeTrendingTopics(payload: unknown): TrendingTopic[] {
  const seen = new Set<string>();
  const rawItems = normalizeItems(payload);
  const normalized = rawItems.map(normalizeTopic);
  if (normalized.some((topic) => !topic)) console.warn('[trending-topics] Discarding malformed trending items');
  return normalized.filter((topic): topic is TrendingTopic => {
    if (!topic) return false;
    const key = topic.key.toLowerCase();
    if ((!topic.source && key === 'trending') || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function mergeTrendingTopics(editorial: TrendingTopic[], legacy: TrendingTopic[]): TrendingTopic[] {
  const keys = new Set<string>();
  const editorialHrefs = new Set<string>();
  const items = editorial.filter((topic) => {
    const key = topic.key.toLowerCase();
    if (keys.has(key) || editorialHrefs.has(topic.href)) return false;
    keys.add(key);
    editorialHrefs.add(topic.href);
    return true;
  });
  // Gold, fuel and markets intentionally share /business; only editorial hrefs take precedence.
  for (const topic of legacy) {
    const key = topic.key.toLowerCase();
    if (keys.has(key) || editorialHrefs.has(topic.href)) continue;
    keys.add(key);
    items.push(topic);
  }
  return items;
}

export function getTrendingTopicsRequestUrl(lang: RouteLocale = 'en'): string {
  const base = getApiOrigin();
  return `${base}/api/public/trending-topics?lang=${lang}`;
}

export async function getTrendingTopics(lang: RouteLocale = 'en'): Promise<TrendingTopic[]> {
  // In SSR/Node contexts, return defaults (never fetch from backend in SSR here).
  if (typeof window === 'undefined') return DEFAULT_TRENDING_TOPICS;

  try {
    const url = getTrendingTopicsRequestUrl(lang);
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(`Trending request failed (${res.status})`);

    const json = (await res.json()) as unknown;
    const topics = normalizeTrendingTopics(json);

    // If API returns empty, keep defaults.
    return topics.length ? topics : DEFAULT_TRENDING_TOPICS;
  } catch (error) {
    console.warn('[trending-topics] Using default shortcuts', error);
    return DEFAULT_TRENDING_TOPICS;
  }
}
