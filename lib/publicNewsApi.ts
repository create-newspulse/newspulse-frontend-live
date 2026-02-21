import { getPublicApiBaseUrl } from './publicApiBase';

export type ArticleBase = {
  _id: string;
  title?: string;
  slug?: string;
  translationGroupId?: string;
  translationKey?: string;
  summary?: string;
  excerpt?: string;
  content?: string;
  html?: string;
  body?: string;
  image?: string;
  imageUrl?: string;
  coverImageUrl?: string;
  createdAt?: string;
  publishedAt?: string;
  category?: string;
  language?: string;
};

export type Article = ArticleBase & {
  translations?: Record<string, Partial<ArticleBase> | undefined>;
};

export function getApiOrigin() {
  // Keep name for back-compat, but source is now NEXT_PUBLIC_API_BASE.
  return getPublicApiBaseUrl();
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

export type PublicNewsMeta = {
  total?: number;
  page?: number;
  totalPages?: number;
  limit?: number;
};

export async function fetchPublicNews(options: {
  category?: string;
  language?: string;
  q?: string;
  page?: number;
  limit?: number;
  extraQuery?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
}): Promise<{
  items: Article[];
  meta: PublicNewsMeta;
  endpoint: string;
  error?: string;
  status?: number;
}> {
  const isBrowser = typeof window !== 'undefined';
  const base = getApiOrigin();
  if (!isBrowser && !base) {
    return {
      items: [],
      meta: { limit: options.limit },
      endpoint: '',
      error: 'NEXT_PUBLIC_API_BASE not set',
    };
  }
  const params = new URLSearchParams();

  if (options.category) params.set('category', String(options.category));
  if (options.language) {
    // Backend compatibility: some deployments use `lang`, others use `language`.
    // Send both so every page stays language-filtered.
    params.set('lang', String(options.language));
    params.set('language', String(options.language));
  }
  if (options.q) params.set('q', String(options.q));
  if (typeof options.page === 'number') params.set('page', String(options.page));
  if (typeof options.limit === 'number') params.set('limit', String(options.limit));

  if (options.extraQuery) {
    for (const [k, v] of Object.entries(options.extraQuery)) {
      if (v === undefined || v === null) continue;
      const sv = String(v);
      if (!sv) continue;
      params.set(k, sv);
    }
  }

  // In the browser, `base` may be "" which yields a same-origin request.
  const endpoint = `${base}/api/public/news?${params.toString()}`;

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: options.signal,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const msg =
        (data && typeof data === 'object' && (data.message || data.error || data.code))
          ? String(data.message || data.error || data.code)
          : '';
      return {
        items: [],
        meta: { limit: options.limit },
        endpoint,
        status: res.status,
        error: msg ? `API ${res.status} (${msg})` : `API ${res.status}`,
      };
    }

    const items = unwrapArticles(data);
    const meta: PublicNewsMeta = {
      total: data && typeof data === 'object' ? (data.total as number | undefined) : undefined,
      page: data && typeof data === 'object' ? (data.page as number | undefined) : undefined,
      totalPages: data && typeof data === 'object' ? (data.totalPages as number | undefined) : undefined,
      limit: data && typeof data === 'object' ? (data.limit as number | undefined) : options.limit,
    };

    return { items, meta, endpoint };
  } catch {
    return { items: [], meta: { limit: options.limit }, endpoint, error: 'Fetch failed' };
  }
}

export async function fetchPublishedCategoryArticles(options: {
  categoryKey: string;
  limit?: number;
}): Promise<{ articles: Article[]; error?: string; endpoint: string }> {
  const base = getApiOrigin();
  if (!base) {
    return { articles: [], error: 'NEXT_PUBLIC_API_BASE not set', endpoint: '' };
  }
  const limit = options.limit ?? 30;
  const endpoint = `${base}/api/news?category=${encodeURIComponent(options.categoryKey)}&limit=${encodeURIComponent(String(limit))}`;

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
  language?: string;
}): Promise<{ article: Article | null; error?: string; status?: number; endpointTried: string[] }> {
  const base = getApiOrigin();
  if (!base) {
    return { article: null, error: 'NEXT_PUBLIC_API_BASE not set', endpointTried: [] };
  }
  const slug = options.slugOrId;

  const lang = options.language ? String(options.language).toLowerCase().trim() : '';
  const langQuery = lang ? `?lang=${encodeURIComponent(lang)}&language=${encodeURIComponent(lang)}` : '';

  const endpoints = [
    // Current backend: article detail is served under /api/articles/:id
    `${base}/api/articles/${encodeURIComponent(slug)}${langQuery}`,
    `${base}/api/news/${encodeURIComponent(slug)}${langQuery}`,
    `${base}/api/news/by-slug/${encodeURIComponent(slug)}${langQuery}`,
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

export async function fetchPublicNewsById(options: {
  id: string;
  language?: string;
  signal?: AbortSignal;
}): Promise<{ article: Article | null; error?: string; status?: number; endpoint: string }> {
  const base = getApiOrigin();
  if (!base && typeof window === 'undefined') {
    return { article: null, error: 'NEXT_PUBLIC_API_BASE not set', endpoint: '' };
  }

  const id = String(options.id || '').trim();
  if (!id) return { article: null, error: 'Missing id', endpoint: '' };

  const lang = options.language ? String(options.language).toLowerCase().trim() : '';
  const langQuery = lang ? `?lang=${encodeURIComponent(lang)}&language=${encodeURIComponent(lang)}` : '';

  const endpoint = `${base}/api/public/news/${encodeURIComponent(id)}${langQuery}`;

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: options.signal,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const msg =
        (data && typeof data === 'object' && (data.message || data.error || data.code))
          ? String(data.message || data.error || data.code)
          : '';
      return { article: null, status: res.status, endpoint, error: msg ? `API ${res.status} (${msg})` : `API ${res.status}` };
    }

    const article = unwrapArticle(data);
    if (!article?._id) return { article: null, endpoint, status: 404, error: 'Article not found' };
    return { article, endpoint };
  } catch {
    return { article: null, endpoint, error: 'Fetch failed' };
  }
}

export async function fetchPublicNewsGroup(options: {
  translationGroupId: string;
  language?: string;
  signal?: AbortSignal;
}): Promise<{ items: Article[]; error?: string; status?: number; endpoint: string }> {
  const base = getApiOrigin();
  if (!base && typeof window === 'undefined') {
    return { items: [], error: 'NEXT_PUBLIC_API_BASE not set', endpoint: '' };
  }

  const groupId = String(options.translationGroupId || '').trim();
  if (!groupId) return { items: [], error: 'Missing translationGroupId', endpoint: '' };

  const lang = options.language ? String(options.language).toLowerCase().trim() : '';
  const langQuery = lang ? `?lang=${encodeURIComponent(lang)}&language=${encodeURIComponent(lang)}` : '';
  const endpoint = `${base}/api/public/news/group/${encodeURIComponent(groupId)}${langQuery}`;

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: options.signal,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const msg =
        (data && typeof data === 'object' && (data.message || data.error || data.code))
          ? String(data.message || data.error || data.code)
          : '';
      return { items: [], status: res.status, endpoint, error: msg ? `API ${res.status} (${msg})` : `API ${res.status}` };
    }

    return { items: unwrapArticles(data), endpoint };
  } catch {
    return { items: [], endpoint, error: 'Fetch failed' };
  }
}

export async function fetchPublicNewsTranslation(options: {
  translationKey: string;
  language: string;
  signal?: AbortSignal;
}): Promise<{ article: Article | null; error?: string; status?: number; endpoint: string }> {
  const base = getApiOrigin();
  if (!base && typeof window === 'undefined') {
    return { article: null, error: 'NEXT_PUBLIC_API_BASE not set', endpoint: '' };
  }

  const translationKey = String(options.translationKey || '').trim();
  const language = String(options.language || '').toLowerCase().trim();
  if (!translationKey || !language) return { article: null, error: 'Missing translationKey/lang', endpoint: '' };

  const params = new URLSearchParams();
  params.set('translationKey', translationKey);
  params.set('lang', language);
  params.set('language', language);

  const endpoint = `${base}/api/public/news/translation?${params.toString()}`;

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: options.signal,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const msg =
        (data && typeof data === 'object' && (data.message || data.error || data.code))
          ? String(data.message || data.error || data.code)
          : '';
      return { article: null, status: res.status, endpoint, error: msg ? `API ${res.status} (${msg})` : `API ${res.status}` };
    }

    const article = unwrapArticle(data);
    if (!article?._id) return { article: null, endpoint, status: 404, error: 'Article not found' };
    return { article, endpoint };
  } catch {
    return { article: null, endpoint, error: 'Fetch failed' };
  }
}
