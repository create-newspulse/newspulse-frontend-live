import { DEFAULT_TRENDING_TOPICS, type TrendingTopic } from '../src/config/trendingTopics';
import { getPublicApiBaseUrl } from './publicApiBase';
import type { RouteLocale } from './localizedArticleFields';
import { EDITORIAL_TOPICS_TIMEOUT_MS } from './publicEditorialTopics';
import { withPublicReadDeadline } from './publicReadDeadline';

function trimTrailingSlashes(value: string): string {
  return value.replace(/\/+$/, '');
}

function getApiOrigin(): string {
  return trimTrailingSlashes(getPublicApiBaseUrl() || '');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

const destinationSources = new Set(['approved-policy', 'founder-override', 'legacy-unclassified', 'search-fallback']);
const backendColors = new Map<string, TrendingTopic['colorKey']>([
  ['blue', 'trending'], ['red', 'breaking'], ['green', 'sports'], ['yellow', 'gold'], ['orange', 'fuel'],
  ['sky', 'weather'], ['purple', 'gujarat'], ['emerald', 'markets'], ['indigo', 'tech'], ['teal', 'education'],
]);

function isPublicPath(value: unknown): value is string {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    && value === value.trim() && !/[\\\u0000-\u001f\u007f]/u.test(value);
}

function normalizeItems(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (isRecord(payload)) {
    if (payload.ok === false || payload.success === false) throw new Error('Unsuccessful trending response');
    if ('data' in payload) {
      const data = payload.data;
      // Old/cached envelopes contain stored hrefs, not authoritative public destinations.
      if (payload.success !== true || !isRecord(data) || data.source !== 'db'
        || data.destinationPolicyVersion !== 1 || !Array.isArray(data.items)) {
        throw new Error('Trending shortcut destination policy unavailable');
      }
      return data.items.map((row: unknown) => {
        if (!isRecord(row) || typeof row.destinationSource !== 'string' || !destinationSources.has(row.destinationSource)
          || !isPublicPath(row.publicHref) || typeof row.key !== 'string' || !row.key.trim()
          || typeof row.label !== 'string' || !row.label.trim() || typeof row.colorKey !== 'string' || !row.colorKey.trim()) {
          throw new Error('Invalid trending shortcut destination contract');
        }
        return { key: row.key, label: row.label, href: row.publicHref, colorKey: backendColors.get(row.colorKey) ?? row.colorKey };
      });
    }
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
  const href = isPublicPath(rawHref) ? rawHref : toSearchHref(label);
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

export type TrendingTopicsRead = {
  items: TrendingTopic[];
  authoritative: boolean;
  legacyOnlyFallback?: true;
  shortcutSnapshot?: TrendingTopic[];
};

export async function readTrendingTopics(lang: RouteLocale = 'en', signal?: AbortSignal): Promise<TrendingTopicsRead> {
  if (typeof window === 'undefined') return { items: DEFAULT_TRENDING_TOPICS, authoritative: false };

  try {
    return await withPublicReadDeadline(EDITORIAL_TOPICS_TIMEOUT_MS, async (readSignal) => {
      const res = await fetch(getTrendingTopicsRequestUrl(lang), { cache: 'no-store', signal: readSignal });
      if (!res.ok) throw new Error(`Trending request failed (${res.status})`);
      const json: unknown = await res.json();
      if (isRecord(json) && (json.ok === false || json.success === false
        || ('editorialReadError' in json && typeof json.editorialReadError !== 'boolean')
        || ('legacyReadError' in json && typeof json.legacyReadError !== 'boolean'))) {
        throw new Error('Invalid trending response');
      }
      const items = normalizeItems(json);
      if (items.some((item) => !normalizeTopic(item))) throw new Error('Invalid trending item');
      const topics = normalizeTrendingTopics(items);
      let shortcutSnapshot: TrendingTopic[] | undefined;
      if (isRecord(json) && 'shortcutSnapshot' in json) {
        const snapshot = json.shortcutSnapshot;
        if (!Array.isArray(snapshot) || !snapshot.every((row) => isRecord(row) && !row.source && normalizeTopic(row))) {
          throw new Error('Invalid trending shortcut snapshot');
        }
        shortcutSnapshot = normalizeTrendingTopics(snapshot);
      }
      const editorialFailed = isRecord(json) && json.editorialReadError === true;
      const legacyFailed = isRecord(json) && json.legacyReadError === true;
      if (editorialFailed || legacyFailed) console.warn('[trending-topics] Trending data partially unavailable');
      return { items: topics.length ? topics : DEFAULT_TRENDING_TOPICS, authoritative: !editorialFailed && !legacyFailed,
        ...(shortcutSnapshot ? { shortcutSnapshot } : {}),
        ...(legacyFailed && !editorialFailed ? { legacyOnlyFallback: true } : {}) };
    }, signal);
  } catch (error) {
    if (!signal?.aborted) console.warn('[trending-topics] Using default shortcuts', error);
    return { items: DEFAULT_TRENDING_TOPICS, authoritative: false };
  }
}

export async function getTrendingTopics(lang: RouteLocale = 'en'): Promise<TrendingTopic[]> {
  return (await readTrendingTopics(lang)).items;
}
