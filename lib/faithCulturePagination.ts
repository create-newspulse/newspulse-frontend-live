import { getCategoryQueryKey } from './categoryKeys';
import { getOrdinaryCategoryPagination } from './ordinaryCategoryPagination';

export const FAITH_CULTURE_PAGINATION_HEADER = 'X-NewsPulse-Faith-Pagination';
export const FAITH_CULTURE_PAGE_SIZE = 30;
export const FAITH_CULTURE_NEWS_UNAVAILABLE = 'FAITH_NEWS_UNAVAILABLE';

export function isFaithCultureCategory(category: unknown): boolean {
  return getCategoryQueryKey(category) === 'faith-culture';
}

export function validateFaithCulturePageRequest(category: unknown, page: unknown, limit: unknown, language: unknown) {
  if (!isFaithCultureCategory(category)) throw new Error('Unsupported Faith pagination category');
  if (language !== 'en' && language !== 'hi' && language !== 'gu') throw new Error('Faith pagination requires an EN/HI/GU locale');
  const requestedPage = typeof page === 'number' || typeof page === 'string' ? Number(page) : NaN;
  if (!Number.isSafeInteger(requestedPage) || requestedPage < 1 || Number(limit) !== FAITH_CULTURE_PAGE_SIZE) {
    throw new Error('Faith pagination requires a positive page and limit=30');
  }
  return { page: requestedPage, limit: FAITH_CULTURE_PAGE_SIZE };
}

export function getFaithCulturePagination(
  payload: unknown,
  requested: { page: number; limit: number },
  rawCount: number,
) {
  return getOrdinaryCategoryPagination(payload, requested, rawCount, true);
}
