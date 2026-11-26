/** @jest-environment node */
import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import alias from '../../../pages/api/public/news-reader/[[...parts]]';
import translation from '../../../pages/api/public/news/translation';
import news from '../../../pages/api/public/news';
import { fetchPublicNewsTranslation } from '../../../lib/publicNewsApi';
import { getArticleReaderOrigin } from '../../../lib/articleSeo.server';

jest.mock('../../../lib/publicApiBase', () => ({ getPublicApiBaseUrl: () => 'http://backend.test' }));
const story = { _id: 'edition-id', slug: 'edition', title: 'Edition', language: 'gu', content: 'Body', status: 'published' };
const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
const real = global.fetch;
beforeEach(() => { fetchMock.mockReset(); global.fetch = fetchMock; });
afterEach(() => { global.fetch = real; jest.restoreAllMocks(); });

async function request(handler: typeof alias, path: string, query: NextApiRequest['query'], method = 'GET') {
  const req = Object.assign(new IncomingMessage(new Socket()), {
    method, url: path, query, cookies: {}, body: undefined, env: {},
    headers: { Cookie: 'text-size=large; dummy=second', aUtHoRiZaTiOn: 'synthetic',
      'proxy-authorization': 'synthetic', 'x-reporter-account': 'synthetic', 'x-api-key': 'synthetic' },
  });
  let body: unknown;
  const res = Object.assign(new ServerResponse(req), {
    status(code: number) { this.statusCode = code; return this; },
    json(value: unknown) { body = value; return this; }, send: jest.fn(), redirect: jest.fn(),
    setDraftMode: jest.fn(), setPreviewData: jest.fn(), clearPreviewData: jest.fn(), revalidate: jest.fn(),
  }) satisfies NextApiResponse;
  await handler(req, res);
  return { status: res.statusCode, body };
}

function expectAnonymousCalls() {
  expect(fetchMock.mock.calls.length).toBeGreaterThan(0);
  for (const [, init] of fetchMock.mock.calls) {
    expect(init).toMatchObject({ method: 'GET', redirect: 'error', credentials: 'omit', cache: 'no-store' });
    expect(init?.headers).toEqual({ Accept: 'application/json' });
  }
}

test.each([[], ['breaking'], ['edition-id'], ['translation'], ['group', 'family'], ['slug', 'edition'], ['translations', 'family']]
  .map(parts => ({ parts, label: parts.join('/') || 'list' })))(
  'raw $label alias keeps the Backend response shape without reader headers', async ({ parts }) => {
    const dto = parts.length && !['breaking','group','translations'].includes(parts[0]) ? story : [story];
    fetchMock.mockResolvedValueOnce(Response.json(dto));
    const res = await request(alias, '/public-api/news?lang=gu', { parts, lang: 'gu' });
    expect(res).toEqual({ status: 200, body: dto });
    expect(String(fetchMock.mock.calls[0][0])).toBe(`http://backend.test/admin-api/public/news${parts.map(p => '/'+p).join('')}?lang=gu`);
    expectAnonymousCalls();
  },
);

test('a legacy translation action never runs in the anonymous reader', async () => {
  expect((await request(alias, '/public-api/news/edition-id/translate', { parts:['edition-id','translate'] }, 'POST')).status).toBe(405);
  expect(fetchMock).not.toHaveBeenCalled();
});

test('the list, including a locale-widened second read, cannot inherit reader headers', async () => {
  fetchMock.mockImplementation(async () => Response.json({ items:[story] }));
  const result = await request(news, '/api/public/news?lang=gu&language=gu', { lang:'gu',language:'gu' });
  expect(result.status).toBe(200);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(new URL(String(fetchMock.mock.calls[1][0])).searchParams.has('lang')).toBe(false);
  expectAnonymousCalls();
});

test('the translation-key proxy preserves a public edition without credentials', async () => {
  fetchMock.mockResolvedValueOnce(Response.json(story));
  expect(await request(translation, '/api/public/news/translation?translationKey=family&lang=gu', { translationKey:'family',lang:'gu' }))
    .toEqual({ status:200,body:story });
  expectAnonymousCalls();
});

test.each([404, 410, 403, 503, 'invalid-json', 'invalid-article'] as const)(
  'translation-key outcome %s must not become successful empty content', async outcome => {
    fetchMock.mockResolvedValueOnce(typeof outcome === 'number' ? new Response(null, {status:outcome})
      : outcome === 'invalid-json' ? new Response('{') : Response.json({}));
    const res = await request(translation, '/api/public/news/translation?translationKey=family&lang=gu', { translationKey:'family',lang:'gu' });
    expect(res.status).toBe(outcome === 404 || outcome === 410 ? outcome : 503);
  },
);

test('an indeterminate translation-key response cannot become a client-side 404', async () => {
  fetchMock.mockResolvedValueOnce(Response.json({}));
  const result = await fetchPublicNewsTranslation({ translationKey:'family', language:'gu' });
  expect(result.article).toBeNull();
  expect(result.error).toBeTruthy();
  expect(result.status).not.toBe(404);
});

test('SSR selects its own listener, independently of incoming Host and forwarding headers', () => {
  const req = new IncomingMessage(new Socket());
  req.headers = { host:'reader.invalid','x-forwarded-host':'other.invalid','x-forwarded-proto':'https' };
  Object.defineProperties(req.socket, { localAddress:{value:'127.0.0.1'}, localPort:{value:3002} });
  expect(getArticleReaderOrigin(req)).toBe('http://127.0.0.1:3002');
});
