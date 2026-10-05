import type { NextApiRequest, NextApiResponse } from 'next';
import handler, { ORDINARY_CATEGORY_PROXY_TIMEOUT_MS } from '../../../pages/api/public/news';
import { ORDINARY_PAGINATION_HEADER } from '../../../lib/ordinaryCategoryPagination';

jest.mock('../../../lib/publicApiBase', () => ({ getPublicApiBaseUrl: () => 'https://backend.test' }));

const categories = ['national', 'international', 'business', 'tech', 'tech-gadgets', 'sports', 'lifestyle', 'glamour'];
const protectedCategories = ['regional', 'faith-culture', 'editorial', 'web-stories', 'viral-videos', 'pulse-dialogue', 'youth-pulse', 'community-reporter', 'inspiration-hub'];

function story(category: string, language: string, index = 0) {
  return {
    _id: `story-${index}`, category, language, title: `Story ${index}`, content: 'Body', status: 'published',
    publishedAt: '2026-09-01T12:00:00.000Z',
  };
}

async function request(category: string, locale = 'en', options: { page?: number; limit?: number; optIn?: boolean } = {}) {
  const params = new URLSearchParams({
    category, lang: locale, language: locale,
    page: String(options.page ?? 2), limit: String(options.limit ?? (category === 'national' ? 20 : 30)),
  });
  if (category !== 'national') params.set('strictLocale', '1');
  const req = {
    method: 'GET', url: `/api/public/news?${params}`, query: Object.fromEntries(params),
    headers: options.optIn === false ? {} : { [ORDINARY_PAGINATION_HEADER.toLowerCase()]: '1' },
  };
  const status = jest.fn();
  const json = jest.fn();
  const res: Partial<NextApiResponse> = { status, json, setHeader: jest.fn() };
  status.mockReturnValue(res);
  json.mockReturnValue(res);
  await handler(req as NextApiRequest, res as NextApiResponse);
  return { status: status.mock.calls.at(-1)?.[0], body: json.mock.calls.at(-1)?.[0] };
}

describe('opt-in ordinary category News pagination proxy', () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock;
    jest.spyOn(console, 'info').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe.each(categories)('%s', (category) => {
    test.each(['en', 'hi', 'gu'])('%s preserves the primary page with one bounded requested-language GET', async (locale) => {
      const limit = category === 'national' ? 20 : 30;
      const items = [story(category, locale)];
      fetchMock.mockResolvedValue(new Response(JSON.stringify({ items, page: 2, limit, total: 100, totalPages: Math.ceil(100 / limit) })));
      const result = await request(category, locale);
      expect(result.status).toBe(200);
      expect(result.body.items).toEqual(items);
      expect(result.body.pagination).toEqual({ page: 2, limit, total: 100, totalPages: Math.ceil(100 / limit), hasMore: true });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [input, init] = fetchMock.mock.calls[0];
      const url = new URL(String(input));
      expect(url.pathname).toBe('/api/public/news');
      expect(url.searchParams.get('category')).toBe(category);
      expect(url.searchParams.get('lang')).toBe(locale);
      expect(url.searchParams.get('language')).toBe(locale);
      expect(url.searchParams.get('page')).toBe('2');
      expect(url.searchParams.get('limit')).toBe(String(limit));
      expect(url.searchParams.get('strictLocale')).toBe(category === 'national' ? null : '1');
      expect(new Headers(init?.headers).has(ORDINARY_PAGINATION_HEADER)).toBe(false);
    });
  });

  test.each(protectedCategories)('does not admit %s into the new opt-in contract', async (category) => {
    const result = await request(category);
    expect(result.status).toBe(400);
    expect(result.body.error).toMatch(/Unsupported/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test.each(['business', ...protectedCategories])('%s without opt-in retains its existing response and widening behavior', async (category) => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify({
      items: [story(category, 'en')], page: 2, limit: 30, total: 100, totalPages: 4,
    })));
    const result = await request(category, 'en', { optIn: false });
    expect(result.status).toBe(200);
    expect(result.body.pagination).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const widened = new URL(String(fetchMock.mock.calls[1][0]));
    expect(widened.searchParams.has('lang')).toBe(false);
    expect(widened.searchParams.has('language')).toBe(false);
    expect(widened.searchParams.get('limit')).toBe('90');
  });

  test('does not infer exhaustion from the page after strict visibility filtering', async () => {
    const items = Array.from({ length: 30 }, (_, index) => ({ ...story('business', 'en', index), status: 'draft' }));
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ items, page: 1, limit: 30, total: 90, totalPages: 3 })));
    const result = await request('business', 'en', { page: 1 });
    expect(result.status).toBe(200);
    expect(result.body.items).toEqual([]);
    expect(result.body.total).toBe(90);
    expect(result.body.pagination).toEqual({ page: 1, limit: 30, total: 90, totalPages: 3, hasMore: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test.each(['pending', 'failed', 'rejected'])('does not use a %s cross-locale record to fill a strict page', async (status) => {
    const item = {
      ...story('business', 'gu'), sourceLanguage: 'gu', translationStatus: { en: status },
      translations: { en: { title: 'English text', content: 'English body' } },
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ items: [item], page: 1, limit: 30, total: 1, totalPages: 1 })));
    const result = await request('business', 'en', { page: 1 });
    expect(result.body.items).toEqual([]);
    expect(result.body.pagination.hasMore).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('returns a failure instead of trimming an oversized backend response into a fake page', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      items: Array.from({ length: 31 }, (_, index) => story('business', 'en', index)),
      page: 2, limit: 30, total: 100, totalPages: 4,
    })));
    expect((await request('business')).status).toBe(503);
  });

  test('rejects a backend that ignores the requested page', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      items: [story('business', 'en')], page: 1, limit: 30, total: 100, totalPages: 4,
    })));
    expect((await request('business')).status).toBe(503);
  });

  test.each(['invalid JSON', '{}', 'null'])('returns an explicit error for a malformed primary response: %s', async (body) => {
    fetchMock.mockResolvedValue(new Response(body));
    expect((await request('business')).status).toBe(503);
  });

  test.each([{ page: 0 }, { limit: 60 }, { limit: 100000 }])('rejects invalid/unbounded requests before fetching: %j', async (options) => {
    expect((await request('business', 'en', options)).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('does not report an upstream failure as a successful empty final page', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'Unavailable' }), { status: 503 }));
    const result = await request('business');
    expect(result).toEqual({ status: 503, body: { error: 'CATEGORY_NEWS_UNAVAILABLE' } });
  });

  test('bounds a stalled proxy request and releases its deadline timer', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation(() => new Promise(() => {}));
    const pending = request('business');
    await jest.advanceTimersByTimeAsync(ORDINARY_CATEGORY_PROXY_TIMEOUT_MS);
    expect(await pending).toEqual({ status: 503, body: { error: 'CATEGORY_NEWS_UNAVAILABLE' } });
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });
});
