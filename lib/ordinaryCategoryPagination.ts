import { getCategoryQueryKey } from './categoryKeys';

export const ORDINARY_PAGINATION_HEADER = 'X-NewsPulse-Ordinary-Pagination';
export const ORDINARY_PAGINATED_CATEGORIES = [
  'national', 'international', 'business', 'tech', 'tech-gadgets', 'sports', 'lifestyle', 'glamour',
] as const;

const categories = new Set<string>(ORDINARY_PAGINATED_CATEGORIES);

export type OrdinaryCategoryPagination = {
  page: number;
  limit: number;
  total?: number;
  totalPages?: number;
  hasMore: boolean;
};

export function isOrdinaryPaginatedCategory(category: unknown): boolean {
  return categories.has(getCategoryQueryKey(category));
}

export function getOrdinaryCategoryBatchSize(category: unknown): number {
  if (!isOrdinaryPaginatedCategory(category)) throw new Error('Unsupported ordinary pagination category');
  return getCategoryQueryKey(category) === 'national' ? 20 : 30;
}

function integer(value: unknown, minimum: number, field: string): number | undefined {
  if (value == null) return undefined;
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN;
  if (!Number.isSafeInteger(number) || number < minimum) throw new Error(`Invalid category pagination ${field}`);
  return number;
}

export function validateOrdinaryPageRequest(category: unknown, page: unknown, limit: unknown): { page: number; limit: number } {
  const maximum = getOrdinaryCategoryBatchSize(category);
  const requestedPage = integer(page, 1, 'requested page');
  const requestedLimit = integer(limit, 1, 'requested limit');
  if (requestedPage === undefined || requestedLimit === undefined || requestedLimit > maximum) {
    throw new Error('Ordinary category pagination requires a page and a bounded limit');
  }
  return { page: requestedPage, limit: requestedLimit };
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export function getOrdinaryCategoryPageItems(payload: unknown): unknown[] {
  const root = record(payload);
  const data = record(root.data);
  const items = [payload, root.items, root.articles, root.data, root.result, data.items, data.articles].find(Array.isArray);
  if (!items) throw new Error('Invalid ordinary category page payload');
  return items;
}

export function getOrdinaryCategoryPagination(
  payload: unknown,
  requested: { page: number; limit: number },
  rawCount: number,
): OrdinaryCategoryPagination {
  const root = record(payload);
  const data = record(root.data);
  const meta = {
    ...root, ...data, ...record(root.meta), ...record(data.meta),
    ...record(data.pagination), ...record(root.pagination),
  };
  const page = integer(meta.page, 1, 'page') ?? requested.page;
  const limit = integer(meta.limit, 1, 'limit') ?? requested.limit;
  const total = integer(meta.total, 0, 'total');
  const totalPages = integer(meta.totalPages, 0, 'totalPages');
  if (page !== requested.page || limit !== requested.limit) throw new Error('Category source returned an unexpected page or limit');
  if (rawCount > limit) throw new Error('Category source exceeded the requested page size');
  if (meta.hasMore != null && typeof meta.hasMore !== 'boolean') throw new Error('Invalid category pagination hasMore');
  if (total !== undefined && totalPages !== undefined
    && totalPages !== Math.max(1, Math.ceil(total / limit)) && !(total === 0 && totalPages === 0)) {
    throw new Error('Inconsistent category pagination totals');
  }
  const remaining = totalPages !== undefined ? page < totalPages
    : total !== undefined ? page * limit < total
    : undefined;
  if (typeof meta.hasMore === 'boolean' && remaining !== undefined && meta.hasMore !== remaining) {
    throw new Error('Inconsistent category pagination hasMore');
  }
  return {
    page, limit,
    hasMore: typeof meta.hasMore === 'boolean' ? meta.hasMore : remaining ?? rawCount >= limit,
    ...(total !== undefined ? { total } : {}),
    ...(totalPages !== undefined ? { totalPages } : {}),
  };
}
