/** @jest-environment node */
import { CATEGORY_FEED_TIMEOUT_MS, fetchCategoryFeedPage, mergeCategoryFeedPages, selectCategoryFeedArticles } from '../../lib/categoryFeed';
import { getCategoryStaticProps } from '../../lib/categoryPageProps';
import * as editorialDisplay from '../../lib/editorialDisplay';
import { FAITH_CULTURE_NEWS_UNAVAILABLE, FAITH_CULTURE_PAGINATION_HEADER, getFaithCulturePagination, validateFaithCulturePageRequest } from '../../lib/faithCulturePagination';
import { ORDINARY_PAGINATION_HEADER, validateOrdinaryPageRequest } from '../../lib/ordinaryCategoryPagination';
import { FAITH_CULTURE_TOPICS, getFaithCultureTopic } from '../../lib/faithCultureTopics';
import { faithPage, faithStories } from '../fixtures/faithCulture';
import { getLocalizedArticleFields, STRICT_LOCALE_POLICY } from '../../lib/localizedArticleFields';

jest.mock('../../lib/publicApiBase', () => ({ getPublicApiBaseUrl: () => 'http://127.0.0.1:9' }));
jest.mock('../../lib/getMessages', () => ({ getMessages: async (locale: string) => ({ locale }) }));

describe('Faith strict page client and ISR', () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
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
    expect(props).not.toHaveProperty('initialLoadFailed');
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

  test.each((['en', 'hi', 'gu'] as const).flatMap(locale =>
    (['http', 'json', 'pagination', 'network'] as const).map(failure => ({ locale, failure }))
  ))('$locale build read failures ($failure) remain explicitly unavailable without fabricated pagination', async ({ locale, failure }) => {
    if (failure === 'http') fetchMock.mockResolvedValue(new Response('private database diagnostics', { status: 503 }));
    else if (failure === 'json') fetchMock.mockResolvedValue(new Response('{invalid JSON'));
    else if (failure === 'pagination') fetchMock.mockResolvedValue(new Response(JSON.stringify({ ...faithPage([], 1), hasMore: undefined })));
    else fetchMock.mockRejectedValue(new Error('private network diagnostics'));

    const result = await getCategoryStaticProps({ locale, revalidateReason: 'build' }, 'faith-culture');
    expect(result).toEqual({
      props: { messages: { locale }, locale, initialItems: [], initialLoadFailed: true },
      revalidate: 60,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.pathname).toBe('/api/public/news');
    expect(Object.fromEntries(url.searchParams)).toEqual({
      category: 'faith-culture', lang: locale, language: locale, page: '1', limit: '30', strictLocale: '1',
    });
    expect(console.warn).toHaveBeenCalledWith('[faith-culture] Initial build feed unavailable', {
      locale, reason: FAITH_CULTURE_NEWS_UNAVAILABLE,
    });
  });

  test.each((['en', 'hi', 'gu'] as const).flatMap(locale =>
    (['headers', 'body'] as const).map(phase => ({ locale, phase }))
  ))('$locale build deadline still bounds stalled $phase', async ({ locale, phase }) => {
    jest.useFakeTimers();
    if (phase === 'headers') fetchMock.mockImplementation(() => new Promise<Response>(() => {}));
    else {
      const response = new Response();
      jest.spyOn(response, 'json').mockImplementation(() => new Promise(() => {}));
      fetchMock.mockResolvedValue(response);
    }
    const pending = Promise.allSettled([getCategoryStaticProps({ locale, revalidateReason: 'build' }, 'faith-culture')]);
    await jest.advanceTimersByTimeAsync(CATEGORY_FEED_TIMEOUT_MS);
    expect(await pending).toEqual([{
      status: 'fulfilled',
      value: { props: { messages: { locale }, locale, initialItems: [], initialLoadFailed: true }, revalidate: 60 },
    }]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
    expect(console.warn).toHaveBeenCalledWith('[faith-culture] Initial build feed unavailable', { locale, reason: 'timeout' });
  });

  test.each((['en', 'hi', 'gu'] as const).flatMap(locale =>
    (['stale', 'on-demand', undefined] as const).map(revalidateReason => ({ locale, revalidateReason }))
  ))('$locale 503 rejects $revalidateReason regeneration instead of replacing verified content', async ({ locale, revalidateReason }) => {
    fetchMock.mockResolvedValue(new Response('private database diagnostics', { status: 503 }));
    await expect(getCategoryStaticProps({ locale, revalidateReason }, 'faith-culture'))
      .rejects.toThrow(FAITH_CULTURE_NEWS_UNAVAILABLE);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(console.warn).not.toHaveBeenCalled();
  });

  test.each(['en', 'hi', 'gu'] as const)('%s authoritative empty build retains its validated pagination without a failure marker', async (locale) => {
    const { items, ...pagination } = faithPage([], 1);
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ items, ...pagination })));
    const result = await getCategoryStaticProps({ locale, revalidateReason: 'build' }, 'faith-culture');
    if (!('props' in result)) throw new Error('Expected static props');
    const props = await result.props;
    expect(props.initialItems).toEqual([]);
    expect(props.initialPagination).toEqual(pagination);
    expect(props).not.toHaveProperty('initialLoadFailed');
    expect(console.warn).not.toHaveBeenCalled();
  });

  test('unexpected compaction errors still fail the build', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(faithPage(faithStories('en', 1), 1))));
    jest.spyOn(editorialDisplay, 'getArticleReadingTime').mockImplementationOnce(() => {
      throw new Error('Unexpected compaction failure');
    });
    await expect(getCategoryStaticProps({ locale: 'en', revalidateReason: 'build' }, 'faith-culture'))
      .rejects.toThrow('Unexpected compaction failure');
    expect(console.warn).not.toHaveBeenCalled();
  });

  test.each((['en', 'hi', 'gu'] as const).flatMap(locale =>
    ['faith-culture', 'business'].map(category => ({ locale, category }))
  ))('$category/$locale compact initial props preserve valid strict translations after hydration', async ({ locale, category }) => {
    const body = '<p>Localized body content.</p>'.repeat(1000);
    const item = {
      ...faithStories(locale, 1)[0], category,
      sourceLanguage: locale === 'gu' ? 'en' : 'gu',
      title: 'Source title', content: '<p>Source content</p>',
      translationStatus: { [locale]: 'APPROVED' },
      translations: { [locale]: { title: 'Localized title', content: body, summary: 'Localized summary' } },
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(faithPage([item], 1))));
    const result = await getCategoryStaticProps({ locale }, category);
    if (!('props' in result)) throw new Error('Expected static props');
    const props = await result.props;
    expect(props.initialItems).toHaveLength(1);
    expect(selectCategoryFeedArticles(props.initialItems, category, locale).map(article => article._id)).toEqual([item._id]);
    const localized = getLocalizedArticleFields(props.initialItems[0], locale, STRICT_LOCALE_POLICY);
    expect(localized.isVisible).toBe(true);
    expect(localized.title).toBe('Localized title');
    expect(localized.summary).toBe('Localized summary');
    expect(localized.bodyHtml).toBe(body.slice(0, 256));
    expect(props.initialItems[0].content).toBeUndefined();
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

  test.each(FAITH_CULTURE_TOPICS)('forwards the exact stable topic %s without locally filtering backend membership', async (topic) => {
    const stories = faithStories('gu', 3);
    fetchMock.mockResolvedValue(new Response(JSON.stringify(faithPage(stories, 1))));
    const result = await fetchCategoryFeedPage({
      category: 'faith-culture', language: 'gu', page: 1, limit: 30, extraQuery: { topic, strictLocale: '1' },
    });
    expect(getFaithCultureTopic(topic)).toBe(topic);
    expect(result.items).toEqual(stories);
    expect(result.pagination).toEqual({ page: 1, limit: 30, total: 3, totalPages: 1, hasMore: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(Object.fromEntries(new URL(String(fetchMock.mock.calls[0][0])).searchParams)).toEqual({
      category: 'faith-culture', lang: 'gu', language: 'gu', page: '1', limit: '30', topic, strictLocale: '1',
    });
  });

  test.each(['unknown-value', 'Living Heritage & Traditions', 'LIVING-HERITAGE', ' living-heritage '])('invalid topic %s becomes All before any outbound request', async (topic) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify(faithPage([], 1))));
    const result = await fetchCategoryFeedPage({
      category: 'faith-culture', language: 'en', page: 1, limit: 30, extraQuery: { topic },
    });
    expect(getFaithCultureTopic(topic)).toBeUndefined();
    expect(result.pagination.hasMore).toBe(false);
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.has('topic')).toBe(false);
    expect(console.error).toHaveBeenCalledWith('[publicNewsApi]', 'invalid_faith_topic', { topic });
  });

  test.each([
    { value: undefined }, { value: null }, { value: '' }, { value: 1 },
    { value: ['living-heritage'] }, { value: ['living-heritage', 'food-agricultural-heritage'] },
  ])('does not accept a non-scalar or missing topic: %j', ({ value }) => {
    expect(getFaithCultureTopic(value)).toBeUndefined();
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
