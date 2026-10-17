/** @jest-environment node */
import {
  EDITORIAL_TOPICS_TIMEOUT_MS,
  editorialTopicPath,
  fetchEditorialTopic,
  fetchEditorialTopics,
  fetchEditorialTopicStories,
  type EditorialTopicStoryPage,
} from '../../lib/publicEditorialTopics';
import { getPublicApiBaseUrl } from '../../lib/publicApiBase';
import { jsonResponse, storyFixture, storyPageFixture, topicFixture, topicNames, topicStoryCategories } from '../fixtures/editorialTopics';

jest.mock('../../lib/publicApiBase', () => ({ getPublicApiBaseUrl: jest.fn(() => 'http://localhost:3010') }));

const originalFetch = global.fetch;
const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
});
afterEach(() => {
  Reflect.deleteProperty(globalThis, 'window');
  global.fetch = originalFetch;
  jest.useRealTimers();
});

describe('Trending Topic Story Management V2 public DTOs', () => {
  test.each(['en', 'hi', 'gu'] as const)('requests six %s topics and retains backend labels and order', async (lang) => {
    const second = topicFixture(lang, { slug: 'nobel-prize', label: `  ${topicNames[lang]}  ` });
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, lang, items: [second, topicFixture(lang)] }));
    const topics = await fetchEditorialTopics(lang);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(`http://localhost:3010/api/public/topics?lang=${lang}&limit=6`,
      expect.objectContaining({ method: 'GET', cache: 'no-store', signal: expect.any(AbortSignal) }));
    expect(topics.map((topic) => topic.slug)).toEqual(['nobel-prize', 'navratri-2026']);
    expect(topics[0].label).toBe(second.label);
    expect(topics[1].label).toBe(topicNames[lang]);
  });

  test('an empty current topic list remains a successful empty result', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, lang: 'en', items: [] }));
    expect(await fetchEditorialTopics('en')).toEqual([]);
  });

  test.each([
    null,
    {},
    { ok: false, lang: 'en', items: [] },
    { ok: true, lang: 'gu', items: [] },
    { ok: true, lang: 'en', items: [topicFixture('en', { label: 7 })] },
    { ok: true, lang: 'en', items: [topicFixture('en', { slug: '../bad' })] },
    { ok: true, lang: 'en', items: [topicFixture('en', { name: { en: 'Only English' } })] },
    { ok: true, lang: 'en', items: Array.from({ length: 7 }, () => topicFixture()) },
  ])('rejects malformed or oversized list payload %#', async (body) => {
    fetchMock.mockResolvedValue(jsonResponse(body));
    await expect(fetchEditorialTopics('en')).rejects.toThrow();
  });

  test('preserves a canonical Unicode slug without ASCII slugification', async () => {
    const slug = '\u0aa8\u0ab5\u0ab0\u0abe\u0aa4\u0acd\u0ab0\u0abf-2026';
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, lang: 'gu', topic: topicFixture('gu', { slug }), pinnedArticle: null }));
    const detail = await fetchEditorialTopic(slug, 'gu');
    expect(detail?.topic.slug).toBe(slug);
    expect(detail?.topic.href).toBe(`/topic/${encodeURIComponent(slug)}`);
    expect(editorialTopicPath(slug, 'gu', 2)).toBe(`/gu/topic/${encodeURIComponent(slug)}?page=2`);
  });

  test('detail retains an expired archive and its backend-localized pin without a client clock', async () => {
    fetchMock.mockResolvedValue(jsonResponse({
      ok: true, lang: 'hi', topic: topicFixture('hi', { expiresAt: '2020-01-02T00:00:00.000Z' }),
      pinnedArticle: storyFixture(100, 'hi'),
    }));
    const detail = await fetchEditorialTopic('navratri-2026', 'hi');
    expect(detail?.topic.label).toBe(topicNames.hi);
    expect(detail?.pinnedArticle?.title).toBe(storyFixture(100, 'hi').title);
    expect(fetchMock.mock.calls[0][0]).toBe('http://localhost:3010/api/public/topics/navratri-2026?lang=hi');
  });

  test('only a detail 404 means authoritative topic absence', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: false }, 404));
    expect(await fetchEditorialTopic('unknown', 'en')).toBeNull();
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: false }, 503));
    await expect(fetchEditorialTopic('unknown', 'en')).rejects.toThrow('503');
  });

  test.each([1, 2])('reads fixed backend page %s without category or keyword filtering', async (page) => {
    const body = storyPageFixture('gu', page);
    fetchMock.mockResolvedValue(jsonResponse(body));
    const result = await fetchEditorialTopicStories('navratri-2026', 'gu', page);
    expect(fetchMock.mock.calls[0][0]).toBe(`http://localhost:3010/api/public/topics/navratri-2026/articles?lang=gu&page=${page}&limit=12`);
    expect(result.items.map((story) => story._id)).toEqual(body.items.map((story) => story._id));
    expect(result.items.map((story) => story.category)).toEqual(body.items.map((story) => story.category));
    expect(result).toMatchObject({ page, limit: 12, total: 13, totalPages: 2, hasNextPage: page === 1 });
  });

  test('accepts a genuinely empty archive page', async () => {
    fetchMock.mockResolvedValue(jsonResponse(storyPageFixture('en', 1, 0)));
    expect(await fetchEditorialTopicStories('navratri-2026', 'en', 1)).toMatchObject({
      items: [], total: 0, totalPages: 0, hasNextPage: false,
    });
  });

  test.each(['en', 'hi', 'gu'] as const)('preserves every %s real category and backend order without interpreting membership metadata', async (lang) => {
    const body = storyPageFixture(lang, 1, 12);
    const dates = ['2026-10-12T10:00:00Z', '2026-10-12T10:00:00Z', '2026-10-11T10:00:00Z'];
    const items = body.items.map((story, index) => ({
      ...story,
      title: `Unrelated headline ${index}`,
      summary: 'No topic keywords',
      publishedAt: dates[index] || '2026-10-01T10:00:00Z',
      tags: ['not-used-by-the-browser'],
      seo: { keywords: ['not-membership'] },
    }));
    fetchMock.mockResolvedValue(jsonResponse({ ...body, items }));
    const result = await fetchEditorialTopicStories('navratri-2026', lang, 1);
    expect(result.items.map((story) => story.category)).toEqual(topicStoryCategories);
    expect(result.items.map((story) => story._id)).toEqual(items.map((story) => story._id));
    expect(result.items.map((story) => story.publishedAt)).toEqual(items.map((story) => story.publishedAt));
    expect(result.items.every((story) => story.language === lang && story.resolvedLang === lang)).toBe(true);
    expect(result.items.every((story) => !('tags' in story) && !('seo' in story))).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).not.toMatch(/category=|q=|tags=|keywords=/);
  });

  test.each(['en', 'hi', 'gu'] as const)('reads all 37 %s ordinary members through four fixed pages, excluding the separate pin from totals', async (lang) => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));
      return jsonResponse(storyPageFixture(lang, Number(url.searchParams.get('page')), 37));
    });
    const pages: EditorialTopicStoryPage[] = [];
    for (let page = 1; page <= 4; page++) pages.push(await fetchEditorialTopicStories('navratri-2026', lang, page));
    expect(pages.map((page) => page.items.length)).toEqual([12, 12, 12, 1]);
    expect(pages.map((page) => page.hasNextPage)).toEqual([true, true, true, false]);
    expect(pages.every((page) => page.total === 37 && page.totalPages === 4 && page.limit === 12)).toBe(true);
    expect(pages.flatMap((page) => page.items.map((story) => story._id))).toEqual(
      Array.from({ length: 37 }, (_, index) => storyFixture(37 - index, lang)._id),
    );
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  test.each(['en', 'hi', 'gu'] as const)('preserves the backend-selected %s edition of one logical member, without requesting other locales', async (lang) => {
    const body = storyPageFixture(lang, 1, 1);
    fetchMock.mockResolvedValue(jsonResponse(body));
    const result = await fetchEditorialTopicStories('navratri-2026', lang, 1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ language: lang, translationKey: 'group-1' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(`?lang=${lang}&page=1&limit=12`);
  });

  test.each([
    { limit: 30 }, { page: 2 }, { total: undefined }, { hasNextPage: 'yes' }, { count: 2 },
    { items: [{ ...storyFixture(1), category: { slug: 'tech' } }], count: 1, total: 1, totalPages: 1, hasNextPage: false },
    { items: [{ ...storyFixture(1), isFallback: true }], count: 1, total: 1, totalPages: 1, hasNextPage: false },
    { items: [storyFixture(1, 'hi')], count: 1, total: 1, totalPages: 1, hasNextPage: false },
  ])('rejects malformed pagination or wrong-language story payload %#', async (override) => {
    fetchMock.mockResolvedValue(jsonResponse({ ...storyPageFixture(), ...override }));
    await expect(fetchEditorialTopicStories('navratri-2026', 'en', 1)).rejects.toThrow();
  });

  test.each([0, -1, 1.5, 10001, NaN])('rejects invalid page %s before fetching', async (page) => {
    await expect(fetchEditorialTopicStories('navratri-2026', 'en', page)).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('deadline aborts the read rather than waiting indefinitely', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation(() => new Promise(() => {}));
    const result = expect(fetchEditorialTopics('en')).rejects.toThrow('timed out');
    await jest.advanceTimersByTimeAsync(EDITORIAL_TOPICS_TIMEOUT_MS);
    await result;
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  test('missing safe backend configuration cannot create a relative server fetch', async () => {
    jest.mocked(getPublicApiBaseUrl).mockReturnValueOnce('');
    await expect(fetchEditorialTopics('en')).rejects.toThrow('not configured');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test.each(['en', 'hi', 'gu'] as const)('%s browser detail/page readers use the same-origin transport', async (lang) => {
    Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
    jest.mocked(getPublicApiBaseUrl).mockReturnValueOnce('').mockReturnValueOnce('');
    fetchMock.mockResolvedValueOnce(jsonResponse({ ok: true, lang, topic: topicFixture(lang), pinnedArticle: null }));
    fetchMock.mockResolvedValueOnce(jsonResponse(storyPageFixture(lang, 2)));
    await fetchEditorialTopic('navratri-2026', lang);
    await fetchEditorialTopicStories('navratri-2026', lang, 2);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `/api/public/topics/navratri-2026?lang=${lang}`,
      `/api/public/topics/navratri-2026/articles?lang=${lang}&page=2&limit=12`,
    ]);
  });

  test('a missing pin field is malformed, not an authoritative null pin', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, lang: 'en', topic: topicFixture() }));
    await expect(fetchEditorialTopic('navratri-2026', 'en')).rejects.toThrow('Missing editorial topic pin');
  });

  test.each(['detail', 'stories'])('a %s timeout stays a failed read rather than an empty archive or replacement pin', async (kind) => {
    jest.useFakeTimers();
    fetchMock.mockImplementation(() => new Promise(() => {}));
    const pending = kind === 'detail'
      ? fetchEditorialTopic('navratri-2026', 'en')
      : fetchEditorialTopicStories('navratri-2026', 'en', 1);
    const failure = expect(pending).rejects.toThrow('timed out');
    await jest.advanceTimersByTimeAsync(EDITORIAL_TOPICS_TIMEOUT_MS);
    await failure;
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  test.each(['detail', 'stories'])('%s reader propagates owner cancellation to fetch', async (kind) => {
    const controller = new AbortController();
    fetchMock.mockImplementation(() => new Promise(() => {}));
    const pending = kind === 'detail'
      ? fetchEditorialTopic('navratri-2026', 'en', controller.signal)
      : fetchEditorialTopicStories('navratri-2026', 'en', 2, controller.signal);
    const cancelled = expect(pending).rejects.toThrow('cancelled');
    controller.abort();
    await cancelled;
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });
});
