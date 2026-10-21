/** @jest-environment node */
import type { NextApiRequest, NextApiResponse } from 'next';
import newsHandler, { PUBLIC_NEWS_PROXY_TIMEOUT_MS } from '../../../pages/api/public/news';
import { getPublicApiBaseUrl } from '../../../lib/publicApiBase';
import { ORDINARY_PAGINATION_HEADER } from '../../../lib/ordinaryCategoryPagination';
import { FAITH_CULTURE_PAGINATION_HEADER } from '../../../lib/faithCulturePagination';
import { SPONSORED_NEWS_INVALID_RESPONSE } from '../../../lib/publicSponsoredNews';
import { sponsoredArticleFixture, sponsoredNewsFixture } from '../../fixtures/sponsoredNews';

jest.mock('../../../lib/publicApiBase', () => ({ getPublicApiBaseUrl: jest.fn(() => 'http://backend.test') }));

const originalFetch = global.fetch;
const fetchMock = jest.fn();
const query = { sponsoredOnly: 'true', lang: 'gu', page: '2', limit: '12' };

async function request(overrides: NextApiRequest['query'] = {}, headers: NextApiRequest['headers'] = {}, method = 'GET') {
  let status = 200;
  let body: unknown;
  const responseHeaders: Record<string, unknown> = {};
  const res: Partial<NextApiResponse> = {
    setHeader: jest.fn((name, value) => { responseHeaders[name] = value; return res as NextApiResponse; }),
    status: jest.fn((code) => { status = code; return res as NextApiResponse; }),
    json: jest.fn((value) => { body = value; return res as NextApiResponse; }),
  };
  const req: Partial<NextApiRequest> = { method, headers, query: { ...query, ...overrides }, url: '/api/public/news' };
  await newsHandler(req as NextApiRequest, res as NextApiResponse);
  return { status, body, headers: responseHeaders };
}

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
  jest.mocked(getPublicApiBaseUrl).mockReturnValue('http://backend.test');
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test.each(['gu', 'hi', 'en'] as const)('%s opt-in is forwarded once, without locale widening or regrouping', async (lang) => {
  const payload = sponsoredNewsFixture(lang, 2);
  fetchMock.mockResolvedValue(new Response(JSON.stringify(payload)));
  const result = await request({ lang });
  expect(result.status).toBe(200);
  expect(result.headers['Cache-Control']).toContain('no-store');
  expect(result.body).toMatchObject({ page: 2, limit: 12, total: 25, totalPages: 3 });
  expect(result.body).toHaveProperty('items', payload.items);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toBe(`http://backend.test/api/public/news?sponsoredOnly=true&lang=${lang}&page=2&limit=12`);
});

test.each([
  { sponsoredOnly: 'false' }, { sponsoredOnly: 'yes' }, { sponsoredOnly: ['true', 'true'] },
  { lang: 'fr' }, { lang: ['gu', 'en'] }, { page: '0' }, { page: ['1', '2'] }, { limit: '13' },
  { category: 'business' }, { spotlight: '1' }, { q: 'sponsored' },
])('malformed/conflicting opt-in is a no-store 400: %j', async (overrides) => {
  const result = await request(overrides);
  expect(result.status).toBe(400);
  expect(result.headers['Cache-Control']).toContain('no-store');
  expect(fetchMock).not.toHaveBeenCalled();
});

test.each([ORDINARY_PAGINATION_HEADER, FAITH_CULTURE_PAGINATION_HEADER, 'X-NewsPulse-Homepage-Recovery'])('rejects the incompatible %s contract', async (header) => {
  expect((await request({}, { [header.toLowerCase()]: '1' })).status).toBe(400);
  expect(fetchMock).not.toHaveBeenCalled();
});

test('a backend ignoring sponsoredOnly fails instead of showing ordinary articles or invented totals', async () => {
  const payload = sponsoredNewsFixture('gu', 2);
  payload.items[0] = sponsoredArticleFixture(13, 'gu', { isSponsoredArticle: false });
  fetchMock.mockResolvedValue(new Response(JSON.stringify(payload)));
  const result = await request();
  expect(result).toMatchObject({ status: 503, body: { error: SPONSORED_NEWS_INVALID_RESPONSE } });
  expect(result.headers['Cache-Control']).toContain('no-store');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('503 retains a safe Retry-After, never a successful empty list', async () => {
  fetchMock.mockResolvedValue(new Response('{"error":"unavailable"}', { status: 503, headers: { 'Retry-After': '45' } }));
  expect(await request()).toMatchObject({
    status: 503, body: { error: 'SPONSORED_NEWS_UNAVAILABLE' }, headers: { 'Retry-After': '45' },
  });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('an unconfigured server cannot fall back to production or loop back to itself', async () => {
  jest.mocked(getPublicApiBaseUrl).mockReturnValue('');
  expect((await request()).status).toBe(503);
  expect(fetchMock).not.toHaveBeenCalled();
});

test('a genuine empty response keeps backend zero totals', async () => {
  const payload = sponsoredNewsFixture('gu', 1, 0);
  fetchMock.mockResolvedValue(new Response(JSON.stringify(payload)));
  expect(await request({ page: '1' })).toMatchObject({ status: 200, body: payload });
});

test.each(['not JSON', '{"items":[]}', '{"items":[],"page":2,"limit":12,"total":20,"totalPages":2}'])('invalid body is a contract failure: %s', async (body) => {
  fetchMock.mockResolvedValue(new Response(body));
  expect(await request()).toMatchObject({ status: 503, body: { error: SPONSORED_NEWS_INVALID_RESPONSE } });
});

test('the proxy deadline bounds the response body and cancels the nested reader', async () => {
  jest.useFakeTimers();
  let signal: AbortSignal | undefined;
  fetchMock.mockImplementation((_url: string, options: RequestInit) => {
    signal = options.signal ?? undefined;
    return Promise.resolve({ ok: true, status: 200, headers: new Headers(), text: () => new Promise(() => {}) });
  });
  const pending = request();
  await jest.advanceTimersByTimeAsync(PUBLIC_NEWS_PROXY_TIMEOUT_MS);
  expect(await pending).toMatchObject({ status: 503, body: { error: 'SPONSORED_NEWS_UNAVAILABLE' } });
  expect(signal?.aborted).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});

test('the existing GET-only method contract remains intact', async () => {
  expect(await request({}, {}, 'POST')).toMatchObject({ status: 405, headers: { Allow: 'GET' } });
  expect(fetchMock).not.toHaveBeenCalled();
});
