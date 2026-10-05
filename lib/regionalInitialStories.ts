import { getPublicApiBaseUrl } from './publicApiBase';
import { dedupeRegionalFeedPayload, unwrapRegionalFeedItems } from './unwrapRegionalFeed';
import { filterPubliclyPublishedArticles, getLocalizedArticleFields, normalizeRouteLocale, STRICT_LOCALE_POLICY } from './localizedArticleFields';
import { withPublicReadDeadline } from './publicReadDeadline';

export const REGIONAL_BLOCKED_IDS = new Set([
  '69a9d5f74c3cb9a18ef5a179', '69a9ca4a4c3cb9a18ef5a16f',
  '69c0c4707c7cb68a34add518', '69c029fb7c7cb68a34add2ee',
]);

export type RegionalPagination = {
  page: number;
  limit: number;
  total?: number;
  totalPages?: number;
  hasMore: boolean;
};

export type RegionalStoryPage = {
  stories: Record<string, unknown>[];
  pagination: RegionalPagination;
};

type RegionalReadOptions = { server?: boolean; signal?: AbortSignal };

function paginationRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function paginationInteger(value: unknown, minimum: number, field: string): number | undefined {
  if (value == null) return undefined;
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isSafeInteger(number) || number < minimum) throw new Error(`Invalid Regional pagination ${field}`);
  return number;
}

export function getRegionalPagination(payload: unknown, requested: { page?: unknown; limit?: unknown } = {}): RegionalPagination {
  const requestedPage = paginationInteger(requested.page, 1, 'requested page') ?? 1;
  const requestedLimit = paginationInteger(requested.limit, 1, 'requested limit') ?? 30;
  const root = paginationRecord(payload);
  const data = paginationRecord(root.data);
  const meta = {
    ...root,
    ...data,
    ...paginationRecord(root.meta),
    ...paginationRecord(data.meta),
    ...paginationRecord(data.pagination),
    ...paginationRecord(root.pagination),
  };
  const page = paginationInteger(meta.page, 1, 'page') ?? requestedPage;
  const limit = paginationInteger(meta.limit, 1, 'limit') ?? requestedLimit;
  const total = paginationInteger(meta.total, 0, 'total');
  const totalPages = paginationInteger(meta.totalPages, 0, 'totalPages');
  if (page !== requestedPage || limit !== requestedLimit) throw new Error('Regional source returned an unexpected page or limit');
  if (meta.hasMore != null && typeof meta.hasMore !== 'boolean') throw new Error('Invalid Regional pagination hasMore');
  const rawCount = unwrapRegionalFeedItems(payload).length;
  if (rawCount > limit) throw new Error('Regional source exceeded the requested page size');
  const remaining = totalPages !== undefined ? page < totalPages
    : total !== undefined ? page * limit < total
    : undefined;
  if (typeof meta.hasMore === 'boolean' && remaining !== undefined && meta.hasMore !== remaining) {
    throw new Error('Inconsistent Regional pagination metadata');
  }
  const hasMore = typeof meta.hasMore === 'boolean' ? meta.hasMore : remaining ?? rawCount >= limit;
  return {
    page, limit, hasMore,
    ...(total !== undefined ? { total } : {}),
    ...(totalPages !== undefined ? { totalPages } : {}),
  };
}

export function selectRegionalInitialStories(payload: unknown, locale: string): any[] {
  const requestedLocale = normalizeRouteLocale(locale);
  const policy = {
    ...STRICT_LOCALE_POLICY,
    allowReadyTranslations: requestedLocale === 'en' || requestedLocale === 'hi',
  };
  const items = unwrapRegionalFeedItems(dedupeRegionalFeedPayload(payload, locale));
  return filterPubliclyPublishedArticles(items).filter((item) => {
    if (REGIONAL_BLOCKED_IDS.has(String(item?._id || (item as any)?.id || ''))) return false;
    const localized = getLocalizedArticleFields(item, locale, policy);
    return localized.isVisible && Boolean(localized.title);
  }).sort((left: any, right: any) => {
    const timestamp = (story: any) => {
      for (const value of [story.publishedAt, story.publishAt, story.createdAt]) {
        const parsed = Date.parse(String(value || ''));
        if (Number.isFinite(parsed)) return parsed;
      }
      return 0;
    };
    return timestamp(right) - timestamp(left);
  });
}

export function appendRegionalStories(current: Record<string, unknown>[], incoming: Record<string, unknown>[], locale: string): Record<string, unknown>[] {
  const seen = new Set<string>();
  return selectRegionalInitialStories([...current, ...incoming], locale).filter((story) => {
    const key = String(story?._id || story?.id || story?.slug || '').trim().toLowerCase();
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function readRegionalPayload(params: URLSearchParams, options: RegionalReadOptions, signal: AbortSignal): Promise<{ payload: unknown; pagination?: RegionalPagination }> {
  const base = options.server ? String(getPublicApiBaseUrl() || '').replace(/\/+$/, '') : '';
  if (options.server && !base) throw new Error('Regional backend not configured');
  if (options.server) {
    const { fetchRegionalFeedSource } = await import('./regionalFeedSource');
    const result = await fetchRegionalFeedSource({
      base,
      url: `/api/public/regional?${params.toString()}`,
      query: Object.fromEntries(params),
      headers: {},
      signal,
    });
    if ('upstreamError' in result) throw result.upstreamError;
    if (result.status < 200 || result.status >= 300) throw new Error(`Regional feed unavailable (${result.status})`);
    return result;
  }
  const response = await fetch(`${base}/api/public/regional?${params.toString()}`, {
    method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' }, signal,
  });
  if (!response.ok) throw new Error(`Regional feed unavailable (${response.status})`);
  return { payload: await response.json() };
}

export async function fetchRegionalInitialStories(params: URLSearchParams, options: RegionalReadOptions = {}): Promise<any[]> {
  return withPublicReadDeadline(4000, async (signal) => {
    const { payload } = await readRegionalPayload(params, options, signal);
    return selectRegionalInitialStories(payload, params.get('lang') || 'en');
  }, options.signal);
}

export async function fetchRegionalStoryPage(params: URLSearchParams, options: RegionalReadOptions = {}): Promise<RegionalStoryPage> {
  return withPublicReadDeadline(4000, async (signal) => {
    const request = new URLSearchParams(params);
    if (!request.has('page')) request.set('page', '1');
    if (!request.has('limit')) request.set('limit', '30');
    while (true) {
      const result = await readRegionalPayload(request, options, signal);
      const pagination = result.pagination ?? getRegionalPagination(result.payload, { page: request.get('page'), limit: request.get('limit') });
      const stories = appendRegionalStories([], unwrapRegionalFeedItems(result.payload), request.get('lang') || 'en');
      if (stories.length || !pagination.hasMore) return { stories, pagination };
      // An entirely filtered page is not exhaustion; advance within the same read deadline.
      request.set('page', String(pagination.page + 1));
    }
  }, options.signal);
}