/** @jest-environment node */

import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from 'next';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import groupHandler from '../../../pages/api/public/news/group/[groupId]';
import articleHandler from '../../../pages/api/public/news/[id]/index';
import slugHandler from '../../../pages/api/public/news/slug/[slug]';
import { getPublicApiBaseUrl } from '../../../lib/publicApiBase';
import { getServerSideProps } from '../../../pages/news/[slug]';
import { buildSocialImageUrl } from '../../../lib/articleSocialImage';
import { PREVIEW_TRACE_HEADER } from '../../../lib/socialPreviewDiagnostics.server';

jest.mock('../../../lib/publicApiBase', () => ({
  getPublicApiBaseUrl: jest.fn(() => 'http://backend.test'),
}));
jest.mock('../../../hooks/useArticleAnalytics', () => ({ useArticleAnalytics: jest.fn() }));

type Route = 'group' | 'article' | 'slug';

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
  const path = route === 'group' ? 'group/group-1' : route === 'slug' ? 'slug/story' : 'article-1';
  return Object.assign(new IncomingMessage(new Socket()), {
    method: 'GET',
    url: `/api/public/news/${path}?lang=${lang}&language=${lang}`,
    query: { ...(route === 'group' ? { groupId: 'group-1' } : route === 'slug' ? { slug: 'story' } : { id: 'article-1' }), lang, language: lang },
    headers: { cookie: 'test-session', authorization: 'test-authorization' },
    cookies: {}, body: undefined, env: {},
  });
}

async function read(route: Route, lang = 'en') {
  const req = request(route, lang);
  const res = response(req);
  await ({ group: groupHandler, article: articleHandler, slug: slugHandler }[route])(req, res);
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

describe.each<Route>(['group', 'article', 'slug'])('%s authoritative read boundary', (route) => {
  test('adds a verified edition preview without changing the cover or forwarding reader credentials to the image host', async () => {
    const source = `https://res.cloudinary.com/fixture/image/upload/v1/api-${route}-cover.png`;
    const bytes = readFileSync(join(process.cwd(), 'public', 'brand', 'news-pulse-social.jpg'));
    const localized = {
      ...story, language: 'gu', resolvedLanguage: 'gu', title: 'ગુજરાતી શીર્ષક', summary: 'ગુજરાતી સારાંશ',
      category: 'business', coverImageUrl: source,
    };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(route === 'group' ? { items: [localized] } : { article: localized })))
      .mockResolvedValueOnce(new Response(Uint8Array.from(bytes), { headers: { 'Content-Type': 'image/jpeg' } }));
    const res = await read(route, 'gu');
    const expected = {
      ...localized, socialImage: {
        source, url: buildSocialImageUrl(source, 75), width: 1200, height: 630, bytes: bytes.length, type: 'image/jpeg',
      },
    };
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual(route === 'group' ? { items: [expected] } : { article: expected });
    expect(res.headers['Cache-Control']).toBe('no-store, max-age=0');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]?.headers).toEqual({ Accept: 'image/jpeg', 'User-Agent': 'NewsPulse-SocialPreview/1.0' });
  });

  test.each(['article', 'slug'] as const)('%s correlates backend diagnostics while preserving the public response', async route => {
    const trace = 'smart_share:00000000-0000-4000-8000-000000000000';
    const req = request(route, 'gu');
    req.headers[PREVIEW_TRACE_HEADER] = trace;
    const res = response(req);
    const info = jest.spyOn(console, 'info').mockImplementation(() => {});
    const localized = { ...story, language: 'gu' };
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ article: localized })));
    await ({ article: articleHandler, slug: slugHandler }[route])(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ article: localized });
    expect(fetchMock.mock.calls[0][1]?.headers).not.toHaveProperty(PREVIEW_TRACE_HEADER);
    res.emit('finish');
    res.emit('close');
    const events = info.mock.calls.filter(([prefix]) => prefix === '[social-preview]').map(([, json]) => JSON.parse(String(json)));
    expect(events).toEqual([expect.objectContaining({
      phase: 'backend', language: 'gu', routeType: 'smart_share',
      correlationId: trace.split(':')[1], responseStatus: 200, backendReadCount: 1,
      backendReads: [expect.objectContaining({ status: 200, completed: true, failure: null })],
    })]);
    expect(JSON.stringify(events)).not.toContain('test-session');
    expect(JSON.stringify(events)).not.toContain('test-authorization');
  });

  test('does not request social images for a restricted record', async () => {
    const restricted = {
      ...story, status: 'restricted', publishedAt: '2025-01-01T00:00:00.000Z',
      coverImageUrl: 'https://res.cloudinary.com/fixture/image/upload/v1/private.jpg',
    };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(route === 'group' ? { items: [restricted] } : { article: restricted })));
    const res = await read(route);
    expect(res.statusCode).toBe(route === 'group' ? 200 : 404);
    expect(res.body).toEqual(route === 'group' ? { items: [restricted] } : { ok: false, message: 'NOT_FOUND' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

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

  test.each([404, 410])('HTTP %s is absence only for a supported detail contract', async (status) => {
    const upstream = new Response('private not-found diagnostics', { status });
    const readBody = jest.spyOn(upstream, 'text');
    fetchMock.mockResolvedValue(upstream);
    const res = await read(route);
    expect(res.statusCode).toBe(route === 'group' ? 503 : status);
    expect(res.body).toEqual(route === 'group' ? { error: 'PUBLIC_NEWS_UNAVAILABLE' } : { ok: false, message: 'NOT_FOUND' });
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

test.each([404, 410])('an unsupported group %s cannot establish absence of the requested variant', async (status) => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ article: { ...story, translationGroupId: 'group-1' } })))
    .mockResolvedValueOnce(new Response('', { status }));
  expect((await read('article', 'gu')).statusCode).toBe(503);
});

describe.each<Route>(['group', 'article', 'slug'])('%s validated public envelope', (route) => {
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

describe.each(['slug', 'article'] as const)('%s legacy absence', (route) => {
  test('preserves the exact HTTP 200 exists:false contract without further reads', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ exists: false })))
      .mockResolvedValue(new Response(JSON.stringify({ items: [story] })));
    const res = await read(route);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ exists: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test.each([
    { exists: false, ok: false },
    { exists: false, article: story },
    { exists: false, errors: ['private diagnostic'] },
  ])('does not trust contradictory or failed absence payload %j', async (payload) => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(payload)));
    const res = await read(route);
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: 'PUBLIC_NEWS_UNAVAILABLE' });
  });
});

describe.each(['en', 'hi', 'gu'] as const)('%s direct URL safety', (lang) => {
  const localized = { ...story, language: lang };

  test.each([404, 410])('slug HTTP %s never consults a stale successful listing', async (status) => {
    fetchMock.mockResolvedValueOnce(new Response('', { status }))
      .mockResolvedValue(new Response(JSON.stringify({ items: [localized] })));
    const res = await read('slug', lang);
    expect(res.statusCode).toBe(status);
    expect(res.body).toEqual({ ok: false, message: 'NOT_FOUND' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test.each([403, 409, 500, 502, 503, 504])('slug HTTP %s remains a failure, never a successful null', async (status) => {
    const upstream = new Response('private diagnostics', { status, headers: { 'Retry-After': '45' } });
    const body = jest.spyOn(upstream, 'text');
    fetchMock.mockResolvedValueOnce(upstream);
    const res = await read('slug', lang);
    expect(res.statusCode).toBe(status);
    expect(res.body).toEqual({ error: 'PUBLIC_NEWS_UNAVAILABLE' });
    expect(res.headers['Retry-After']).toBe('45');
    expect(body).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test.each([403, 404, 409, 410, 503])('ID HTTP %s after legacy slug discovery never revives the listing record', async (status) => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ article: null })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [localized] })))
      .mockResolvedValueOnce(new Response('private detail failure', { status }));
    const res = await read('slug', lang);
    expect(res.statusCode).toBe(status);
    expect(res.body).toEqual(status === 404 || status === 410
      ? { ok: false, message: 'NOT_FOUND' } : { error: 'PUBLIC_NEWS_UNAVAILABLE' });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test.each([
    { status: 'draft' }, { status: 'unpublished' }, { status: 'archived' },
    { isDeleted: true }, { deletedAt: '2026-01-02T00:00:00.000Z' },
    { publishedAt: '2999-01-01T00:00:00.000Z' },
  ])('a nonpublic ID result %j cannot fall back to the published listing snapshot', async (changes) => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ article: null })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [localized] })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ article: { ...localized, ...changes } })));
    const res = await read('slug', lang);
    expect(res.statusCode).toBe(404);
    expect(res.body).not.toHaveProperty('article');
  });

  test.each(['native', 'published edition', 'approved translation'])('retains a verified %s despite an unsupported optional group', async (variant) => {
    const sourceLang = lang === 'gu' ? 'en' : 'gu';
    const record = {
      ...localized, translationGroupId: 'group-1', translationKey: 'stable-story',
      slug: 'persisted-slug', canonicalSlug: 'persisted-slug',
      ...(variant === 'published edition' ? { isTranslated: true, translations: { en: true, hi: true, gu: true } } : {}),
      ...(variant === 'approved translation' ? {
        language: sourceLang,
        translations: { [lang]: { status: 'APPROVED', title: 'Translated title', content: '<p>Translated body</p>', slug: 'persisted-slug' } },
      } : {}),
    };
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ article: record })))
      .mockResolvedValueOnce(new Response('', { status: 404 }));
    const res = await read('slug', lang);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ article: record });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('/api/public/news/group/');
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/translations/'))).toBe(false);
  });

  test('preserves a verified historical public-only copy through the existing generic detail route', async () => {
    const copy = {
      ...localized, _id: '507f1f77bcf86cd799439011', slug: `historical-copy-${lang}`,
      translationGroupId: 'historical-group', createdAt: '2020-01-01T00:00:00.000Z',
    };
    fetchMock.mockImplementation(async (input) => {
      const target = new URL(String(input));
      if (target.origin === 'http://backend.test') {
        if (target.pathname.includes('/slug/') || target.pathname.includes('/group/')) return new Response('', { status: 404 });
        if (target.pathname === `/api/public/news/${copy.slug}`) return new Response(JSON.stringify(copy));
        throw new Error('Unexpected mocked Backend read');
      }
      if (target.pathname === '/api/public/news') return new Response(JSON.stringify({ items: [] }));
      const route = target.pathname.includes('/slug/') ? 'slug' : 'article';
      const req = request(route, lang);
      req.url = `${target.pathname}${target.search}`;
      req.query = { lang, language: lang, ...(route === 'slug' ? { slug: copy.slug } : { id: copy.slug }) };
      const res = response(req);
      await (route === 'slug' ? slugHandler : articleHandler)(req, res);
      return new Response(JSON.stringify(res.body), { status: res.statusCode });
    });
    const ctx = ssrContext(lang);
    ctx.params = { slug: copy.slug };
    const result = await getServerSideProps(ctx);
    expect(result).toHaveProperty('props.article._id', copy._id);
    expect(result).toHaveProperty('props.article.slug', copy.slug);
    expect(result).toHaveProperty('props.article.language', lang);
    expect(result).toHaveProperty('props.error', null);
    expect(ctx.res.statusCode).toBe(200);
  });

  test('SSR treats verified legacy exists:false as absence rather than an outage', async () => {
    serveIdProxy({ exists: false }, 200);
    const ctx = ssrContext(lang);
    expect(await getServerSideProps(ctx)).toEqual({ notFound: true });
    expect(ctx.res.statusCode).not.toBe(503);
  });
});

test.each([403, 404, 409, 410, 503])('a group HTTP %s never becomes a successful empty group', async (status) => {
  fetchMock.mockResolvedValueOnce(new Response('private diagnostics', { status }));
  const res = await read('group');
  expect(res.statusCode).toBe(503);
  expect(res.body).toEqual({ error: 'PUBLIC_NEWS_UNAVAILABLE' });
});

test.each([403, 404, 409, 410, 503])('a legacy listing HTTP %s cannot become article absence', async (status) => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ article: null })))
    .mockResolvedValueOnce(new Response('', { status }));
  const res = await read('slug');
  expect(res.statusCode).toBe(status === 404 || status === 410 ? 503 : status);
  expect(res.body).toEqual({ error: 'PUBLIC_NEWS_UNAVAILABLE' });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test.each([404, 410])('Pulse detail HTTP %s overrides a stale successful slug snapshot', async (status) => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ article: { ...story, category: 'pulse-dialogue' } })))
    .mockResolvedValueOnce(new Response('', { status }));
  const res = await read('slug');
  expect(res.statusCode).toBe(status);
  expect(res.body).toEqual({ ok: false, message: 'NOT_FOUND' });
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test.each([{}, { article: null }, { ok: false, article: story }, { article: { _id: story._id } }])(
  'an invalid ID success %j after legacy discovery never serves the stale listing',
  async (payload) => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ article: null })))
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [story] })))
      .mockResolvedValueOnce(new Response(JSON.stringify(payload)));
    const res = await read('slug');
    expect(res.statusCode).toBe(503);
    expect(res.body).toEqual({ error: 'PUBLIC_NEWS_UNAVAILABLE' });
  },
);

test('legacy discovery serves only the verified ID DTO, including Backend-owned canonical resolution', async () => {
  const copy = { ...story, _id: '507f1f77bcf86cd799439011', title: 'Stale list title', internalOwner: 'private owner' };
  const verified = { ...story, _id: '507f191e810c19729de860ea', title: 'Current canonical title', slug: 'canonical-story' };
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ article: null })))
    .mockResolvedValueOnce(new Response(JSON.stringify({ items: [copy] })))
    .mockResolvedValueOnce(new Response(JSON.stringify({
      article: { ...verified, workflow: 'private workflow' }, diagnostics: 'private envelope',
    })));
  const res = await read('slug');
  expect(res.statusCode).toBe(200);
  expect(res.body).toEqual({ article: verified });
  expect(String(fetchMock.mock.calls[2][0])).toContain(`/api/public/news/${copy._id}?`);
});

test.each(['en', 'hi', 'gu'])('pending %s compatibility returns only public progress metadata', async (sourceLang) => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
    status: 'pending', sourceLang, editorialWorkflow: 'private workflow', diagnostics: 'private envelope',
  }), { status: 202 }));
  const res = await read('slug');
  expect(res.statusCode).toBe(200);
  expect(res.body).toEqual({ status: 'pending', sourceLang });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test.each([
  { outerStatus: 200, httpStatus: 200, field: 'status', pendingStatus: 'pending', sourceLang: 'gu' },
  { outerStatus: 202, httpStatus: 202, field: 'translationStatus', pendingStatus: 'translating', sourceLang: 'hi' },
  { outerStatus: 'success', httpStatus: 200, field: 'state', pendingStatus: 'pending', sourceLang: 'en' },
])('$sourceLang nested translation progress reads $field behind outer status $outerStatus', async ({
  outerStatus, httpStatus, field, pendingStatus, sourceLang,
}) => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
    status: outerStatus,
    data: { [field]: pendingStatus, sourceLang, editorialWorkflow: 'private workflow' },
    diagnostics: 'private envelope',
  }), { status: httpStatus }));
  const res = await read('slug', sourceLang);
  expect(res.statusCode).toBe(200);
  expect(res.body).toEqual({ status: pendingStatus, sourceLang });
  expect(res.headers['Cache-Control']).toBe('no-store');
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test.each([
  { failure: 'HTTP 503', httpStatus: 503, payload: { status: 200, data: { status: 'pending' } } },
  { failure: 'failed envelope', httpStatus: 200, payload: { status: 200, ok: false, data: { status: 'pending' } } },
  { failure: 'nested error', httpStatus: 200, payload: { status: 200, data: { status: 'pending', error: 'private diagnostic' } } },
])('nested translation progress cannot override $failure', async ({ httpStatus, payload }) => {
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(payload), { status: httpStatus }));
  const res = await read('slug');
  expect(res.statusCode).toBe(503);
  expect(res.body).toEqual({ error: 'PUBLIC_NEWS_UNAVAILABLE' });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('nested translation progress metadata does not override a published record status', async () => {
  const article = { ...story, translationStatus: 'pending' };
  fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ status: 200, data: article })));
  const res = await read('slug');
  expect(res.statusCode).toBe(200);
  expect(res.body).toEqual({ article });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('all legacy discovery reads share the four-second deadline', async () => {
  jest.useFakeTimers();
  let signal: AbortSignal | null | undefined;
  fetchMock.mockImplementationOnce(async () => {
    await new Promise((resolve) => setTimeout(resolve, 2500));
    return new Response(JSON.stringify({ article: null }));
  }).mockResolvedValueOnce(new Response(JSON.stringify({ items: [story] })))
    .mockImplementationOnce(async (_url, init) => {
      signal = init?.signal;
      const upstream = new Response('{}');
      jest.spyOn(upstream, 'text').mockImplementation(() => new Promise<string>(() => {}));
      return upstream;
    });
  let settled = false;
  const pending = read('slug').then((res) => { settled = true; return res; });
  await jest.advanceTimersByTimeAsync(3999);
  expect(settled).toBe(false);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  await jest.advanceTimersByTimeAsync(1);
  expect((await pending).statusCode).toBe(503);
  expect(signal?.aborted).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});
