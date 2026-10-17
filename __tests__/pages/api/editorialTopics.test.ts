/** @jest-environment node */
import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import handler from '../../../pages/api/public/topics/[...path]';
import { getPublicApiBaseUrl } from '../../../lib/publicApiBase';
import { EDITORIAL_TOPICS_TIMEOUT_MS } from '../../../lib/publicEditorialTopics';
import { jsonResponse, storyFixture, storyPageFixture, topicFixture } from '../../fixtures/editorialTopics';

jest.mock('../../../lib/publicApiBase', () => ({ getPublicApiBaseUrl: jest.fn(() => 'http://localhost:3010') }));
const originalFetch = global.fetch;
const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();

async function invoke(path: string | string[] = ['navratri-2026'], query: NextApiRequest['query'] = {}, method = 'GET') {
  const req: NextApiRequest = Object.assign(new IncomingMessage(new Socket()), {
    method, query: { path, ...query }, cookies: {}, body: undefined, env: {},
  });
  const res = Object.assign(new ServerResponse(req), {
    setHeader: jest.fn().mockReturnThis(), status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(),
    send: jest.fn(), redirect: jest.fn().mockReturnThis(), setDraftMode: jest.fn().mockReturnThis(),
    setPreviewData: jest.fn().mockReturnThis(), clearPreviewData: jest.fn().mockReturnThis(),
    revalidate: jest.fn(async () => {}),
  }) satisfies NextApiResponse;
  await handler(req, res);
  return res;
}

beforeEach(() => {
  global.fetch = fetchMock;
  fetchMock.mockReset();
  jest.mocked(getPublicApiBaseUrl).mockReturnValue('http://localhost:3010');
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe.each(['en', 'hi', 'gu'] as const)('%s public topic transport', (lang) => {
  test.each([true, false])('returns the existing validated detail with pin=%s, not private upstream fields', async (pinned) => {
    fetchMock.mockResolvedValue(jsonResponse({
      ok: true, lang, topic: { ...topicFixture(lang), privateNotes: 'not public' },
      pinnedArticle: pinned ? { ...storyFixture(100, lang), reporterEmail: 'private@example.test' } : null,
    }));
    const res = await invoke(undefined, { lang });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    const body = res.json.mock.calls[0][0];
    expect(body).toMatchObject({ ok: true, lang, topic: { slug: 'navratri-2026' } });
    expect(body.pinnedArticle?._id ?? null).toBe(pinned ? storyFixture(100, lang)._id : null);
    expect(JSON.stringify(body)).not.toContain('private');
    expect(fetchMock.mock.calls[0][0]).toBe(`http://localhost:3010/api/public/topics/navratri-2026?lang=${lang}`);
  });

  test.each([1, 2])('preserves fixed page %s and authoritative order', async (page) => {
    const upstream = storyPageFixture(lang, page);
    fetchMock.mockResolvedValue(jsonResponse(upstream));
    const res = await invoke(['navratri-2026', 'articles'], { lang, page: String(page), limit: '12' });
    const body = res.json.mock.calls[0][0];
    expect(res.status).toHaveBeenCalledWith(200);
    expect(body).toMatchObject({ ok: true, lang, page, limit: 12, count: upstream.items.length, total: 13 });
    expect(body.items.map((item: { _id: string }) => item._id)).toEqual(upstream.items.map((item) => item._id));
    expect(fetchMock.mock.calls[0][0]).toBe(`http://localhost:3010/api/public/topics/navratri-2026/articles?lang=${lang}&page=${page}&limit=12`);
  });

  test('returns genuine empty without choosing a replacement pin or story', async () => {
    fetchMock.mockResolvedValue(jsonResponse(storyPageFixture(lang, 2, 0)));
    const res = await invoke(['navratri-2026', 'articles'], { lang, page: '2' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ items: [], page: 2, hasNextPage: false }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

test('only an authoritative detail 404 is returned as topic absence', async () => {
  fetchMock.mockResolvedValue(jsonResponse({}, 404));
  expect((await invoke()).status).toHaveBeenCalledWith(404);
  expect((await invoke(['navratri-2026', 'articles'])).status).toHaveBeenCalledWith(503);
});

test.each(['network', '503', 'missing-pin', 'bad-language', 'bad-page'])('%s remains failure rather than empty/null', async (failure) => {
  if (failure === 'network') fetchMock.mockRejectedValue(new Error('offline'));
  else if (failure === '503') fetchMock.mockResolvedValue(jsonResponse({}, 503));
  else if (failure === 'bad-page') fetchMock.mockResolvedValue(jsonResponse({ ...storyPageFixture(), count: 99 }));
  else fetchMock.mockResolvedValue(jsonResponse({
    ok: true, lang: failure === 'bad-language' ? 'hi' : 'en', topic: topicFixture(),
  }));
  const res = await invoke(failure === 'bad-page' ? ['navratri-2026', 'articles'] : undefined);
  expect(res.status).toHaveBeenCalledWith(503);
  expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'EDITORIAL_TOPIC_UNAVAILABLE' });
  expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '60');
  expect(console.error).toHaveBeenCalled();
});

test('an absent safe backend is observable 503 without any fetch', async () => {
  jest.mocked(getPublicApiBaseUrl).mockReturnValue('');
  expect((await invoke()).status).toHaveBeenCalledWith(503);
  expect(fetchMock).not.toHaveBeenCalled();
});

test('the existing deadline bounds the backend read', async () => {
  jest.useFakeTimers();
  fetchMock.mockImplementation(() => new Promise(() => {}));
  const pending = invoke();
  await jest.advanceTimersByTimeAsync(EDITORIAL_TOPICS_TIMEOUT_MS);
  expect((await pending).status).toHaveBeenCalledWith(503);
  expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
});

test.each([{ lang: 'fr' }, { lang: ['en', 'hi'] }])('rejects invalid locale $lang before reading', async ({ lang }) => {
  expect((await invoke(undefined, { lang })).status).toHaveBeenCalledWith(400);
  expect(fetchMock).not.toHaveBeenCalled();
});

test.each([
  { page: '0' }, { page: '1.5' }, { page: '10001' }, { page: ['1', '2'] }, { limit: '30' },
])('rejects invalid fixed pagination %# before reading', async (query) => {
  expect((await invoke(['navratri-2026', 'articles'], query)).status).toHaveBeenCalledWith(400);
  expect(fetchMock).not.toHaveBeenCalled();
});

test.each([[], ['../bad'], ['navratri-2026', 'pins'], ['navratri-2026', 'articles', 'extra']])('rejects unsupported path %#', async (...parts) => {
  expect((await invoke(parts)).status).toHaveBeenCalledWith(404);
  expect(fetchMock).not.toHaveBeenCalled();
});

test('non-GET cannot call the backend', async () => {
  const res = await invoke(undefined, {}, 'POST');
  expect(res.status).toHaveBeenCalledWith(405);
  expect(res.setHeader).toHaveBeenCalledWith('Allow', 'GET');
  expect(fetchMock).not.toHaveBeenCalled();
});
