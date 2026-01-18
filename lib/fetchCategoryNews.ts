import { getApiOrigin, unwrapArticles, type Article } from './publicNewsApi';

function normalizeText(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value
    .toLowerCase()
    .replace(/[_/]+/g, ' ')
    .replace(/[^a-z0-9\s-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function asStringList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => (typeof v === 'string' ? v : '')).filter(Boolean);
  if (typeof value === 'string') return [value];
  return [];
}

function topicKeywords(categoryKey: string): string[] {
  const key = normalizeText(categoryKey);
  const base = key ? [key] : [];

  // Add practical synonyms to improve matching when backend doesn’t strictly categorize.
  switch (key) {
    case 'science-technology':
      return [...base, 'science', 'technology', 'tech', 'ai', 'artificial intelligence'];
    case 'viral-videos':
      return [...base, 'viral', 'video', 'videos', 'reel', 'reels'];
    case 'web-stories':
      return [...base, 'web story', 'web stories', 'webstories'];
    case 'international':
      return [...base, 'world', 'global', 'international'];
    case 'national':
      return [...base, 'india', 'national'];
    case 'business':
      return [...base, 'business', 'finance', 'economy', 'market', 'markets', 'stock'];
    case 'sports':
      return [...base, 'sport', 'sports', 'cricket', 'football', 'kabaddi'];
    case 'lifestyle':
      return [...base, 'lifestyle', 'health', 'travel', 'food', 'wellness'];
    case 'glamour':
      return [...base, 'glamour', 'entertainment', 'bollywood', 'celebrity', 'fashion'];
    case 'editorial':
      return [...base, 'editorial', 'opinion', 'analysis'];
    case 'breaking':
      return [...base, 'breaking', 'urgent'];
    default:
      return base;
  }
}

function articleMatchesCategory(article: Article, categoryKey: string): boolean {
  const needles = topicKeywords(categoryKey).map(normalizeText).filter(Boolean);
  if (!needles.length) return true;

  const categoryFields = [
    (article as any)?.category,
    (article as any)?.section,
    (article as any)?.desk,
    (article as any)?.topic,
    (article as any)?.type,
  ];

  const tags = [
    ...asStringList((article as any)?.tags),
    ...asStringList((article as any)?.tag),
    ...asStringList((article as any)?.keywords),
    ...asStringList((article as any)?.categories),
  ];

  const haystackStrong = normalizeText([...categoryFields, ...tags].join(' '));
  if (haystackStrong) {
    for (const n of needles) {
      if (!n) continue;
      if (haystackStrong.includes(n)) return true;
    }
  }

  // Fallback: keyword match in human-readable fields.
  const haystackSoft = normalizeText([article.title, article.summary, article.excerpt].join(' '));
  for (const n of needles) {
    if (!n) continue;
    if (haystackSoft.includes(n)) return true;
  }

  return false;
}

function scoreCategoryMatch(items: Article[], categoryKey: string): { matched: number; total: number } {
  const total = items.length;
  if (!total) return { matched: 0, total: 0 };
  let matched = 0;
  for (const a of items) {
    if (articleMatchesCategory(a, categoryKey)) matched += 1;
  }
  return { matched, total };
}

export type CategoryNewsMeta = {
  total?: number;
  page?: number;
  totalPages?: number;
  limit?: number;
};

export async function fetchCategoryNews(options: {
  categoryKey: string;
  limit?: number;
  language?: string;
}): Promise<{
  items: Article[];
  meta: CategoryNewsMeta;
  endpoint: string;
  error?: string;
  status?: number;
}> {
  const origin = getApiOrigin();
  const limit = options.limit ?? 30;
  const key = options.categoryKey;
  const lang = options.language ? String(options.language) : '';
  const langQuery = lang ? `&lang=${encodeURIComponent(lang)}&language=${encodeURIComponent(lang)}` : '';

  // Backends vary: some expect `category`, others `cat`/`section`.
  // Try a small set and pick the one that actually looks filtered.
  const candidates: Array<{ label: string; url: string }> = [
    { label: 'category', url: `${origin}/api/news?category=${encodeURIComponent(key)}&limit=${encodeURIComponent(String(limit))}${langQuery}` },
    { label: 'cat', url: `${origin}/api/news?cat=${encodeURIComponent(key)}&limit=${encodeURIComponent(String(limit))}${langQuery}` },
    { label: 'section', url: `${origin}/api/news?section=${encodeURIComponent(key)}&limit=${encodeURIComponent(String(limit))}${langQuery}` },
    { label: 'categoryKey', url: `${origin}/api/news?categoryKey=${encodeURIComponent(key)}&limit=${encodeURIComponent(String(limit))}${langQuery}` },
    { label: 'path', url: `${origin}/api/news/category/${encodeURIComponent(key)}?limit=${encodeURIComponent(String(limit))}${langQuery}` },
  ];

  const primaryEndpoint = candidates[0].url;

  try {
    let best:
      | {
          endpoint: string;
          data: any;
          items: Article[];
          score: number;
        }
      | undefined;
    let lastError: { endpoint: string; status?: number; error: string } | undefined;

    for (const c of candidates) {
      const endpoint = c.url;
      const res = await fetch(endpoint);
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          (data && typeof data === 'object' && (data.message || data.error || data.code))
            ? String(data.message || data.error || data.code)
            : '';
        lastError = {
          endpoint,
          status: res.status,
          error: msg ? `API ${res.status} (${msg})` : `API ${res.status}`,
        };
        continue;
      }

      const rawItems =
        (data && typeof data === 'object' && !Array.isArray(data))
          ? ((data as any).items ?? (data as any).articles ?? (Array.isArray(data) ? data : []))
          : (Array.isArray(data) ? data : []);

      const normalizedItems = Array.isArray(rawItems) ? (rawItems as Article[]) : unwrapArticles(data);
      const { matched, total } = scoreCategoryMatch(normalizedItems, key);
      const score = total ? matched / total : 0;

      if (!best || score > best.score || (score === best.score && normalizedItems.length > best.items.length)) {
        best = { endpoint, data, items: normalizedItems, score };
      }

      // If it looks well-filtered, stop early.
      if (score >= 0.55) break;
    }

    if (!best) {
      return {
        items: [],
        meta: { limit },
        endpoint: lastError?.endpoint || primaryEndpoint,
        status: lastError?.status,
        error: lastError?.error || 'Fetch failed',
      };
    }

    // If backend returns an unfiltered feed, apply a conservative client-side filter.
    // This is a fallback for backends that ignore the query param.
    const filtered = best.score > 0 ? best.items.filter((a) => articleMatchesCategory(a, key)) : best.items;
    const items = filtered.length ? filtered : best.items;

    const data = best.data;
    const meta: CategoryNewsMeta = {
      total: data && typeof data === 'object' ? (data.total as number | undefined) : undefined,
      page: data && typeof data === 'object' ? (data.page as number | undefined) : undefined,
      totalPages: data && typeof data === 'object' ? (data.totalPages as number | undefined) : undefined,
      limit,
    };

    return { items, meta, endpoint: best.endpoint };
  } catch {
    return { items: [], meta: { limit }, endpoint: primaryEndpoint, error: 'Fetch failed' };
  }
}
