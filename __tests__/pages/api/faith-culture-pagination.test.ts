import type { NextApiRequest, NextApiResponse } from 'next';
import handler, { ORDINARY_CATEGORY_PROXY_TIMEOUT_MS } from '../../../pages/api/public/news';
import { FAITH_CULTURE_NEWS_UNAVAILABLE, FAITH_CULTURE_PAGINATION_HEADER } from '../../../lib/faithCulturePagination';
import { ORDINARY_PAGINATION_HEADER } from '../../../lib/ordinaryCategoryPagination';
import { faithPage, faithStories } from '../../fixtures/faithCulture';

let mockApiBase = 'https://backend.test';
jest.mock('../../../lib/publicApiBase', () => ({ getPublicApiBaseUrl: () => mockApiBase }));

async function request(query: Record<string, string> = {}) {
  const params = new URLSearchParams({
    category: 'faith-culture', lang: 'en', language: 'en', page: '1', limit: '30', ...query,
  });
  const req = {
    method: 'GET', url: `/api/public/news?${params}`, query: Object.fromEntries(params),
    headers: { [FAITH_CULTURE_PAGINATION_HEADER.toLowerCase()]: '1' },
  };
  const status = jest.fn();
  const json = jest.fn();
  const setHeader = jest.fn();
  const res: Partial<NextApiResponse> = { status, json, setHeader };
  status.mockReturnValue(res);
  json.mockReturnValue(res);
  await handler(req as NextApiRequest, res as NextApiResponse);
  return { status: status.mock.calls.at(-1)?.[0], body: json.mock.calls.at(-1)?.[0], setHeader };
}

describe('Faith-specific strict News proxy', () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
  beforeEach(() => {
    mockApiBase = 'https://backend.test';
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

  test.each(['en', 'hi', 'gu'] as const)('%s forwards pages 1-4 once each without widening or replacing backend page membership', async (locale) => {
    const all = faithStories(locale);
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe('/api/public/news');
      expect(url.searchParams.get('category')).toBe('faith-culture');
      expect(url.searchParams.get('lang')).toBe(locale);
      expect(url.searchParams.get('language')).toBe(locale);
      expect(url.searchParams.get('limit')).toBe('30');
      expect(new Headers(init?.headers).has(FAITH_CULTURE_PAGINATION_HEADER)).toBe(false);
      expect(new Headers(init?.headers).has(ORDINARY_PAGINATION_HEADER)).toBe(false);
      return new Response(JSON.stringify(faithPage(all, Number(url.searchParams.get('page')))));
    });
    const counts: number[] = [];
    for (const page of [1, 2, 3, 4]) {
      const result = await request({ lang: locale, language: locale, page: String(page) });
      const { items, ...pagination } = faithPage(all, page);
      expect(result.status).toBe(200);
      expect(result.body.items).toEqual(items);
      expect(result.body.pagination).toEqual(pagination);
      counts.push(result.body.items.length);
      expect(fetchMock).toHaveBeenCalledTimes(page);
    }
    expect(counts).toEqual([30, 30, 30, 10]);
  });

  test('leaves logical-story selection to the consumer rather than silently shortening a backend page', async () => {
    const all = faithStories('en', 2).map(item => ({ ...item, translationGroupId: 'same-story' }));
    fetchMock.mockResolvedValue(new Response(JSON.stringify(faithPage(all, 1))));
    const result = await request();
    expect(result.body.items).toHaveLength(2);
    expect(result.body.pagination.total).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test.each(['regional', 'national', 'international', 'business', 'tech', 'tech-gadgets', 'sports', 'lifestyle', 'glamour', 'editorial', 'web-stories', 'viral-videos', 'pulse-dialogue', 'youth-pulse', ''])(
    'does not opt %s into the Faith contract', async (category) => {
      expect((await request({ category })).status).toBe(400);
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  test.each<Record<string, string>>([
    { lang: 'gu', language: 'en' }, { lang: '', language: 'hi' }, { lang: 'fr', language: 'fr' },
    { page: '0' }, { limit: '60' }, { limit: '90' }, { limit: '120' },
  ])('rejects an invalid Faith request: %j', async (query) => {
    expect((await request(query)).status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test.each(['invalid JSON', '{}', 'null'])('fails closed on malformed payload: %s', async (body) => {
    fetchMock.mockResolvedValue(new Response(body));
    const result = await request();
    expect(result.status).toBe(503);
    expect(result.body).toEqual({ error: FAITH_CULTURE_NEWS_UNAVAILABLE });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test.each([
    { page: 2 }, { limit: 90 }, { hasMore: undefined }, { totalPages: 99 },
  ])('fails closed on invalid backend metadata: %j', async (overrides) => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      ...faithPage(faithStories('en'), 1), ...overrides,
    })));
    expect((await request()).status).toBe(503);
  });

  test('does not trim an oversized backend response into a fake valid page', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({
      ...faithPage(faithStories('en'), 1), items: faithStories('en', 31),
    })));
    expect((await request()).status).toBe(503);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('503 stays 503, preserves Retry-After and never exposes backend diagnostics', async () => {
    fetchMock.mockResolvedValue(new Response('private database diagnostics', { status: 503, headers: { 'Retry-After': '10' } }));
    const result = await request();
    expect(result.status).toBe(503);
    expect(result.body).toEqual({ error: FAITH_CULTURE_NEWS_UNAVAILABLE });
    expect(result.setHeader).toHaveBeenCalledWith('Retry-After', '10');
    expect(result.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('missing local backend configuration is a failure, not an empty final page', async () => {
    mockApiBase = '';
    expect((await request()).status).toBe(503);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('a stalled backend is bounded and cancels its request', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation(() => new Promise(() => {}));
    const pending = request();
    await jest.advanceTimersByTimeAsync(ORDINARY_CATEGORY_PROXY_TIMEOUT_MS);
    expect((await pending).status).toBe(503);
    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });
});
