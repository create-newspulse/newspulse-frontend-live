export type Article = {
  _id: string;
  title?: string;
  slug?: string;
  summary?: string;
  excerpt?: string;
  content?: string;
  html?: string;
  body?: string;
  image?: string;
  imageUrl?: string;
  createdAt?: string;
  publishedAt?: string;
  category?: string;
  language?: string;
};

const FALLBACK_API_ORIGIN = 'https://newspulse-backend-real.onrender.com';

export function getApiOrigin() {
  const origin =
    process.env.NEXT_PUBLIC_API_ORIGIN ||
    process.env.NEXT_PUBLIC_API_BASE_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    FALLBACK_API_ORIGIN;

  return String(origin).replace(/\/+$/, '');
}

export function unwrapArticles(payload: any): Article[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as Article[];

  const candidates = [payload.articles, payload.items, payload.data, payload.result];
  for (const c of candidates) {
    if (Array.isArray(c)) return c as Article[];
  }

  return [];
}

export function unwrapArticle(payload: any): Article | null {
  if (!payload) return null;
  if (payload.article && typeof payload.article === 'object') return payload.article as Article;
  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) return payload.data as Article;
  if (typeof payload === 'object' && !Array.isArray(payload) && payload._id) return payload as Article;
  return null;
}

export async function fetchPublishedCategoryArticles(options: {
  categoryKey: string;
  limit?: number;
}): Promise<{ articles: Article[]; error?: string; endpoint: string }> {
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
      return { articles: [], error: msg ? `API ${res.status} (${msg})` : `API ${res.status}`, endpoint };
    }

    return { articles: unwrapArticles(data), endpoint };
  } catch {
    return { articles: [], error: 'Fetch failed', endpoint };
  }
}

export async function fetchArticleBySlugOrId(options: {
  slugOrId: string;
}): Promise<{ article: Article | null; error?: string; status?: number; endpointTried: string[] }> {
  const origin = getApiOrigin();
  const slug = options.slugOrId;

  const endpoints = [
    // Current backend: article detail is served under /api/articles/:id
    `${origin}/api/articles/${encodeURIComponent(slug)}`,
    `${origin}/api/news/${encodeURIComponent(slug)}`,
    `${origin}/api/news/by-slug/${encodeURIComponent(slug)}`,
  ];

  for (let i = 0; i < endpoints.length; i++) {
    const url = endpoints[i];
    try {
      const res = await fetch(url);
      if (res.status === 404) {
        continue;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg =
          (data && typeof data === 'object' && (data.message || data.error || data.code))
            ? String(data.message || data.error || data.code)
            : '';
        return {
          article: null,
          error: msg ? `API ${res.status} (${msg})` : `API ${res.status}`,
          status: res.status,
          endpointTried: endpoints.slice(0, i + 1),
        };
      }
      const data = await res.json().catch(() => null);
      const article = unwrapArticle(data);
      if (!article?._id) {
        return { article: null, error: 'Article not found', endpointTried: endpoints.slice(0, i + 1) };
      }
      return { article, endpointTried: endpoints.slice(0, i + 1) };
    } catch {
      return { article: null, error: 'Fetch failed', endpointTried: endpoints.slice(0, i + 1) };
    }
  }

  return { article: null, status: 404, endpointTried: endpoints };
}
