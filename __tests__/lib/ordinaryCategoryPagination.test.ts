import { CATEGORY_FEED_TIMEOUT_MS, fetchCategoryFeedPage, mergeCategoryFeedPages, selectCategoryFeedArticles } from '../../lib/categoryFeed';
import { getOrdinaryCategoryBatchSize, getOrdinaryCategoryPagination, ORDINARY_PAGINATION_HEADER, validateOrdinaryPageRequest } from '../../lib/ordinaryCategoryPagination';

jest.mock('../../lib/publicApiBase', () => ({ getPublicApiBaseUrl: () => 'https://backend.test' }));

const categories = ['national', 'international', 'business', 'tech', 'tech-gadgets', 'sports', 'lifestyle', 'glamour'];
const locales = ['en', 'hi', 'gu'];

function dataset(category: string, language: string, total = 100) {
  return Array.from({ length: total }, (_, index) => ({
    _id: `${category}-${language}-${index}`, slug: `${category}-${language}-${index}`,
    category, language, status: 'published', title: `Story ${index}`, summary: `Summary ${index}`, content: 'Body',
    publishedAt: new Date(Date.parse('2026-09-30T12:00:00.000Z') - index * 86400000).toISOString(),
    updatedAt: index ? '2026-10-01T12:00:00.000Z' : '2026-09-30T12:00:00.000Z',
  }));
}

describe('ordinary category bounded page contract', () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
  });
  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test.each(categories)('%s has the required fixed batch size', (category) => {
    expect(getOrdinaryCategoryBatchSize(category)).toBe(category === 'national' ? 20 : 30);
  });

  test.each(['regional', 'editorial', 'web-stories', 'viral-videos', 'pulse-dialogue', 'youth-pulse', 'community-reporter', 'inspiration-hub'])(
    'rejects %s without making a request', async (category) => {
      await expect(fetchCategoryFeedPage({ category, language: 'en', page: 1, limit: 30 })).rejects.toThrow('Unsupported');
      expect(fetchMock).not.toHaveBeenCalled();
    }
  );

  test('retains the existing science route alias without mixing it with gadgets', () => {
    expect(getOrdinaryCategoryBatchSize('science-technology')).toBe(30);
    expect(validateOrdinaryPageRequest('tech-gadgets', 1, 30)).toEqual({ page: 1, limit: 30 });
  });

  describe.each(categories)('%s', (category) => {
    test.each(locales)('reads all 100 %s records in disjoint fixed pages without edit-time promotion', async (language) => {
      const all = dataset(category, language);
      const limit = category === 'national' ? 20 : 30;
      fetchMock.mockImplementation(async (input, init) => {
        const url = new URL(String(input));
        const page = Number(url.searchParams.get('page'));
        expect(url.pathname).toBe('/api/public/news');
        expect(url.searchParams.get('category')).toBe(category);
        expect(url.searchParams.get('lang')).toBe(language);
        expect(url.searchParams.get('language')).toBe(language);
        expect(url.searchParams.get('limit')).toBe(String(limit));
        expect(new Headers(init?.headers).get(ORDINARY_PAGINATION_HEADER)).toBe('1');
        return new Response(JSON.stringify({
          items: all.slice((page - 1) * limit, page * limit),
          page, limit, total: 100, totalPages: Math.ceil(100 / limit),
        }));
      });
      let combined: ReturnType<typeof selectCategoryFeedArticles> = [];
      const counts: number[] = [];
      for (let page = 1; page <= Math.ceil(100 / limit); page += 1) {
        const result = await fetchCategoryFeedPage({
          category, language, page, limit,
          selectItems: (items) => selectCategoryFeedArticles(items, category, language),
        });
        counts.push(result.items.length);
        expect(result.pagination.hasMore).toBe(page * limit < 100);
        combined = selectCategoryFeedArticles(mergeCategoryFeedPages(combined, result.items, language), category, language);
        expect(combined[0]._id).toBe(all[0]._id);
        expect(combined.map((item) => item._id)).toEqual(all.slice(0, page * limit).map((item) => item._id));
      }
      expect(counts).toEqual(limit === 20 ? [20, 20, 20, 20, 20] : [30, 30, 30, 10]);
      expect(fetchMock.mock.calls.map(([input]) => new URL(String(input)).searchParams.get('page'))).toEqual(
        Array.from({ length: Math.ceil(100 / limit) }, (_, index) => String(index + 1))
      );
    });
  });

  test('uses raw metadata when all items on a page fail the existing selector', async () => {
    const all = dataset('business', 'en', 31);
    fetchMock.mockImplementation(async (input) => {
      const page = Number(new URL(String(input)).searchParams.get('page'));
      return new Response(JSON.stringify({
        items: page === 1 ? all.slice(0, 30).map((item) => ({ ...item, status: 'draft' })) : all.slice(30),
        page, limit: 30, total: 31, totalPages: 2,
      }));
    });
    const result = await fetchCategoryFeedPage({
      category: 'business', language: 'en', page: 1, limit: 30,
      selectItems: (items) => selectCategoryFeedArticles(items, 'business', 'en'),
    });
    expect(result.items.map((item) => item._id)).toEqual([all[30]._id]);
    expect(result.pagination).toEqual({ page: 2, limit: 30, total: 31, totalPages: 2, hasMore: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('advances when client search removes an entire page but later matches exist', async () => {
    const all = dataset('business', 'en', 31);
    fetchMock.mockImplementation(async (input) => {
      const page = Number(new URL(String(input)).searchParams.get('page'));
      return new Response(JSON.stringify({
        items: all.slice((page - 1) * 30, page * 30),
        page, limit: 30, total: 31, totalPages: 2,
      }));
    });
    const result = await fetchCategoryFeedPage({
      category: 'business', language: 'en', page: 1, limit: 30,
      selectItems: (items) => items.filter((item) => item.title === 'Story 30'),
    });
    expect(result.items.map((item) => item._id)).toEqual([all[30]._id]);
    expect(result.pagination.page).toBe(2);
  });

  test('retains the existing ID/group dedupe without dropping distinct IDs sharing a slug', () => {
    const [lead, old, distinct] = dataset('business', 'en', 3);
    const merged = mergeCategoryFeedPages(
      [{ ...lead, translationGroupId: 'lead-group' }, { ...old, slug: 'shared-slug' }],
      [old, { ...lead, _id: 'lead-version', translationGroupId: 'lead-group' }, { ...distinct, slug: 'shared-slug' }],
      'en'
    );
    expect(merged).toHaveLength(3);
    expect(merged.filter((item) => item.translationGroupId === 'lead-group')).toHaveLength(1);
    expect(merged.filter((item) => item.slug === 'shared-slug')).toHaveLength(2);
    expect(selectCategoryFeedArticles(merged, 'business', 'en')[0].publishedAt).toBe(lead.publishedAt);
  });

  test('does not loosen strict locale or category visibility while accumulating pages', () => {
    const [lead] = dataset('business', 'en', 1);
    const invalid = ['pending', 'failed', 'rejected'].map((status) => ({
      ...lead, _id: status, language: 'gu', sourceLanguage: 'gu',
      translationStatus: { en: status }, translations: { en: { title: 'Translated title', content: 'Translated body' } },
    }));
    const merged = mergeCategoryFeedPages([lead], [
      ...invalid, { ...lead, _id: 'gu-original', language: 'gu' }, { ...lead, _id: 'other-category', category: 'sports' },
    ], 'en');
    expect(selectCategoryFeedArticles(merged, 'business', 'en').map((item) => item._id)).toEqual([lead._id]);
  });

  test.each([
    { total: 31, totalPages: 2 },
    { meta: { total: '31', totalPages: '2' } },
    { data: { pagination: { total: 31, totalPages: 2 } } },
    { pagination: { total: 31, totalPages: 2, hasMore: true } },
  ])('reads backend pagination metadata without using the filtered count: %j', (meta) => {
    expect(getOrdinaryCategoryPagination(meta, { page: 1, limit: 30 }, 0).hasMore).toBe(true);
  });

  test('supports explicit exhaustion and conservative raw-count metadata fallback', () => {
    expect(getOrdinaryCategoryPagination({ hasMore: false }, { page: 1, limit: 30 }, 30).hasMore).toBe(false);
    expect(getOrdinaryCategoryPagination({}, { page: 1, limit: 30 }, 30).hasMore).toBe(true);
    expect(getOrdinaryCategoryPagination({}, { page: 2, limit: 30 }, 0).hasMore).toBe(false);
  });

  test.each([
    { page: 2 }, { limit: 60 }, { total: -1 }, { totalPages: 'invalid' },
    { hasMore: 'true' }, { total: 100, totalPages: 1 }, { total: 100, hasMore: false },
  ])('rejects inconsistent metadata: %j', (meta) => {
    expect(() => getOrdinaryCategoryPagination(meta, { page: 1, limit: 30 }, 30)).toThrow();
  });

  test('rejects an oversized response instead of slicing it into a fake page', () => {
    expect(() => getOrdinaryCategoryPagination({}, { page: 1, limit: 30 }, 31)).toThrow('exceeded');
  });

  test.each(['invalid JSON', '{}', 'null'])('does not treat a malformed response as an exhausted category: %s', async (body) => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockResolvedValue(new Response(body));
    await expect(fetchCategoryFeedPage({ category: 'business', language: 'en', page: 1, limit: 30 })).rejects.toThrow('Fetch failed');
  });

  test('reads a nested page envelope without losing its items or metadata', async () => {
    const items = dataset('business', 'en', 2);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      data: { items, meta: { page: 1, limit: 30, total: 2, totalPages: 1 } },
    })));
    const result = await fetchCategoryFeedPage({ category: 'business', language: 'en', page: 1, limit: 30 });
    expect(result.items).toEqual(items);
    expect(result.pagination.hasMore).toBe(false);
  });

  test.each(['category', 'language', 'lang', 'page', 'limit'])('cannot override the bounded request using extraQuery.%s', async (key) => {
    await expect(fetchCategoryFeedPage({
      category: 'business', language: 'en', page: 1, limit: 30, extraQuery: { [key]: '100000' },
    })).rejects.toThrow(`cannot override ${key}`);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('an all-filtered sequence stops at the shared deadline instead of scanning the archive', async () => {
    jest.useFakeTimers();
    const signals: Array<AbortSignal | null | undefined> = [];
    fetchMock.mockImplementation((input, init) => new Promise((resolve) => {
      signals.push(init?.signal);
      const page = Number(new URL(String(input)).searchParams.get('page'));
      setTimeout(() => resolve(new Response(JSON.stringify({
        items: dataset('business', 'en', 30).map((item) => ({ ...item, status: 'draft' })),
        page, limit: 30, total: 100000, totalPages: 3334,
      }))), 1000);
    }));
    const pending = fetchCategoryFeedPage({ category: 'business', language: 'en', page: 1, limit: 30 });
    const rejected = expect(pending).rejects.toThrow('timed out');
    await jest.advanceTimersByTimeAsync(CATEGORY_FEED_TIMEOUT_MS);
    await rejected;
    await jest.advanceTimersByTimeAsync(10000);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(signals.every((signal) => signal?.aborted)).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });
});
