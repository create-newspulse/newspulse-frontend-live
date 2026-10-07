/** @jest-environment node */
import { fetchCategoryFeedPage, mergeCategoryFeedPages, selectCategoryFeedArticles } from '../../lib/categoryFeed';
import { getCategoryStaticProps } from '../../lib/categoryPageProps';
import { FAITH_CULTURE_NEWS_UNAVAILABLE, FAITH_CULTURE_PAGINATION_HEADER, getFaithCulturePagination, validateFaithCulturePageRequest } from '../../lib/faithCulturePagination';
import { ORDINARY_PAGINATION_HEADER, validateOrdinaryPageRequest } from '../../lib/ordinaryCategoryPagination';
import { faithPage, faithStories } from '../fixtures/faithCulture';

jest.mock('../../lib/publicApiBase', () => ({ getPublicApiBaseUrl: () => 'http://127.0.0.1:9' }));
jest.mock('../../lib/getMessages', () => ({ getMessages: async (locale: string) => ({ locale }) }));

describe('Faith strict page client and ISR', () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test.each(['en', 'hi', 'gu'] as const)('%s ISR seeds page 1, complete metadata and compact records', async (locale) => {
    const all = faithStories(locale);
    fetchMock.mockResolvedValue(new Response(JSON.stringify(faithPage(all, 1))));
    const result = await getCategoryStaticProps({ locale, revalidateReason: 'build' }, 'faith-culture');
    if (!('props' in result)) throw new Error('Expected static props');
    const props = await result.props;
    expect(result.revalidate).toBe(60);
    expect(props.initialItems.map(item => item._id)).toEqual(all.slice(0, 30).map(item => item._id));
    expect(props.initialItems.every(item => item.content === undefined)).toBe(true);
    expect(props.initialPagination).toEqual({ page: 1, limit: 30, total: 100, totalPages: 4, hasMore: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [input, init] = fetchMock.mock.calls[0];
    const url = new URL(String(input));
    expect(url.pathname).toBe('/api/public/news');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      category: 'faith-culture', lang: locale, language: locale, page: '1', limit: '30', strictLocale: '1',
    });
    expect(new Headers(init?.headers).has(FAITH_CULTURE_PAGINATION_HEADER)).toBe(false);
    expect(new Headers(init?.headers).has(ORDINARY_PAGINATION_HEADER)).toBe(false);
  });

  test.each(['build', 'stale', 'on-demand'] as const)('503 rejects %s ISR instead of generating empty successful props', async (revalidateReason) => {
    fetchMock.mockResolvedValue(new Response('private database diagnostics', { status: 503 }));
    await expect(getCategoryStaticProps({ locale: 'en', revalidateReason }, 'faith-culture'))
      .rejects.toThrow(FAITH_CULTURE_NEWS_UNAVAILABLE);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test.each([1000, 100000])('virtual total %i still requests just one 30-record page', async (total) => {
    const items = faithStories('gu', 30);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      items, page: 3, limit: 30, total, totalPages: Math.ceil(total / 30), hasMore: true,
    })));
    const result = await fetchCategoryFeedPage({ category: 'faith-culture', language: 'gu', page: 3, limit: 30 });
    expect(result.items).toHaveLength(30);
    expect(result.pagination).toEqual({ page: 3, limit: 30, total, totalPages: Math.ceil(total / 30), hasMore: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('limit')).toBe('30');
  });

  test('a completely filtered page retains backend hasMore without scanning subsequent pages', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(faithPage(faithStories('en'), 1))));
    const result = await fetchCategoryFeedPage({
      category: 'faith-culture', language: 'en', page: 1, limit: 30, selectItems: () => [],
    });
    expect(result).toEqual({
      items: [], pagination: { page: 1, limit: 30, total: 100, totalPages: 4, hasMore: true },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('publication ties retain backend order across appends, regardless of IDs or updatedAt', () => {
    const all = faithStories('en', 40).map((item, index) => ({
      ...item, _id: `id-${100 - index}`, publishedAt: '2026-09-30T12:00:00.000Z',
    }));
    const initial = selectCategoryFeedArticles(all.slice(0, 30), 'faith-culture', 'en');
    const merged = selectCategoryFeedArticles(mergeCategoryFeedPages(initial, all.slice(30), 'en'), 'faith-culture', 'en');
    expect(merged.map(item => item._id)).toEqual(all.map(item => item._id));
    expect(merged[0]._id).toBe(initial[0]._id);
  });

  test('dedupes IDs and logical stories without dropping distinct IDs with the same slug', () => {
    const [lead, older, distinct] = faithStories('en', 3);
    const merged = mergeCategoryFeedPages(
      [lead, { ...older, translationGroupId: 'older-group' }],
      [lead, { ...older, _id: 'revision', translationGroupId: 'older-group' }, { ...distinct, slug: lead.slug }],
      'en',
    );
    expect(merged).toHaveLength(3);
    expect(merged.filter(item => item.translationGroupId === 'older-group')).toHaveLength(1);
    expect(merged.filter(item => item.slug === lead.slug)).toHaveLength(2);
    expect(selectCategoryFeedArticles(merged, 'faith-culture', 'en')[0]._id).toBe(lead._id);
  });

  test.each(['page', 'limit', 'total', 'totalPages', 'hasMore'])('does not infer missing backend %s', (field) => {
    const payload: Record<string, unknown> = faithPage(faithStories('en'), 1);
    delete payload[field];
    expect(() => getFaithCulturePagination(payload, { page: 1, limit: 30 }, 30)).toThrow('Missing');
  });

  test.each([
    { page: 2 }, { limit: 60 }, { total: 100, totalPages: 1 }, { hasMore: false },
  ])('rejects inconsistent metadata: %j', (overrides) => {
    expect(() => getFaithCulturePagination(
      { ...faithPage(faithStories('en'), 1), ...overrides }, { page: 1, limit: 30 }, 30,
    )).toThrow();
  });

  test('rejects a short raw page inconsistent with total rather than declaring exhaustion', () => {
    expect(() => getFaithCulturePagination(faithPage(faithStories('en'), 1), { page: 1, limit: 30 }, 1)).toThrow('record count');
  });

  test.each([0, 1, 29, 31, 60, 90, 120, 100000])('rejects limit=%i before fetching', async (limit) => {
    await expect(fetchCategoryFeedPage({ category: 'faith-culture', language: 'en', page: 2, limit })).rejects.toThrow('limit=30');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test.each(['category', 'lang', 'language', 'page', 'limit'])('extraQuery cannot override %s', async (key) => {
    await expect(fetchCategoryFeedPage({
      category: 'faith-culture', language: 'en', page: 1, limit: 30, extraQuery: { [key]: '90' },
    })).rejects.toThrow(`cannot override ${key}`);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('keeps Faith out of ordinary pagination and rejects an unspecified locale', () => {
    expect(() => validateOrdinaryPageRequest('faith-culture', 1, 30)).toThrow('Unsupported');
    expect(() => validateFaithCulturePageRequest('faith-culture', 1, 30, undefined)).toThrow('locale');
  });
});
