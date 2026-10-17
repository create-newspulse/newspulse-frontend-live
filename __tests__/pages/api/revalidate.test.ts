/** @jest-environment node */
import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import handler from '../../../pages/api/revalidate';
import { getCategoryQueryKey, getCategoryRouteKey } from '../../../lib/categoryKeys';

const secret = 'revalidation-test-secret';
const commonPaths = ['/latest', '/hi/latest', '/gu/latest', '/', '/hi', '/gu'];
const localized = (path: string) => [path, `/hi${path}`, `/gu${path}`];

async function invoke(body: unknown = {}, options: {
  method?: string;
  query?: NextApiRequest['query'];
  headers?: NextApiRequest['headers'];
  revalidate?: (path: string) => Promise<void>;
} = {}) {
  const req: NextApiRequest = Object.assign(new IncomingMessage(new Socket()), {
    method: options.method ?? 'POST', query: options.query ?? { secret },
    headers: options.headers ?? {}, cookies: {}, body, env: {},
  });
  const res = Object.assign(new ServerResponse(req), {
    setHeader: jest.fn().mockReturnThis(), status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis(),
    send: jest.fn(), redirect: jest.fn().mockReturnThis(), setDraftMode: jest.fn().mockReturnThis(),
    setPreviewData: jest.fn().mockReturnThis(), clearPreviewData: jest.fn().mockReturnThis(),
    revalidate: jest.fn(options.revalidate ?? (async (_path: string) => {})),
  }) satisfies NextApiResponse;
  await handler(req, res);
  return res;
}

beforeEach(() => {
  jest.replaceProperty(process, 'env', {
    ...process.env, REVALIDATE_SECRET: secret, NEXT_REVALIDATE_SECRET: '',
  });
});
afterEach(() => jest.restoreAllMocks());

describe('canonical category revalidation', () => {
  test.each([
    ...[
      'tech', 'technology', 'science-tech', 'science and technology',
      'science technology', 'science tech', 'science & technology', 'science-technology', ' /TECH/ ',
    ].map((key) => [key, 'science-technology']),
    ...[
      'national', 'international', 'business', 'sports', 'lifestyle', 'glamour',
      'editorial', 'faith-culture', 'pulse-dialogue', 'tech-gadgets',
    ].map((key) => [key, key]),
  ])('%s revalidates only the canonical /%s category in EN/HI/GU', async (categoryKey, route) => {
    const expected = [...localized(`/${route}`), ...commonPaths];
    const res = await invoke({ categoryKey });
    expect(res.revalidate.mock.calls.map(([path]) => path)).toEqual(expected);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true, revalidated: expected, failed: [] });
    expect(expected.some((path) => path.startsWith('/en/'))).toBe(false);
  });

  test('Science & Technology and Tech & Gadgets retain separate public routes and stored query keys', () => {
    expect(getCategoryRouteKey('tech')).toBe('science-technology');
    expect(getCategoryQueryKey('science-technology')).toBe('tech');
    expect(getCategoryRouteKey('tech-gadgets')).toBe('tech-gadgets');
    expect(getCategoryQueryKey('tech-gadgets')).toBe('tech-gadgets');
  });

  test('explicit paths keep their existing normalization, not category alias rewriting', async () => {
    const res = await invoke({
      categoryKey: 'tech',
      paths: [' /tech?source=caller#part ', '/hi/tech', 'custom/path#part', '/en/explicit', '/science-technology'],
    });
    expect(res.revalidate.mock.calls.map(([path]) => path)).toEqual([
      '/tech', '/hi/tech', '/custom/path', '/en/explicit', '/science-technology',
      '/hi/science-technology', '/gu/science-technology', ...commonPaths,
    ]);
  });

  test('state=gujarat targets the real localized listing without guessing a bare regional state', async () => {
    const res = await invoke({ categoryKey: 'regional', state: '/gujarat/' });
    expect(res.revalidate.mock.calls.map(([path]) => path)).toEqual([
      ...localized('/regional'), ...localized('/regional/gujarat'), ...commonPaths,
    ]);
    const bare = await invoke({ categoryKey: 'regional' });
    expect(bare.revalidate.mock.calls.map(([path]) => path)).toEqual([...localized('/regional'), ...commonPaths]);
  });
});

describe('existing revalidation contracts', () => {
  test('homepage and Latest still revalidate without category or article helpers', async () => {
    const res = await invoke();
    expect(res.revalidate.mock.calls.map(([path]) => path)).toEqual(commonPaths);
  });

  test('article IDs, a single slug and a slug array keep encoding, locale expansion and deduplication', async () => {
    const res = await invoke({
      articleId: 'id/one', articleSlug: 'story one', articleSlugs: ['second', 'story one'],
      paths: ['/news/id%2Fone', '/latest', '/latest?source=duplicate'],
    });
    expect(res.revalidate.mock.calls.map(([path]) => path)).toEqual([
      '/news/id%2Fone', '/latest', '/hi/news/id%2Fone', '/gu/news/id%2Fone',
      ...localized('/news/story%20one'), ...localized('/news/second'),
      '/hi/latest', '/gu/latest', '/', '/hi', '/gu',
    ]);
  });

  test('localized article slugs target only their supplied locale', async () => {
    const hi = '\u0938\u092e\u093e\u091a\u093e\u0930';
    const gu = '\u0ab8\u0aae\u0abe\u0a9a\u0abe\u0ab0';
    const res = await invoke({ articleSlugs: { en: 'english-story', hi, gu, unknown: 'ignored' } });
    expect(res.revalidate.mock.calls.map(([path]) => path)).toEqual([
      '/news/english-story', `/hi/news/${encodeURIComponent(hi)}`, `/gu/news/${encodeURIComponent(gu)}`, ...commonPaths,
    ]);
  });

  test('partial Next regeneration failures remain explicit and do not stop other paths', async () => {
    const res = await invoke({ categoryKey: 'tech' }, {
      revalidate: async (path) => {
        if (path === '/hi/science-technology') throw new Error('Regeneration unavailable');
      },
    });
    expect(res.revalidate.mock.calls.map(([path]) => path)).toEqual([...localized('/science-technology'), ...commonPaths]);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      ok: false, revalidated: ['/science-technology', '/gu/science-technology', ...commonPaths],
      failed: [{ path: '/hi/science-technology', error: 'Regeneration unavailable' }],
    });
  });

  test.each([{}, { secret: 'wrong' }])('missing or incorrect caller secrets are rejected: %j', async (query) => {
    const res = await invoke({ categoryKey: 'tech' }, { query });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'INVALID_SECRET' });
    expect(res.revalidate).not.toHaveBeenCalled();
  });

  test('the header secret remains supported when the query secret is absent', async () => {
    const res = await invoke({}, { query: {}, headers: { 'x-revalidate-secret': secret } });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.revalidate).toHaveBeenCalledTimes(commonPaths.length);
  });

  test('a query secret still takes precedence over the header secret', async () => {
    const res = await invoke({}, { query: { secret: 'wrong' }, headers: { 'x-revalidate-secret': secret } });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.revalidate).not.toHaveBeenCalled();
  });

  test('the existing alternative server secret remains supported', async () => {
    process.env.REVALIDATE_SECRET = '';
    process.env.NEXT_REVALIDATE_SECRET = secret;
    const res = await invoke();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.revalidate).toHaveBeenCalledTimes(commonPaths.length);
  });

  test('missing server configuration fails closed', async () => {
    process.env.REVALIDATE_SECRET = '';
    const res = await invoke();
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ ok: false, message: 'REVALIDATE_SECRET_NOT_SET' });
    expect(res.revalidate).not.toHaveBeenCalled();
  });

  test('only POST can invoke revalidation', async () => {
    const res = await invoke({}, { method: 'GET' });
    expect(res.status).toHaveBeenCalledWith(405);
    expect(res.setHeader).toHaveBeenCalledWith('Allow', 'POST');
    expect(res.revalidate).not.toHaveBeenCalled();
  });
});
