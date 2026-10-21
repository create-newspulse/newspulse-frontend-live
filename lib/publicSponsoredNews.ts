import { getCategoryIdentity } from './categoryKeys';
import { getLocalizedArticleFields, getPublicArticleStatus, STRICT_LOCALE_POLICY, type RouteLocale } from './localizedArticleFields';
import { getOrdinaryCategoryPagination } from './ordinaryCategoryPagination';
import { getPublicApiBaseUrl } from './publicApiBase';
import { parsePublicNewsList, type Article } from './publicNewsApi';
import { withPublicReadDeadline } from './publicReadDeadline';
import { getSafeRetryAfter } from './retryAfter';

export const SPONSORED_NEWS_PAGE_SIZE = 12;
export const SPONSORED_NEWS_TIMEOUT_MS = 4000;
export const SPONSORED_NEWS_UNAVAILABLE = 'SPONSORED_NEWS_UNAVAILABLE';
export const SPONSORED_NEWS_INVALID_RESPONSE = 'SPONSORED_NEWS_INVALID_RESPONSE';

export type SponsoredNewsPage = {
  items: Article[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export class SponsoredNewsReadError extends Error {
  constructor(
    readonly code: typeof SPONSORED_NEWS_UNAVAILABLE | typeof SPONSORED_NEWS_INVALID_RESPONSE,
    message: string,
    readonly retryAfter?: string,
  ) {
    super(message);
    this.name = 'SponsoredNewsReadError';
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function invalid(message: string): never {
  throw new SponsoredNewsReadError(SPONSORED_NEWS_INVALID_RESPONSE, message);
}

export function sponsoredContentPath(lang: RouteLocale, page = 1): string {
  return `${lang === 'en' ? '' : `/${lang}`}/sponsored-content${page > 1 ? `?page=${page}` : ''}`;
}

export function parseSponsoredPageNumber(value: unknown): number | null {
  if (value === undefined) return 1;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : null;
}

export function validateSponsoredNewsRequest(query: Record<string, unknown>): { lang: RouteLocale; page: number } {
  const { lang } = query;
  const page = parseSponsoredPageNumber(query.page);
  if (query.sponsoredOnly !== 'true' || (lang !== 'gu' && lang !== 'hi' && lang !== 'en')
    || !page || query.page === undefined
    || query.limit !== String(SPONSORED_NEWS_PAGE_SIZE)
    || Object.keys(query).some((key) => !['sponsoredOnly', 'lang', 'page', 'limit'].includes(key))) {
    throw new Error('Invalid sponsored news request');
  }
  return { lang, page };
}

export function parseSponsoredNewsPage(payload: unknown, lang: RouteLocale, page: number): SponsoredNewsPage {
  const root = record(payload);
  if (!root || !Array.isArray(root.items)
    || ['page', 'limit', 'total', 'totalPages'].some((key) => typeof root[key] !== 'number' || !Number.isSafeInteger(root[key]))) {
    return invalid('Missing or invalid sponsored pagination');
  }
  const parsed = parsePublicNewsList(root);
  if (!parsed) return invalid('Invalid public sponsored article DTO');
  let pagination: ReturnType<typeof getOrdinaryCategoryPagination>;
  try {
    pagination = getOrdinaryCategoryPagination(
      { page: root.page, limit: root.limit, total: root.total, totalPages: root.totalPages },
      { page, limit: SPONSORED_NEWS_PAGE_SIZE }, parsed.items.length,
    );
  } catch (error) {
    return invalid(error instanceof Error ? error.message : 'Invalid sponsored pagination');
  }
  const { total, totalPages } = pagination;
  if (total === undefined || totalPages === undefined
    || parsed.items.length !== Math.min(pagination.limit, Math.max(0, total - (page - 1) * pagination.limit))) {
    return invalid('Inconsistent sponsored page record count');
  }

  const ids = new Set<string>();
  const slugs = new Set<string>();
  const groups = new Set<string>();
  for (let index = 0; index < parsed.items.length; index += 1) {
    const raw = record(root.items[index]);
    const article = parsed.items[index];
    if (!raw || (raw.isSponsoredArticle !== true && raw.isSponsored !== true)) {
      return invalid('Sponsored-only response contains an ordinary article');
    }
    const state = String(raw.status || raw.state || '').trim().toLowerCase();
    if (getPublicArticleStatus(article) !== 'published' || (state && state !== 'published')
      || (raw.visibility != null && raw.visibility !== 'public')
      || raw.isPrivate === true || raw.private === true || raw.isPublic === false) {
      return invalid('Sponsored-only response contains a nonpublic article');
    }
    const localized = getLocalizedArticleFields(article, lang, STRICT_LOCALE_POLICY);
    if (!localized.isVisible || localized.isFallback || !localized.title.trim()
      || raw.isFallback === true || (raw.resolvedLang != null && raw.resolvedLang !== lang)) {
      return invalid('Sponsored-only response violates the requested locale');
    }
    if (typeof article.slug !== 'string' || !article.slug.trim() || !getCategoryIdentity(article.category)) {
      return invalid('Sponsored article is missing its persisted slug or editorial category');
    }
    const keys = [article.translationGroupId, article.translationKey].filter(
      (key): key is string => typeof key === 'string' && Boolean(key.trim()),
    ).map((key) => key.trim());
    const id = article._id.trim();
    const slug = article.slug.trim();
    if (ids.has(id) || slugs.has(slug) || keys.some((key) => groups.has(key))) {
      return invalid('Sponsored-only response contains a duplicate logical story');
    }
    ids.add(id);
    slugs.add(slug);
    keys.forEach((key) => groups.add(key));
  }

  // Validate, never filter, refill, reorder or deduplicate a backend-owned page.
  return { items: parsed.items, page: pagination.page, limit: pagination.limit, total, totalPages };
}

export async function fetchSponsoredNewsPage(lang: RouteLocale, page: number, parentSignal?: AbortSignal): Promise<SponsoredNewsPage> {
  if (!['gu', 'hi', 'en'].includes(lang) || !Number.isSafeInteger(page) || page < 1) {
    throw new Error('Invalid sponsored news locale or page');
  }
  const base = getPublicApiBaseUrl().replace(/\/+$/, '');
  if (!base && typeof window === 'undefined') {
    throw new SponsoredNewsReadError(SPONSORED_NEWS_UNAVAILABLE, 'Public backend is not configured');
  }
  const params = new URLSearchParams({
    sponsoredOnly: 'true', lang, page: String(page), limit: String(SPONSORED_NEWS_PAGE_SIZE),
  });
  return withPublicReadDeadline(SPONSORED_NEWS_TIMEOUT_MS, async (signal) => {
    const response = await fetch(`${base}/api/public/news?${params}`, {
      method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store', signal,
    });
    const retryAfter = getSafeRetryAfter(response.headers.get('Retry-After'));
    const text = await response.text();
    let payload: unknown;
    try {
      payload = JSON.parse(text);
    } catch {
      throw new SponsoredNewsReadError(
        response.ok ? SPONSORED_NEWS_INVALID_RESPONSE : SPONSORED_NEWS_UNAVAILABLE,
        `Sponsored news returned unreadable JSON (${response.status})`, retryAfter,
      );
    }
    if (!response.ok) {
      const code = record(payload)?.error === SPONSORED_NEWS_INVALID_RESPONSE
        ? SPONSORED_NEWS_INVALID_RESPONSE : SPONSORED_NEWS_UNAVAILABLE;
      throw new SponsoredNewsReadError(code, `Sponsored news request failed (${response.status})`, retryAfter);
    }
    return parseSponsoredNewsPage(payload, lang, page);
  }, parentSignal);
}
