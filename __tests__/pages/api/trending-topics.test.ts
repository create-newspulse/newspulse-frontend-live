import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import handler from '../../../pages/api/public/trending-topics';
import { getPublicApiBaseUrl } from '../../../lib/publicApiBase';
import { EDITORIAL_TOPICS_TIMEOUT_MS } from '../../../lib/publicEditorialTopics';
import { DEFAULT_TRENDING_TOPICS } from '../../../src/config/trendingTopics';
import { jsonResponse, topicFixture, topicNames } from '../../fixtures/editorialTopics';

jest.mock('../../../lib/publicApiBase', () => ({ getPublicApiBaseUrl: jest.fn(() => 'http://localhost:3010') }));
const originalFetch = global.fetch;
const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();

function response(req: IncomingMessage) {
  return Object.assign(new ServerResponse(req), {
    setHeader: jest.fn().mockReturnThis(), status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(),
    send: jest.fn(), redirect: jest.fn().mockReturnThis(), setDraftMode: jest.fn().mockReturnThis(),
    setPreviewData: jest.fn().mockReturnThis(), clearPreviewData: jest.fn().mockReturnThis(),
    revalidate: jest.fn(async () => {}),
  }) satisfies NextApiResponse;
}
async function invoke(lang: string | string[] = 'en', method = 'GET') {
  const req: NextApiRequest = Object.assign(new IncomingMessage(new Socket()), {
    method, query: { lang }, cookies: {}, body: undefined, env: {},
  });
  const res = response(req);
  await handler(req, res);
  return res;
}
beforeEach(() => {
  global.fetch = fetchMock;
  fetchMock.mockReset();
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test.each(['en', 'hi', 'gu'] as const)('merges six ordered %s editorials before every existing shortcut', async (lang) => {
  const editorial = Array.from({ length: 6 }, (_, index) => topicFixture(lang, { slug: `topic-${index}` }));
  fetchMock.mockImplementation(async (input) => String(input).includes('/api/public/topics?')
    ? jsonResponse({ ok: true, lang, items: editorial }) : jsonResponse(DEFAULT_TRENDING_TOPICS));
  const res = await invoke(lang);
  const body = res.json.mock.calls[0][0];
  expect(body.items.slice(0, 6).map((item: { key: string }) => item.key)).toEqual(editorial.map((item) => item.slug));
  expect(body.items.slice(6)).toEqual(DEFAULT_TRENDING_TOPICS);
  expect(body.items[0]).toMatchObject({ label: topicNames[lang], colorKey: 'sports', source: 'editorial' });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
    `http://localhost:3010/api/public/topics?lang=${lang}&limit=6`,
    'http://localhost:3010/api/public/trending-topics',
  ]);
});

test('an empty editorial response leaves the legacy list unchanged', async () => {
  fetchMock.mockImplementation(async (input) => String(input).includes('/api/public/topics?')
    ? jsonResponse({ ok: true, lang: 'en', items: [] }) : jsonResponse({ items: DEFAULT_TRENDING_TOPICS }));
  expect((await invoke()).json).toHaveBeenCalledWith({ items: DEFAULT_TRENDING_TOPICS });
});

test.each(['reject', '404', '503', 'malformed', 'too-many'])('editorial %s failure cannot empty or replace the legacy strip', async (failure) => {
  fetchMock.mockImplementation(async (input) => {
    if (!String(input).includes('/api/public/topics?')) return jsonResponse(DEFAULT_TRENDING_TOPICS);
    if (failure === 'reject') throw new Error('offline');
    if (failure === 'malformed') return jsonResponse({ ok: true, lang: 'en', items: [null] });
    if (failure === 'too-many') return jsonResponse({ ok: true, lang: 'en', items: Array(7).fill(topicFixture()) });
    return jsonResponse({}, Number(failure));
  });
  expect((await invoke()).json).toHaveBeenCalledWith({ items: DEFAULT_TRENDING_TOPICS, editorialReadError: true });
  expect(console.warn).toHaveBeenCalled();
});

test.each(['reject', '503', 'empty', 'legacy-wrapper'])('legacy %s preserves editorial topics plus the working defaults', async (failure) => {
  fetchMock.mockImplementation(async (input) => {
    if (String(input).includes('/api/public/topics?')) return jsonResponse({ ok: true, lang: 'en', items: [topicFixture()] });
    if (failure === 'reject') throw new Error('offline');
    if (failure === '503') return jsonResponse({}, 503);
    if (failure === 'empty') return jsonResponse([]);
    return jsonResponse({ success: true, data: { items: [
      { key: 'gold-rates', label: 'Gold rates', href: '/gold-rates', colorKey: 'yellow' },
    ] } });
  });
  const body = (await invoke()).json.mock.calls[0][0];
  expect(body.items).toHaveLength(10);
  expect(body.items[0].source).toBe('editorial');
  expect(body.items.slice(1)).toEqual(DEFAULT_TRENDING_TOPICS);
});

test('dedupes editorial keys/hrefs and lets editorial beat matching legacy entries', async () => {
  fetchMock.mockImplementation(async (input) => String(input).includes('/api/public/topics?')
    ? jsonResponse({ ok: true, lang: 'en', items: [topicFixture('en', { slug: 'sports' }), topicFixture('en', { slug: 'sports' })] })
    : jsonResponse([...DEFAULT_TRENDING_TOPICS, { key: 'alias', label: 'Alias', href: '/topic/sports', colorKey: 'sports' }]));
  const body = (await invoke()).json.mock.calls[0][0];
  expect(body.items.filter((item: { key: string }) => item.key === 'sports')).toHaveLength(1);
  expect(body.items[0]).toMatchObject({ key: 'sports', source: 'editorial' });
  expect(body.items.some((item: { key: string }) => item.key === 'alias')).toBe(false);
  expect(body.items.filter((item: { href: string }) => item.href === '/business')).toHaveLength(3);
});

test('parallel reads finish on their deadline and preserve the successful legacy result', async () => {
  jest.useFakeTimers();
  fetchMock.mockImplementation((input) => String(input).includes('/api/public/topics?')
    ? new Promise(() => {}) : Promise.resolve(jsonResponse(DEFAULT_TRENDING_TOPICS)));
  const pending = invoke();
  await jest.advanceTimersByTimeAsync(EDITORIAL_TOPICS_TIMEOUT_MS);
  expect((await pending).json).toHaveBeenCalledWith({ items: DEFAULT_TRENDING_TOPICS, editorialReadError: true });
  expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
});

test('a legacy timeout retains editorial topics followed by all nine defaults', async () => {
  jest.useFakeTimers();
  fetchMock.mockImplementation((input) => String(input).includes('/api/public/topics?')
    ? Promise.resolve(jsonResponse({ ok: true, lang: 'en', items: [topicFixture()] }))
    : new Promise(() => {}));
  const pending = invoke();
  await jest.advanceTimersByTimeAsync(EDITORIAL_TOPICS_TIMEOUT_MS);
  const body = (await pending).json.mock.calls[0][0];
  expect(body.items[0].source).toBe('editorial');
  expect(body.items.slice(1)).toEqual(DEFAULT_TRENDING_TOPICS);
  expect(fetchMock.mock.calls[1][1]?.signal?.aborted).toBe(true);
});

test('two stalled upstreams share a four-second window, not serial deadlines', async () => {
  jest.useFakeTimers();
  fetchMock.mockImplementation(() => new Promise(() => {}));
  const pending = invoke();
  await jest.advanceTimersByTimeAsync(EDITORIAL_TOPICS_TIMEOUT_MS);
  expect((await pending).json).toHaveBeenCalledWith({ items: DEFAULT_TRENDING_TOPICS, editorialReadError: true });
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls.every(([, init]) => init?.signal?.aborted)).toBe(true);
});

test.each([{ lang: 'fr' }, { lang: ['en', 'gu'] }])('invalid locale $lang is an explicit 400 without upstream calls', async ({ lang }) => {
  const res = await invoke(lang);
  expect(res.status).toHaveBeenCalledWith(400);
  expect(fetchMock).not.toHaveBeenCalled();
});

test('non-GET requests cannot reach either backend endpoint', async () => {
  const res = await invoke('en', 'POST');
  expect(res.status).toHaveBeenCalledWith(405);
  expect(res.setHeader).toHaveBeenCalledWith('Allow', 'GET');
  expect(fetchMock).not.toHaveBeenCalled();
});

test('no configured backend preserves client defaults without an upstream call', async () => {
  jest.mocked(getPublicApiBaseUrl).mockReturnValueOnce('');
  expect((await invoke()).json).toHaveBeenCalledWith({ items: [], editorialReadError: true });
  expect(fetchMock).not.toHaveBeenCalled();
});
