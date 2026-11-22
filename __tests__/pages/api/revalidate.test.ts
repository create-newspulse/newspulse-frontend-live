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
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

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

describe('backend explicit-path revalidation', () => {
  const articleId = '507f1f77bcf86cd799439011';
  const backendPayload = {
    reason: 'article_update',
    articleId,
    translationGroupId: '507f1f77bcf86cd799439012',
    tags: ['articles', 'article-detail', 'homepage', 'public-news'],
  };
  const backendPaths = [
    '/', '/hi', '/gu', ...localized('/latest'), ...localized('/search'),
    '/news/story-en', '/hi/news/story-hi', '/gu/news/story-gu',
  ];
  const backendAuth = { query: {}, headers: { 'x-revalidate-secret': secret } };
  const categoryPaths = ['/business', '/science-technology', '/tech-gadgets', '/regional/gujarat'];
  const skipped = [...backendPaths, ...localized(`/news/${articleId}`)];

  test.each(categoryPaths)('%s invalidates each localized listing, not live article reads', async (categoryPath) => {
    const paths = [...backendPaths, ...localized(categoryPath)];
    const expected = localized(categoryPath);
    const res = await invoke({ ...backendPayload, paths }, backendAuth);

    expect(res.revalidate.mock.calls.map(([path]) => path)).toEqual(expected);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true, revalidated: expected, failed: [], skipped });
  });

  test('duplicate and previous-category paths regenerate only once in first-seen order', async () => {
    const expected = categoryPaths.flatMap(localized);
    const all = [...backendPaths, ...expected, ...localized(`/news/${articleId}`)];
    const res = await invoke({
      ...backendPayload,
      paths: [
        ...all, ...all,
        ' /business?source=previous#copy ', '/hi/science-technology#copy',
        '/gu/tech-gadgets?source=copy', '/hi/regional/gujarat?source=previous#copy',
        `/news/${articleId}?source=duplicate`, '/latest#copy', '/?source=copy',
      ],
    }, backendAuth);

    expect(res.revalidate.mock.calls.map(([path]) => path)).toEqual(expected);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true, revalidated: expected, failed: [], skipped });
  });

  test('explicit category and Gujarat failures remain partial and do not stop later paths or retry duplicates', async () => {
    const paths = [...backendPaths, ...categoryPaths.flatMap(localized)];
    const expected = categoryPaths.flatMap(localized);
    const failed = [
      { path: '/hi/science-technology', error: 'REVALIDATE_FAILED' },
      { path: '/gu/regional/gujarat', error: 'REVALIDATE_FAILED' },
    ];
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await invoke({
      ...backendPayload,
      paths: [...paths, ...failed.map(({ path }) => path)],
    }, {
      ...backendAuth,
      revalidate: async (path) => {
        const failure = failed.find((item) => item.path === path);
        if (failure) throw new Error('upstream unavailable');
      },
    });

    expect(res.revalidate.mock.calls.map(([path]) => path)).toEqual(expected);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      ok: false,
      revalidated: expected.filter((path) => !failed.some((item) => item.path === path)),
      failed, skipped,
    });
  });

  test('an 18-path Save Update finishes in two bounded waves rather than 18 sequential renders', async () => {
    jest.useFakeTimers();
    const starts: number[] = [];
    const start = Date.now();
    const pending = invoke({ ...backendPayload, paths: [...backendPaths, ...localized('/business')] }, {
      ...backendAuth, revalidate: async () => {
        starts.push(Date.now() - start);
        await new Promise(resolve => setTimeout(resolve, 600));
      },
    });
    await jest.advanceTimersByTimeAsync(1200);
    const res = await pending;
    expect(starts).toEqual([0, 0, 600]);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ ok: true, revalidated: localized('/business'), failed: [], skipped });
    expect(jest.getTimerCount()).toBe(0);
  });

  test('one shared cutoff reports completed, outstanding and unstarted paths; retry needs no article mutation', async () => {
    jest.useFakeTimers();
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const paths = [...localized('/business'), '/sports'];
    const delivery = { tags: ['articles'], paths };
    const late: Array<() => void> = [];
    let responded = false;
    const pending = invoke(delivery, { ...backendAuth, revalidate: async path => {
      if (path === '/business') await new Promise(resolve => setTimeout(resolve, 2500));
      else await new Promise<void>(resolve => late.push(resolve));
    } }).then(res => { responded = true; return res; });
    await jest.advanceTimersByTimeAsync(3999);
    expect(responded).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    const res = await pending;
    expect(res.status).toHaveBeenCalledWith(504);
    expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '5');
    expect(res.json).toHaveBeenCalledWith({
      ok: false, revalidated: ['/business'], skipped: commonPaths,
      failed: [
        { path: '/hi/business', error: 'REVALIDATE_TIMEOUT' },
        { path: '/gu/business', error: 'REVALIDATE_TIMEOUT' },
        { path: '/sports', error: 'REVALIDATE_NOT_STARTED' },
      ],
    });
    late.forEach(finish => finish());
    await jest.advanceTimersByTimeAsync(5000);
    expect(res.revalidate).toHaveBeenCalledTimes(3);
    expect(res.json).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
    const retry = await invoke({ ...delivery, paths: paths.slice(1) }, backendAuth);
    expect(retry.json).toHaveBeenCalledWith({ ok: true, revalidated: paths.slice(1), failed: [], skipped: commonPaths });
  });

  test('skips known non-ISR routes but preserves explicit unknown paths and nested static listings', async () => {
    const live = ['/en/', '/hi/topic/local', '/gu/topic/local/', '/gu/regional', '/gu/youth-pulse'];
    const cached = ['/gu/regional/gujarat', '/news', '/hi/custom-page'];
    const res = await invoke({ tags: ['articles'], paths: [...live, ...cached] }, backendAuth);
    expect(res.revalidate.mock.calls.map(([path]) => path)).toEqual(cached);
    expect(res.json).toHaveBeenCalledWith({ ok: true, revalidated: cached, failed: [], skipped: [...live, ...commonPaths] });
  });

  test('an article callback with only the Regional category helper reaches its real listing in all locales', async () => {
    const res = await invoke({ articleId, categoryKey: 'regional' }, backendAuth);
    expect(res.json).toHaveBeenCalledWith({
      ok: true, revalidated: localized('/regional/gujarat'), failed: [],
      skipped: [...localized(`/news/${articleId}`), ...localized('/regional'), ...commonPaths],
    });
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
    expect(res.revalidate).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, revalidated: [], failed: [], skipped: [
      '/news/id%2Fone', '/latest', '/hi/news/id%2Fone', '/gu/news/id%2Fone',
      ...localized('/news/story%20one'), ...localized('/news/second'),
      '/hi/latest', '/gu/latest', '/', '/hi', '/gu',
    ] });
  });

  test('localized article slugs target only their supplied locale', async () => {
    const hi = '\u0938\u092e\u093e\u091a\u093e\u0930';
    const gu = '\u0ab8\u0aae\u0abe\u0a9a\u0abe\u0ab0';
    const res = await invoke({ articleSlugs: { en: 'english-story', hi, gu, unknown: 'ignored' } });
    expect(res.revalidate).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ ok: true, revalidated: [], failed: [], skipped: [
      '/news/english-story', `/hi/news/${encodeURIComponent(hi)}`, `/gu/news/${encodeURIComponent(gu)}`, ...commonPaths,
    ] });
  });

  test('partial Next regeneration failures remain explicit and do not stop other paths', async () => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    const res = await invoke({ categoryKey: 'tech' }, {
      revalidate: async (path) => {
        if (path === '/hi/science-technology') throw new Error('Regeneration unavailable');
      },
    });
    expect(res.revalidate.mock.calls.map(([path]) => path)).toEqual([...localized('/science-technology'), ...commonPaths]);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      ok: false, revalidated: ['/science-technology', '/gu/science-technology', ...commonPaths],
      failed: [{ path: '/hi/science-technology', error: 'REVALIDATE_FAILED' }],
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
