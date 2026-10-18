/** @jest-environment node */
import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import handler from '../../../pages/api/public/topics/[...path]';
import { getPublicApiBaseUrl } from '../../../lib/publicApiBase';
import { EDITORIAL_TOPICS_TIMEOUT_MS } from '../../../lib/publicEditorialTopics';
import { jsonResponse, navratriStoryFixtures, storyFixture, storyPageFixture, topicFixture, topicStoryCategories } from '../../fixtures/editorialTopics';

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
  test('preserves the selected persisted identity through both pin and archive proxy responses', async () => {
    const stories = navratriStoryFixtures(lang);
    fetchMock.mockResolvedValueOnce(jsonResponse({
      ok: true, lang, topic: topicFixture(lang), pinnedArticle: stories[0],
    }));
    fetchMock.mockResolvedValueOnce(jsonResponse({
      ...storyPageFixture(lang, 1, 2), items: stories.slice(1),
    }));
    const detail = (await invoke(undefined, { lang })).json.mock.calls[0][0];
    const page = (await invoke(['navratri-2026', 'articles'], { lang })).json.mock.calls[0][0];
    for (const [index, story] of [detail.pinnedArticle, ...page.items].entries()) {
      expect(story).toMatchObject({
        _id: stories[index]._id, slug: stories[index].slug,
        language: lang, resolvedLang: lang, category: stories[index].category,
        translationKey: stories[index].translationKey, translationGroupId: stories[index].translationGroupId,
      });
    }
    expect(page).toMatchObject({ count: 2, total: 2, page: 1, limit: 12, hasNextPage: false });
  });

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
    expect(body.items.map((item: { category: string }) => item.category)).toEqual(upstream.items.map((item) => item.category));
    expect(fetchMock.mock.calls[0][0]).toBe(`http://localhost:3010/api/public/topics/navratri-2026/articles?lang=${lang}&page=${page}&limit=12`);
  });

  test('returns genuine empty without choosing a replacement pin or story', async () => {
    fetchMock.mockResolvedValue(jsonResponse(storyPageFixture(lang, 2, 0)));
    const res = await invoke(['navratri-2026', 'articles'], { lang, page: '2' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ items: [], page: 2, hasNextPage: false }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('returns the separate eligible pin without replacing a 37-member cross-category archive', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({
      ok: true, lang, topic: topicFixture(lang), pinnedArticle: storyFixture(100, lang, 'tech'),
    }));
    fetchMock.mockResolvedValueOnce(jsonResponse(storyPageFixture(lang, 1, 37)));
    const detail = (await invoke(undefined, { lang })).json.mock.calls[0][0];
    const articles = (await invoke(['navratri-2026', 'articles'], { lang })).json.mock.calls[0][0];
    expect(detail.pinnedArticle).toMatchObject({ _id: storyFixture(100, lang)._id, category: 'tech' });
    expect(articles).toMatchObject({ count: 12, total: 37, totalPages: 4, hasNextPage: true });
    expect(articles.items.map((story: { category: string }) => story.category)).toEqual(topicStoryCategories);
    expect(articles.items.some((story: { _id: string }) => story._id === detail.pinnedArticle._id)).toBe(false);
  });
});

test('only an authoritative detail 404 is returned as topic absence', async () => {
  fetchMock.mockResolvedValue(jsonResponse({}, 404));
  expect((await invoke()).status).toHaveBeenCalledWith(404);
  expect((await invoke(['navratri-2026', 'articles'])).status).toHaveBeenCalledWith(503);
});

test.each(['pin', 'stories'])('malformed %s primary identity remains an explicit API failure', async (surface) => {
  const invalidStory = { ...storyFixture(1), slug: { en: 'not-the-scalar-contract' } };
  fetchMock.mockResolvedValue(jsonResponse(surface === 'pin'
    ? { ok: true, lang: 'en', topic: topicFixture(), pinnedArticle: invalidStory }
    : { ...storyPageFixture('en', 1, 1), items: [invalidStory] }));
  const res = await invoke(surface === 'pin' ? undefined : ['navratri-2026', 'articles']);
  expect(res.status).toHaveBeenCalledWith(503);
  expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'EDITORIAL_TOPIC_UNAVAILABLE' });
  expect(console.error).toHaveBeenCalled();
});

test.each(['network', '503', 'missing-pin', 'bad-language', 'bad-page', 'bad-category'])('%s remains failure rather than empty/null', async (failure) => {
  if (failure === 'network') fetchMock.mockRejectedValue(new Error('offline'));
  else if (failure === '503') fetchMock.mockResolvedValue(jsonResponse({}, 503));
  else if (failure === 'bad-page') fetchMock.mockResolvedValue(jsonResponse({ ...storyPageFixture(), count: 99 }));
  else if (failure === 'bad-category') fetchMock.mockResolvedValue(jsonResponse({
    ...storyPageFixture('en', 1, 1), items: [{ ...storyFixture(1), category: ['tech', 'tech-gadgets'] }],
  }));
  else fetchMock.mockResolvedValue(jsonResponse({
    ok: true, lang: failure === 'bad-language' ? 'hi' : 'en', topic: topicFixture(),
  }));
  const res = await invoke(failure === 'bad-page' || failure === 'bad-category' ? ['navratri-2026', 'articles'] : undefined);
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
