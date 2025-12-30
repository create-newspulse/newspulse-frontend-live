import { getApiOrigin, unwrapArticles, type Article } from './publicNewsApi';

export type CategoryNewsMeta = {
  total?: number;
  page?: number;
  totalPages?: number;
  limit?: number;
};

export async function fetchCategoryNews(options: {
  categoryKey: string;
  limit?: number;
}): Promise<{
  items: Article[];
  meta: CategoryNewsMeta;
  endpoint: string;
  error?: string;
  status?: number;
}> {
  const origin = getApiOrigin();
  const limit = options.limit ?? 30;
  const endpoint = `${origin}/api/news?category=${encodeURIComponent(options.categoryKey)}&limit=${encodeURIComponent(String(limit))}`;

  try {
    const res = await fetch(endpoint);
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const msg =
        (data && typeof data === 'object' && (data.message || data.error || data.code))
          ? String(data.message || data.error || data.code)
          : '';
      return {
        items: [],
        meta: { limit },
        endpoint,
        status: res.status,
        error: msg ? `API ${res.status} (${msg})` : `API ${res.status}`,
      };
    }

    const rawItems =
      (data && typeof data === 'object' && !Array.isArray(data))
        ? ((data as any).items ?? (data as any).articles ?? (Array.isArray(data) ? data : []))
        : (Array.isArray(data) ? data : []);

    const normalizedItems = Array.isArray(rawItems) ? (rawItems as Article[]) : unwrapArticles(data);

    const meta: CategoryNewsMeta = {
      total: data && typeof data === 'object' ? (data.total as number | undefined) : undefined,
      page: data && typeof data === 'object' ? (data.page as number | undefined) : undefined,
      totalPages: data && typeof data === 'object' ? (data.totalPages as number | undefined) : undefined,
      limit,
    };

    return { items: normalizedItems, meta, endpoint };
  } catch {
    return { items: [], meta: { limit }, endpoint, error: 'Fetch failed' };
  }
}
