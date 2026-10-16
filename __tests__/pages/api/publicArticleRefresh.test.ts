/** @jest-environment node */

import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from 'next';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import groupHandler from '../../../pages/api/public/news/group/[groupId]';
import articleHandler from '../../../pages/api/public/news/[id]/index';
import { getPublicApiBaseUrl } from '../../../lib/publicApiBase';
import { getServerSideProps } from '../../../pages/news/[slug]';

jest.mock('../../../lib/publicApiBase', () => ({
  getPublicApiBaseUrl: jest.fn(() => 'http://backend.test'),
}));
jest.mock('../../../hooks/useArticleAnalytics', () => ({ useArticleAnalytics: jest.fn() }));

type Route = 'group' | 'article';

function response(req: IncomingMessage) {
  const captured: { headers: Record<string, string>; body: unknown } = { headers: {}, body: undefined };
  return Object.assign(new ServerResponse(req), captured, {
    setHeader: jest.fn().mockImplementation(function (this: ServerResponse, name: string, value: string) {
      captured.headers[name] = value;
      return this;
    }),
    status: jest.fn().mockImplementation(function (this: ServerResponse, code: number) {
      this.statusCode = code;
      return this;
    }),
    json: jest.fn().mockImplementation(function (this: ServerResponse & { body: unknown }, body: unknown) {
      this.body = body;
      return this;
    }),
    send: jest.fn(), redirect: jest.fn().mockReturnThis(), setDraftMode: jest.fn().mockReturnThis(),
    setPreviewData: jest.fn().mockReturnThis(), clearPreviewData: jest.fn().mockReturnThis(),
    revalidate: jest.fn(async () => {}),
  }) satisfies NextApiResponse;
}

function request(route: Route, lang = 'en'): NextApiRequest {
  const path = route === 'group' ? 'group/group-1' : 'article-1';
  return Object.assign(new IncomingMessage(new Socket()), {
    method: 'GET',
    url: `/api/public/news/${path}?lang=${lang}&language=${lang}`,
    query: { ...(route === 'group' ? { groupId: 'group-1' } : { id: 'article-1' }), lang, language: lang },
    headers: { cookie: 'test-session', authorization: 'test-authorization' },
    cookies: {}, body: undefined, env: {},
  });
}

async function read(route: Route, lang = 'en') {
  const req = request(route, lang);
  const res = response(req);
  await (route === 'group' ? groupHandler : articleHandler)(req, res);
  return res;
}

const story = {
  _id: 'article-1', language: 'en', status: 'published', slug: 'story',
  title: 'Story', content: '<p>Body</p>', updatedAt: '2026-01-01T00:00:00.000Z',
};
const originalFetch = global.fetch;
const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();

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

describe.each<Route>(['group', 'article'])('%s authoritative read boundary', (route) => {
  test('missing configuration is unavailable, not absence', async () => {
    jest.mocked(getPublicApiBaseUrl).mockReturnValue('');
    const res = await read(route);
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: 'PUBLIC_NEWS_UNAVAILABLE' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test.each(['HTTP', 'network', 'body', 'JSON', 'empty body', 'invalid shape', 'failed envelope'])('%s failure cannot become a successful empty result', async (stage) => {
    const payload = route === 'group' ? { ok: false, items: [] } : { ok: false, article: story };
    const upstream = new Response(
      stage === 'failed envelope' ? JSON.stringify(payload) : stage === 'invalid shape' ? '{}' : stage === 'empty body' ? '' : 'private diagnostics',
      { status: stage === 'HTTP' ? 503 : 200, headers: { 'Retry-After': '45' } },
    );
    const readBody = jest.spyOn(upstream, 'text');
    if (stage === 'body') readBody.mockRejectedValue(new Error('private body failure'));
    if (stage === 'network') fetchMock.mockRejectedValue(new Error('private network failure'));
    else fetchMock.mockResolvedValue(upstream);
    const res = await read(route);
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: 'PUBLIC_NEWS_UNAVAILABLE' });
    expect(res.headers['Cache-Control']).toBe('no-store');
    if (stage !== 'network') expect(res.headers['Retry-After']).toBe('45');
    if (stage === 'HTTP') expect(readBody).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test.each([404, 410])('confirmed HTTP %s remains authoritative absence', async (status) => {
    const upstream = new Response('private not-found diagnostics', { status });
    const readBody = jest.spyOn(upstream, 'text');
    fetchMock.mockResolvedValue(upstream);
    const res = await read(route);
    expect(res.statusCode).toBe(route === 'group' ? 200 : status);
    expect(res.body).toEqual(route === 'group' ? { items: [] } : { ok: false, message: 'NOT_FOUND' });
    expect(readBody).not.toHaveBeenCalled();
  });

  test.each(['en', 'hi', 'gu'])('retains %s identifiers, request headers and successful payloads', async (lang) => {
    const localized = { ...story, language: lang };
    const payload = route === 'group' ? { items: [localized] } : { article: localized };
    fetchMock.mockResolvedValue(new Response(JSON.stringify(payload)));
    const res = await read(route, lang);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(payload);
    expect(String(fetchMock.mock.calls[0][0])).toBe(`http://backend.test${request(route, lang).url}`);
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      cache: 'no-store',
      headers: { cookie: 'test-session', authorization: 'test-authorization' },
    });
  });

  test.each(['headers', 'body'])('bounds stalled %s without publishing absence', async (stage) => {
    jest.useFakeTimers();
    let signal: AbortSignal | null | undefined;
    fetchMock.mockImplementation((_url, init) => {
      signal = init?.signal;
      if (stage === 'headers') return new Promise<Response>(() => {});
      const upstream = new Response('{}');
      jest.spyOn(upstream, 'text').mockImplementation(() => new Promise<string>(() => {}));
      return Promise.resolve(upstream);
    });
    const pending = read(route);
    await jest.advanceTimersByTimeAsync(4000);
    expect((await pending).statusCode).toBe(503);
    expect(signal?.aborted).toBe(true);
    expect(jest.getTimerCount()).toBe(0);
  });
});

test('an actual empty group remains a successful empty group', async () => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ items: [] })));
  const res = await read('group');
  expect(res.statusCode).toBe(200);
  expect(res.body).toEqual({ items: [] });
});

test.each([
  { status: 'unpublished' }, { status: 'draft' }, { status: 'scheduled' },
  { isDeleted: true }, { archivedAt: '2026-01-02T00:00:00.000Z' },
])('standalone lifecycle state %j is not publicly served', async (changes) => {
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ article: { ...story, ...changes } })));
  expect((await read('article')).statusCode).toBe(404);
});

test('a same-ID group withdrawal cannot lose to the direct published snapshot', async () => {
  const grouped = { ...story, translationGroupId: 'group-1' };
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ article: grouped })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ ...grouped, status: 'draft' }] })));
  expect((await read('article')).statusCode).toBe(404);
});

test('an optional group outage still preserves an authoritative, eligible direct article', async () => {
  const grouped = { ...story, translationGroupId: 'group-1' };
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ article: grouped })))
    .mockResolvedValueOnce(new Response('private outage', { status: 503 }));
  const res = await read('article');
  expect(res.statusCode).toBe(200);
  expect(res.body).toEqual({ article: grouped });
});

test.each(['hi', 'gu'])('a group outage cannot turn an unresolved %s variant into an authoritative 404', async (lang) => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ article: { ...story, translationGroupId: 'group-1' } })))
    .mockResolvedValueOnce(new Response('private outage', { status: 503 }));
  const res = await read('article', lang);
  expect(res.statusCode).toBe(503);
  expect(res.body).toEqual({ error: 'PUBLIC_NEWS_UNAVAILABLE' });
});

test('an authoritative non-public direct record remains withdrawn even if its group lookup fails', async () => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
    article: { ...story, status: 'draft', translationGroupId: 'group-1' },
  }))).mockResolvedValueOnce(new Response('private outage', { status: 503 }));
  expect((await read('article')).statusCode).toBe(404);
});

test.each([404, 410])('a confirmed group %s may establish absence of the requested variant', async (status) => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ article: { ...story, translationGroupId: 'group-1' } })))
    .mockResolvedValueOnce(new Response('', { status }));
  expect((await read('article', 'gu')).statusCode).toBe(404);
});

describe.each<Route>(['group', 'article'])('%s validated public envelope', (route) => {
  test.each([
    { _id: story._id },
    { ...story, deletedAt: { unexpected: true } },
    { ...story, error: 'synthetic-private-error' },
    { ...story, errors: ['synthetic-private-error'] },
    { ...story, publishedAt: 'not a date' },
  ])('malformed record %j is 503, never successful data or authoritative 404', async (record) => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(route === 'group' ? { items: [record] } : { article: record })));
    const res = await read(route);
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: 'PUBLIC_NEWS_UNAVAILABLE' });
    expect(JSON.stringify(res.body)).not.toContain('synthetic-private');
  });

  test('does not forward arbitrary successful envelope or record fields', async () => {
    const record = {
      ...story,
      internalUrl: 'synthetic-private-url', token: 'synthetic-private-token',
      seo: { metaDescription: 'Public description', trace: 'synthetic-private-trace' },
    };
    const safe = { ...story, seo: { metaDescription: 'Public description' } };
    const payload = route === 'group' ? { data: { items: [record] } } : { data: record };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ ...payload, diagnostics: 'synthetic-private-envelope' })));
    const res = await read(route);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(route === 'group' ? { items: [safe] } : { article: safe });
  });
});

function ssrContext(locale = 'en'): GetServerSidePropsContext {
  const req = request('article', locale);
  req.headers.host = 'frontend.test';
  return {
    req, res: response(req), locale, params: { slug: story._id }, query: {},
    resolvedUrl: `/news/${story._id}`,
  };
}

function serveIdProxy(payload: unknown, status: number) {
  fetchMock.mockImplementation(async (input) => {
    const target = String(input);
    if (target.startsWith('http://backend.test/')) return new Response(JSON.stringify(payload), { status });
    if (target.includes('/api/public/news/slug/')) return new Response(null, { status: 404 });
    const res = await read('article', new URL(target).searchParams.get('lang') || 'en');
    return new Response(JSON.stringify(res.body), { status: res.statusCode });
  });
}

describe.each(['en', 'hi', 'gu'])('%s SSR consumes the actual ID proxy contract', (locale) => {
  test.each([404, 410])('authoritative HTTP %s is notFound, not temporary failure', async (status) => {
    serveIdProxy({ error: 'synthetic-private-not-found' }, status);
    const ctx = ssrContext(locale);
    expect(await getServerSideProps(ctx)).toEqual({ notFound: true });
    expect(ctx.res.statusCode).not.toBe(503);
  });

  test.each([500, 503])('HTTP %s remains temporary failure', async (status) => {
    serveIdProxy({ error: 'synthetic-private-upstream-error' }, status);
    const ctx = ssrContext(locale);
    const result = await getServerSideProps(ctx);
    expect(ctx.res.statusCode).toBe(503);
    expect(result).not.toHaveProperty('notFound');
    expect(result).toHaveProperty('props.error', 'Article temporarily unavailable');
  });

  test.each([
    {}, { article: { _id: story._id } }, { article: { ...story, deletedAt: {} } },
  ])('malformed HTTP 200 %j remains temporary failure', async (payload) => {
    serveIdProxy(payload, 200);
    const ctx = ssrContext(locale);
    const result = await getServerSideProps(ctx);
    expect(ctx.res.statusCode).toBe(503);
    expect(result).not.toHaveProperty('notFound');
  });
});

test.each([
  {}, { article: { _id: story._id } }, { article: { ...story, deletedAt: {} } },
  { article: null, errors: ['synthetic-private-error'] },
])(
  'SSR also rejects malformed article success %j if a proxy is bypassed',
  async (payload) => {
    fetchMock.mockImplementation(async (input) => String(input).includes('/api/public/news/slug/')
      ? new Response(null, { status: 404 })
      : new Response(JSON.stringify(payload)));
    const ctx = ssrContext();
    const result = await getServerSideProps(ctx);
    expect(ctx.res.statusCode).toBe(503);
    expect(result).not.toHaveProperty('notFound');
  },
);
