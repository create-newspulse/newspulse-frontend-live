/** @jest-environment node */
import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../pages/api/public/regional';
import { appendRegionalStories, fetchRegionalInitialStories, fetchRegionalStoryPage, getRegionalPagination, REGIONAL_BLOCKED_IDS, selectRegionalInitialStories } from '../../../lib/regionalInitialStories';
import { unwrapRegionalFeedItems } from '../../../lib/unwrapRegionalFeed';

jest.mock('../../../lib/publicApiBase', () => ({ getPublicApiBaseUrl: () => 'https://backend.test' }));

const OCTOBER_IDS = {
  en: '6ac16263cd85085a0d09f2a4',
  hi: '6ac16264cd85085a0d09f2a8',
  gu: '6ac16262cd85085a0d09f28f',
};
type Language = keyof typeof OCTOBER_IDS;

function story(language: Language = 'en', id = OCTOBER_IDS[language], publishedAt = '2026-10-03T20:15:33.097Z') {
  return {
    _id: id,
    slug: id,
    title: `${language} Regional story ${id}`,
    content: `<p>${language} Regional content</p>`,
    category: 'regional',
    language,
    status: 'published',
    publishedAt,
  };
}

function upstream(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });
}

async function requestRegional(query: Record<string, string> = {}) {
  const params = new URLSearchParams({ state: 'gujarat', lang: 'en', limit: '30', ...query });
  const req = {
    method: 'GET',
    url: `/api/public/regional?${params}`,
    query: Object.fromEntries(params),
    headers: {},
  } as NextApiRequest;
  const status = jest.fn();
  const json = jest.fn();
  const res: Partial<NextApiResponse> = { setHeader: jest.fn(), status, json };
  status.mockReturnValue(res);
  json.mockReturnValue(res);
  await handler(req, res as NextApiResponse);
  return { res, payload: json.mock.calls[0]?.[0] };
}

describe('Regional News fallback', () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockRejectedValue(new Error('Unexpected upstream request'));
    global.fetch = fetchMock;
  });
  afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });

  function fallbackResponse(items: unknown[]) {
    fetchMock
      .mockResolvedValueOnce(upstream({ data: { items: [{ _id: 'lightweight', title: 'No publication metadata' }] } }))
      .mockResolvedValueOnce(upstream({ items }));
  }

  test.each(['en', 'hi', 'gu'] as const)('%s current ten-story fallback reports real exhaustion', async (language) => {
    const items = Array.from({ length: 10 }, (_, index) => story(language, index ? `story-${index}` : OCTOBER_IDS[language], new Date(Date.parse('2026-10-03T20:15:33.097Z') - index * 86400000).toISOString()));
    fetchMock
      .mockResolvedValueOnce(upstream({ items: [] }))
      .mockResolvedValueOnce(upstream({ items, page: 1, limit: 30, total: 10, totalPages: 1 }));
    const { payload } = await requestRegional({ lang: language, page: '1' });
    expect(selectRegionalInitialStories(payload, language).map((item) => item._id)).toEqual(items.map((item) => item._id));
    expect(payload.pagination).toEqual({ page: 1, limit: 30, total: 10, totalPages: 1, hasMore: false });
  });

  test.each(['en', 'hi', 'gu'] as const)('%s initial and browser loaders page through 100 stories as 30/30/30/10', async (language) => {
    const items = Array.from({ length: 100 }, (_, index) => story(language, index ? `story-${index}` : OCTOBER_IDS[language], new Date(Date.parse('2026-10-03T20:15:33.097Z') - index * 86400000).toISOString()));
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));
      if (url.pathname === '/api/public/regional') return upstream({ items: [{ _id: 'lightweight', title: 'No publication fields' }] });
      expect(url.pathname).toBe('/api/public/news');
      expect(url.searchParams.get('category')).toBe('regional');
      expect(url.searchParams.get('lang')).toBe(language);
      expect(url.searchParams.get('language')).toBe(language);
      expect(url.searchParams.get('limit')).toBe('30');
      const page = Number(url.searchParams.get('page'));
      return upstream({ items: items.slice((page - 1) * 30, page * 30), page, limit: 30, total: 100, totalPages: 4 });
    });

    let accumulated: Record<string, unknown>[] = [];
    for (const page of [1, 2, 3, 4]) {
      global.fetch = fetchMock;
      const params = new URLSearchParams({ state: 'gujarat', lang: language, page: String(page), limit: '30' });
      const initial = await fetchRegionalStoryPage(params, { server: true });
      const { payload } = await requestRegional({ lang: language, page: String(page) });
      const browserFetch = jest.fn().mockResolvedValue(upstream(payload));
      global.fetch = browserFetch;
      const browser = await fetchRegionalStoryPage(params);
      expect(browserFetch).toHaveBeenCalledTimes(1);
      expect(browserFetch.mock.calls[0][0]).toBe(`/api/public/regional?${params}`);
      expect(browser).toEqual(initial);
      expect(browser.stories).toHaveLength(page === 4 ? 10 : 30);
      expect(browser.stories.map((item) => item._id)).toEqual(items.slice((page - 1) * 30, page * 30).map((item) => item._id));
      expect(browser.pagination.hasMore).toBe(page < 4);
      accumulated = appendRegionalStories(accumulated, browser.stories, language);
      expect(accumulated).toHaveLength(Math.min(page * 30, 100));
    }
    expect(accumulated.map((item) => item._id)).toEqual(items.map((item) => item._id));
    expect(accumulated[0]._id).toBe(OCTOBER_IDS[language]);
    const fallbackPages = fetchMock.mock.calls.map(([input]) => new URL(String(input))).filter((url) => url.pathname === '/api/public/news');
    expect(fallbackPages.map((url) => url.searchParams.get('page'))).toEqual(['1', '1', '2', '2', '3', '3', '4', '4']);
  });

  test('preserves backend totals before publication, language and slug filtering', async () => {
    fetchMock
      .mockResolvedValueOnce(upstream({ items: [] }))
      .mockResolvedValueOnce(upstream({
        items: [story(), { ...story(), _id: 'duplicate' }, story('gu'), { ...story('en', 'draft'), status: 'draft' }],
        page: 1, limit: 30, total: 100, totalPages: 4,
      }));
    const { payload } = await requestRegional({ page: '1' });
    expect(unwrapRegionalFeedItems(payload).map((item) => item._id)).toEqual([OCTOBER_IDS.en]);
    expect(payload.pagination).toEqual({ page: 1, limit: 30, total: 100, totalPages: 4, hasMore: true });
  });

  test('uses raw fallback count before category filtering when backend totals are absent', async () => {
    fallbackResponse([story(), ...Array.from({ length: 29 }, (_, index) => ({ ...story('en', `breaking-${index}`), category: 'breaking' }))]);
    const { payload } = await requestRegional({ page: '1' });
    expect(unwrapRegionalFeedItems(payload)).toHaveLength(1);
    expect(payload.pagination.hasMore).toBe(true);
  });

  test('retains a successful primary and its nested pagination without calling News', async () => {
    fetchMock.mockResolvedValueOnce(upstream({
      data: { items: [story()], pagination: { page: 2, limit: 30, total: 65, totalPages: 3 } },
    }));
    const { payload } = await requestRegional({ page: '2' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new URL(String(fetchMock.mock.calls[0][0])).pathname).toBe('/api/public/regional');
    expect(payload.pagination).toEqual({ page: 2, limit: 30, total: 65, totalPages: 3, hasMore: true });
  });

  test('advances a completely ineligible page rather than claiming exhaustion', async () => {
    const pending = { ...story(), sourceLanguage: 'gu', translationStatus: { en: 'pending' }, translations: { en: { title: 'English', content: 'English body' } } };
    fetchMock.mockImplementation(async (input) => {
      const page = Number(new URL(String(input), 'https://frontend.test').searchParams.get('page'));
      return upstream({ items: page === 1 ? [pending] : [story('en', 'eligible-page-two')], page, limit: 30, total: 31, totalPages: 2 });
    });
    const result = await fetchRegionalStoryPage(new URLSearchParams({ lang: 'en', page: '1', limit: '30' }));
    expect(result.stories.map((item) => item._id)).toEqual(['eligible-page-two']);
    expect(result.pagination).toEqual({ page: 2, limit: 30, total: 31, totalPages: 2, hasMore: false });
    expect(fetchMock.mock.calls.map(([input]) => new URL(String(input), 'https://frontend.test').searchParams.get('page'))).toEqual(['1', '2']);
  });

  test('does not disguise a paginated source failure as exhaustion', async () => {
    fetchMock.mockRejectedValue(new Error('Offline'));
    const { res, payload } = await requestRegional({ page: '2' });
    expect(res.status).toHaveBeenCalledWith(503);
    expect(payload).toEqual({ ok: false, message: 'REGIONAL_FEED_UNAVAILABLE' });
  });

  test('rejects incorrect page/limit metadata instead of appending a repeated or truncated page', () => {
    expect(() => getRegionalPagination({ page: 1, limit: 30 }, { page: 2, limit: 30 })).toThrow('unexpected page or limit');
    expect(() => getRegionalPagination({ page: 1, limit: 60 }, { page: 1, limit: 30 })).toThrow('unexpected page or limit');
    expect(() => getRegionalPagination({ items: Array.from({ length: 31 }, () => story()) }, { page: 1, limit: 30 })).toThrow('exceeded the requested page size');
    expect(() => getRegionalPagination({ page: 1, limit: 30, total: 100, hasMore: false })).toThrow('Inconsistent Regional pagination metadata');
  });

  test.each(['en', 'hi', 'gu'] as const)('uses the requested %s News representation with both language parameters', async (language) => {
    const october = story(language);
    fallbackResponse([october]);

    const { payload } = await requestRegional({ lang: language });

    expect(selectRegionalInitialStories(payload, language).map((item) => item._id)).toEqual([OCTOBER_IDS[language]]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe(`https://backend.test/api/public/regional?state=gujarat&lang=${language}&limit=30`);
    const fallback = new URL(String(fetchMock.mock.calls[1][0]));
    expect(fallback.pathname).toBe('/api/public/news');
    expect(Object.fromEntries(fallback.searchParams)).toEqual({ category: 'regional', lang: language, language, limit: '30' });
    expect(fetchMock.mock.calls[1][1]).toEqual(expect.objectContaining({ method: 'GET', cache: 'no-store' }));
  });

  test('keeps October above May and September stories in publication order', async () => {
    const october = story();
    const may = story('en', 'may', '2026-05-19T09:46:24.291Z');
    const sep22 = story('en', 'sep22', '2026-09-22T18:25:18.049Z');
    const sep14 = story('en', 'sep14', '2026-09-14T06:22:18.973Z');
    const sep9 = story('en', 'sep9', '2026-09-09T05:19:27.713Z');
    const sep8 = story('en', 'sep8', '2026-09-07T20:19:17.688Z');
    fallbackResponse([may, sep9, october, sep8, sep14, sep22]);

    const { payload } = await requestRegional();

    expect(selectRegionalInitialStories(payload, 'en').map((item) => item._id)).toEqual([
      october._id, 'sep22', 'sep14', 'sep9', 'sep8', 'may',
    ]);
  });

  test('accepts exact Regional News without duplicate Gujarat metadata even when other records have it', async () => {
    const october = { ...story(), state: null, geo: { state: null }, tags: [] };
    const tagged = { ...story('en', 'tagged'), tags: ['state:gujarat'] };
    fallbackResponse([tagged, october]);

    const { payload } = await requestRegional({ stateSlug: 'gujarat' });

    expect(unwrapRegionalFeedItems(payload).map((item) => item._id)).toEqual(['tagged', october._id]);
    const fallback = new URL(String(fetchMock.mock.calls[1][0]));
    expect(fallback.searchParams.has('state')).toBe(false);
    expect(fallback.searchParams.has('stateSlug')).toBe(false);
  });

  test.each(['breaking', 'national', 'regional-news', 'Regional'])('does not include non-exact category %s', async (category) => {
    fallbackResponse([story(), { ...story('en', 'excluded'), category }]);

    const { payload } = await requestRegional();

    expect(unwrapRegionalFeedItems(payload).map((item) => item._id)).toEqual([OCTOBER_IDS.en]);
  });

  test('rejects a wrong-language representation even if it contains an approved translation', async () => {
    fallbackResponse([{
      ...story('gu'),
      sourceLanguage: 'gu',
      translationStatus: { en: 'APPROVED' },
      translations: { en: { title: 'English title', content: '<p>English content</p>' } },
    }]);

    const { payload } = await requestRegional();

    expect(unwrapRegionalFeedItems(payload)).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test.each(['pending', 'failed', 'rejected'])('preserves strict rejection of %s translations with no eligible EN representation', async (status) => {
    fallbackResponse([{
      ...story('en'),
      sourceLanguage: 'gu',
      translationStatus: { en: status },
      translations: { en: { title: 'English title', content: '<p>English content</p>' } },
    }]);

    const { payload } = await requestRegional();

    expect(selectRegionalInitialStories(payload, 'en')).toEqual([]);
  });

  test('keeps the existing primary Regional path when it supplies a usable feed', async () => {
    fetchMock.mockResolvedValueOnce(upstream({ items: [story()] }));

    const { payload, res } = await requestRegional();

    expect(unwrapRegionalFeedItems(payload).map((item) => item._id)).toEqual([OCTOBER_IDS.en]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('https://backend.test/api/public/regional?state=gujarat&lang=en&limit=30');
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, max-age=0');
  });

  test('keeps the legacy primary retry and uses News if that retry has no eligible records', async () => {
    fetchMock
      .mockResolvedValueOnce(upstream({}, 404))
      .mockResolvedValueOnce(upstream({ items: [] }))
      .mockResolvedValueOnce(upstream({ items: [story()] }));

    const { payload } = await requestRegional();

    expect(fetchMock.mock.calls[1][0]).toBe('https://backend.test/api/public/regional/gujarat?state=gujarat&lang=en&limit=30');
    expect(new URL(String(fetchMock.mock.calls[2][0])).pathname).toBe('/api/public/news');
    expect(selectRegionalInitialStories(payload, 'en')).toHaveLength(1);
  });

  test.each(['server error', 'network error'])('uses News on a primary %s', async (failure) => {
    if (failure === 'server error') fetchMock.mockResolvedValueOnce(upstream({}, 503));
    else fetchMock.mockRejectedValueOnce(new Error('Offline'));
    fetchMock.mockResolvedValueOnce(upstream({ items: [story()] }));

    const { payload } = await requestRegional();

    expect(new URL(String(fetchMock.mock.calls[1][0])).pathname).toBe('/api/public/news');
    expect(selectRegionalInitialStories(payload, 'en')).toHaveLength(1);
  });

  test('does not retry without language or use Public Articles when News is empty', async () => {
    fallbackResponse([]);

    const { payload } = await requestRegional();

    expect(unwrapRegionalFeedItems(payload)).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new URL(String(fetchMock.mock.calls[1][0])).searchParams.get('language')).toBe('en');
  });

  test('preserves district filtering and forwards city, topic, search and cumulative limit', async () => {
    fallbackResponse([
      { ...story('en', 'ahmedabad'), tags: ['district:ahmedabad'] },
      { ...story('en', 'surat'), tags: ['district:surat'] },
    ]);

    const { payload } = await requestRegional({ district: 'ahmedabad', city: 'maninagar', topic: 'civic', q: 'bridge', limit: '60' });

    expect(unwrapRegionalFeedItems(payload).map((item) => item._id)).toEqual(['ahmedabad']);
    const fallback = new URL(String(fetchMock.mock.calls[1][0]));
    expect(Object.fromEntries(fallback.searchParams)).toEqual({
      category: 'regional', lang: 'en', language: 'en', district: 'ahmedabad', city: 'maninagar', topic: 'civic', q: 'bridge', limit: '60',
    });
  });

  test('does not bypass state filtering outside the Gujarat News compatibility rule', async () => {
    fallbackResponse([
      { ...story('en', 'gujarat'), tags: ['state:gujarat'] },
      { ...story('en', 'maharashtra'), tags: ['state:maharashtra'] },
    ]);

    const { payload } = await requestRegional({ state: 'maharashtra' });

    expect(unwrapRegionalFeedItems(payload).map((item) => item._id)).toEqual(['maharashtra']);
    expect(new URL(String(fetchMock.mock.calls[1][0])).searchParams.get('state')).toBe('maharashtra');
  });

  test('preserves suppression, publication checks and first-occurrence slug deduplication', async () => {
    fallbackResponse([
      story(),
      { ...story('en', 'duplicate'), slug: OCTOBER_IDS.en },
      { ...story('en', 'draft'), status: 'draft' },
      { ...story('en', 'deleted'), deleted: true },
      ...[...REGIONAL_BLOCKED_IDS].map((id) => story('en', id)),
    ]);

    const { payload } = await requestRegional();

    expect(selectRegionalInitialStories(payload, 'en').map((item) => item._id)).toEqual([OCTOBER_IDS.en]);
  });

  test.each(['en', 'hi', 'gu'] as const)('initial %s fallback matches browser ordering with October above September and May', async (language) => {
    const may = story(language, 'may', '2026-05-19T09:46:24.291Z');
    const primary = { items: [{ ...may, status: undefined }] };
    const news = { items: [
      may,
      story(language, 'sep9', '2026-09-09T05:19:27.713Z'),
      story(language),
      story(language, 'sep8', '2026-09-07T20:19:17.688Z'),
      story(language, 'sep14', '2026-09-14T06:22:18.973Z'),
      story(language, 'sep22', '2026-09-22T18:25:18.049Z'),
    ] };
    for (let read = 0; read < 2; read++) {
      fetchMock.mockResolvedValueOnce(upstream(primary)).mockResolvedValueOnce(upstream(news));
    }
    const params = new URLSearchParams({ state: 'gujarat', lang: language, limit: '30' });

    const initial = await fetchRegionalInitialStories(params, { server: true });
    const { payload } = await requestRegional({ lang: language });
    const refreshed = selectRegionalInitialStories(payload, language);

    expect(initial.map((item) => item._id)).toEqual([OCTOBER_IDS[language], 'sep22', 'sep14', 'sep9', 'sep8', 'may']);
    expect(initial).toEqual(refreshed);
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchMock.mock.calls.slice(0, 2).map(([url]) => url)).toEqual(fetchMock.mock.calls.slice(2).map(([url]) => url));
    expect(fetchMock.mock.calls[0][0]).toBe(`https://backend.test/api/public/regional?${params}`);
    const fallback = new URL(String(fetchMock.mock.calls[1][0]));
    expect(fallback.pathname).toBe('/api/public/news');
    expect(Object.fromEntries(fallback.searchParams)).toEqual({ category: 'regional', lang: language, language, limit: '30' });
  });

  test.each(['en', 'hi', 'gu'] as const)('initial %s primary success does not request a fallback', async (language) => {
    fetchMock.mockResolvedValueOnce(upstream({ items: [
      story(language, 'may', '2026-05-19T09:46:24.291Z'),
      story(language),
    ] }));
    const params = new URLSearchParams({ state: 'gujarat', lang: language, limit: '30' });

    const initial = await fetchRegionalInitialStories(params, { server: true });

    expect(initial.map((item) => item._id)).toEqual([OCTOBER_IDS[language], 'may']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`https://backend.test/api/public/regional?${params}`);
  });

  test('initial loading falls back after publication and raw-language eligibility leave no primary stories', async () => {
    fetchMock
      .mockResolvedValueOnce(upstream({ items: [story('gu'), { ...story('en', 'draft'), status: 'draft' }] }))
      .mockResolvedValueOnce(upstream({ items: [story()] }));

    const initial = await fetchRegionalInitialStories(new URLSearchParams({ state: 'gujarat', lang: 'en', limit: '30' }), { server: true });

    expect(initial.map((item) => item._id)).toEqual([OCTOBER_IDS.en]);
    expect(new URL(String(fetchMock.mock.calls[1][0])).pathname).toBe('/api/public/news');
  });

  test('initial loading keeps the same legacy retry before falling back to News', async () => {
    fetchMock
      .mockResolvedValueOnce(upstream({}, 404))
      .mockResolvedValueOnce(upstream({ items: [] }))
      .mockResolvedValueOnce(upstream({ items: [story()] }));

    const initial = await fetchRegionalInitialStories(new URLSearchParams({ state: 'gujarat', lang: 'en', limit: '30' }), { server: true });

    expect(initial.map((item) => item._id)).toEqual([OCTOBER_IDS.en]);
    expect(new URL(String(fetchMock.mock.calls[1][0])).pathname).toBe('/api/public/regional/gujarat');
    expect(new URL(String(fetchMock.mock.calls[2][0])).pathname).toBe('/api/public/news');
  });

  test.each(['server error', 'network error'])('initial loading uses the same News fallback after a primary %s', async (failure) => {
    if (failure === 'server error') fetchMock.mockResolvedValueOnce(upstream({}, 503));
    else fetchMock.mockRejectedValueOnce(new Error('Offline'));
    fetchMock.mockResolvedValueOnce(upstream({ items: [story()] }));

    const initial = await fetchRegionalInitialStories(new URLSearchParams({ state: 'gujarat', lang: 'en', limit: '30' }), { server: true });

    expect(initial.map((item) => item._id)).toEqual([OCTOBER_IDS.en]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(new URL(String(fetchMock.mock.calls[1][0])).pathname).toBe('/api/public/news');
  });

  test('initial HTTP failure still rejects if News is also unavailable', async () => {
    fetchMock.mockResolvedValueOnce(upstream({}, 503)).mockResolvedValueOnce(upstream({}, 503));

    await expect(fetchRegionalInitialStories(new URLSearchParams({ state: 'gujarat', lang: 'en', limit: '30' }), { server: true }))
      .rejects.toThrow('Regional feed unavailable (503)');
  });

  test.each(['empty', 'malformed'])('initial %s primary plus unavailable News rejects without changing the browser error response', async (primary) => {
    for (let read = 0; read < 2; read++) {
      fetchMock
        .mockResolvedValueOnce(primary === 'empty' ? upstream({ items: [] }) : new Response('Invalid JSON'))
        .mockResolvedValueOnce(upstream({}, 503));
    }

    await expect(fetchRegionalInitialStories(new URLSearchParams({ state: 'gujarat', lang: 'en', limit: '30' }), { server: true }))
      .rejects.toThrow('Regional News fallback unavailable');
    const { res, payload } = await requestRegional();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(unwrapRegionalFeedItems(payload)).toEqual([]);
    expect(payload).not.toHaveProperty('upstreamError');
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  test.each(['headers', 'body'])('the existing four-second initial deadline also cancels stalled News fallback %s', async (stage) => {
    jest.useFakeTimers();
    fetchMock.mockResolvedValueOnce(upstream({ items: [] })).mockImplementationOnce(() => {
      if (stage === 'headers') return new Promise<Response>(() => {});
      const response = upstream({ items: [] });
      jest.spyOn(response, 'text').mockReturnValue(new Promise<string>(() => {}));
      return Promise.resolve(response);
    });

    const pending = fetchRegionalInitialStories(new URLSearchParams({ state: 'gujarat', lang: 'en', limit: '30' }), { server: true });
    const rejection = expect(pending).rejects.toThrow('Public read timed out');
    await jest.advanceTimersByTimeAsync(4000);
    await rejection;

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]?.signal?.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });
});
