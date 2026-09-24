import { getPublicApiBaseUrl } from './publicApiBase';
import { dedupeRegionalFeedPayload, unwrapRegionalFeedItems } from './unwrapRegionalFeed';
import { filterPubliclyPublishedArticles, getLocalizedArticleFields, STRICT_LOCALE_POLICY } from './localizedArticleFields';
import { withPublicReadDeadline } from './publicReadDeadline';

export const REGIONAL_BLOCKED_IDS = new Set([
  '69a9d5f74c3cb9a18ef5a179', '69a9ca4a4c3cb9a18ef5a16f',
  '69c0c4707c7cb68a34add518', '69c029fb7c7cb68a34add2ee',
]);

export function selectRegionalInitialStories(payload: unknown, locale: string): any[] {
  const items = unwrapRegionalFeedItems(dedupeRegionalFeedPayload(payload, locale));
  return filterPubliclyPublishedArticles(items).filter((item) => {
    if (REGIONAL_BLOCKED_IDS.has(String(item?._id || (item as any)?.id || ''))) return false;
    const localized = getLocalizedArticleFields(item, locale, STRICT_LOCALE_POLICY);
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

export async function fetchRegionalInitialStories(params: URLSearchParams, options: { server?: boolean; signal?: AbortSignal } = {}): Promise<any[]> {
  const base = options.server ? String(getPublicApiBaseUrl() || '').replace(/\/+$/, '') : '';
  if (options.server && !base) throw new Error('Regional backend not configured');
  return withPublicReadDeadline(4000, async (signal) => {
    const response = await fetch(`${base}/api/public/regional?${params.toString()}`, {
      method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' }, signal,
    });
    if (!response.ok) throw new Error(`Regional feed unavailable (${response.status})`);
    const data = await response.json();
    return selectRegionalInitialStories(data, params.get('lang') || 'en');
  }, options.signal);
}