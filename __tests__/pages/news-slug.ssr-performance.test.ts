import { getServerSideProps } from '../../pages/news/[slug]';
import { getServerSideProps as getLegacyProps } from '../../pages/news/[...parts]';

jest.mock('../../hooks/useArticleAnalytics', () => ({
  useArticleAnalytics: jest.fn(),
}));

jest.mock('../../lib/publicDataRefresh', () => ({
  subscribePublicDataRefresh: () => jest.fn(),
}));

function article(overrides: Record<string, any> = {}) {
  return {
    _id: '507f1f77bcf86cd799439011',
    status: 'published',
    publishedAt: '2026-01-01T10:00:00.000Z',
    category: 'national',
    language: 'en',
    title: 'Gujarat Budget 2026',
    summary: 'Summary',
    content: '<p>Body</p>',
    slug: 'gujarat-budget-2026',
    translationGroupId: 'group-1',
    ...overrides,
  };
}

function createCtx(slug: string, locale = 'en') {
  return {
    locale,
    params: { slug },
    query: {},
    req: { headers: { host: 'www.newspulse.co.in', 'x-forwarded-proto': 'https' } },
    res: { setHeader: jest.fn() },
  } as any;
}

function mockFetchSequence(handler: (url: string) => any) {
  const calls: string[] = [];
  global.fetch = jest.fn((url: any) => {
    const target = String(url);
    calls.push(target);
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => handler(target),
      text: async () => JSON.stringify(handler(target)),
    });
  }) as any;
  return calls;
}

describe('pages/news/[slug] getServerSideProps performance contract', () => {
  afterEach(() => {
    jest.resetAllMocks();
    jest.useRealTimers();
  });

  test.each(['en', 'hi', 'gu'])('stalled main %s article returns retryable 503, not a false 404', async (locale) => {
    jest.useFakeTimers();
    let signal: AbortSignal | undefined;
    global.fetch = jest.fn((_url, init) => {
      signal = init.signal;
      return Promise.resolve({ ok: true, status: 200, json: () => new Promise(() => {}) });
    }) as any;
    const ctx = createCtx('slow-story', locale);
    let completed = false;
    const pending = getServerSideProps(ctx).then((result) => { completed = true; return result; });
    await jest.advanceTimersByTimeAsync(4000);
    expect(completed).toBe(true);
    expect(ctx.res.statusCode).toBe(503);
    expect(signal?.aborted).toBe(true);
    expect((await pending as any).props.article).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });

  test.each(['headers', 'body'])('stalled related %s leaves the main article usable', async (stage) => {
    jest.useFakeTimers();
    global.fetch = jest.fn((url) => {
      if (String(url).includes('/slug/')) return Promise.resolve({ ok: true, json: async () => ({ article: article() }) });
      return stage === 'headers' ? new Promise(() => {}) : Promise.resolve({ ok: true, json: () => new Promise(() => {}) });
    }) as any;
    let completed = false;
    const pending = getServerSideProps(createCtx('gujarat-budget-2026')).then((result) => { completed = true; return result; });
    await jest.advanceTimersByTimeAsync(1500);
    expect(completed).toBe(true);
    const result = await pending as any;
    expect(result.props.article.title).toBe('Gujarat Budget 2026');
    expect(result.props.safeHtml).toContain('Body');
    expect(result.props.relatedStories).toEqual([]);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('legacy resolution is bounded across all attempts and returns 503 on timeout', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn(() => new Promise(() => {})) as any;
    const ctx = createCtx('unused');
    ctx.params = { parts: ['article-id', 'old-slug'] };
    let completed = false;
    const pending = getLegacyProps(ctx).then((result) => { completed = true; return result; });
    await jest.advanceTimersByTimeAsync(4000);
    expect(completed).toBe(true);
    expect(await pending).toEqual({ props: { unavailable: true } });
    expect(ctx.res.statusCode).toBe(503);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('returns the article and its related lists', async () => {
    mockFetchSequence((url) => {
      if (url.includes('/api/public/news/slug/')) return { article: article() };
      if (url.includes('/api/public/news?')) {
        return { items: [
          article({ _id: 'other-1', slug: 'other-story', title: 'Other Story' }),
          article({ _id: 'draft-related', slug: 'draft-related', title: 'Draft Related Story', status: 'draft' }),
        ] };
      }
      return {};
    });

    const result: any = await getServerSideProps(createCtx('gujarat-budget-2026'));

    expect(result.props.article._id).toBe('507f1f77bcf86cd799439011');
    expect(result.props.safeHtml).toContain('Body');
    expect(result.props.relatedStories).toHaveLength(1);
    expect(result.props.relatedStories[0]._id).toBe('other-1');
    expect(result.props.relatedStories.map((item: any) => item._id)).not.toContain('draft-related');
  });

  test('never re-fetches the translation group that the API route already resolved', async () => {
    const calls = mockFetchSequence((url) => {
      if (url.includes('/api/public/news/slug/')) return { article: article() };
      if (url.includes('/api/public/news?')) return { items: [] };
      return {};
    });

    await getServerSideProps(createCtx('gujarat-budget-2026'));

    expect(calls.some((url) => url.includes('/api/public/news/group/'))).toBe(false);
  });

  test('keeps the blocking path to a single article request plus one list request', async () => {
    const calls = mockFetchSequence((url) => {
      if (url.includes('/api/public/news/slug/')) return { article: article() };
      if (url.includes('/api/public/news?')) return { items: [] };
      return {};
    });

    await getServerSideProps(createCtx('gujarat-budget-2026'));

    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain('/api/public/news/slug/gujarat-budget-2026');
    expect(calls[1]).toContain('/api/public/news?');
  });

  test('renders the article even when the related-stories request fails', async () => {
    global.fetch = jest.fn((url: any) => {
      const target = String(url);
      if (target.includes('/api/public/news/slug/')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ article: article() }) });
      }
      return Promise.reject(new Error('UPSTREAM_DOWN'));
    }) as any;

    const result: any = await getServerSideProps(createCtx('gujarat-budget-2026'));

    expect(result.props.article._id).toBe('507f1f77bcf86cd799439011');
    expect(result.props.relatedStories).toEqual([]);
    expect(result.props.topStories).toEqual([]);
  });

  test('returns notFound when no article resolves', async () => {
    mockFetchSequence(() => ({ article: null }));

    const result: any = await getServerSideProps(createCtx('missing-story'));

    expect(result.notFound).toBe(true);
  });

  test('confirmed HTTP 404 remains notFound but HTTP 503 is retryable', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 404 })) as any;
    expect(await getServerSideProps(createCtx('missing-story'))).toEqual({ notFound: true });
    global.fetch = jest.fn(async () => ({ ok: false, status: 503 })) as any;
    const ctx = createCtx('temporarily-unavailable');
    const result = await getServerSideProps(ctx) as any;
    expect(ctx.res.statusCode).toBe(503);
    expect(result.notFound).toBeUndefined();
    expect(result.props.error).toBe('Article temporarily unavailable');
  });

  test('never-resolving main headers return before the SSR deadline', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn(() => new Promise(() => {})) as any;
    const ctx = createCtx('slow-headers');
    let completed = false;
    const pending = getServerSideProps(ctx).then((result) => { completed = true; return result; });
    await jest.advanceTimersByTimeAsync(4000);
    expect(completed).toBe(true);
    expect((await pending as any).props.article).toBeNull();
    expect(ctx.res.statusCode).toBe(503);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('returns notFound when a public slug resolves to a draft article', async () => {
    mockFetchSequence((url) => {
      if (url.includes('/api/public/news/slug/')) return { article: article({ status: 'draft', title: 'Draft Detail Story' }) };
      return { items: [] };
    });

    const result: any = await getServerSideProps(createCtx('draft-detail-story'));

    expect(result).toEqual({ notFound: true });
  });

  test('preserves the permanent canonical-slug redirect', async () => {
    mockFetchSequence((url) => {
      if (url.includes('/api/public/news/slug/')) return { article: article({ slug: 'canonical-slug' }) };
      return { items: [] };
    });

    const result: any = await getServerSideProps(createCtx('old-slug'));

    expect(result.redirect).toEqual({ destination: '/news/canonical-slug', permanent: true });
  });

  test.each([
    ['hi', '/hi/news/canonical-hi'],
    ['gu', '/gu/news/canonical-gu'],
  ])('keeps %s locale routing on canonical redirects', async (locale, expected) => {
    mockFetchSequence((url) => {
      if (url.includes('/api/public/news/slug/')) {
        return { article: article({ language: locale, slug: `canonical-${locale}` }) };
      }
      return { items: [] };
    });

    const result: any = await getServerSideProps(createCtx('old-slug', locale));

    expect(result.redirect.destination).toBe(expected);
  });

  test.each(['en', 'hi', 'gu'])('serves %s articles without a locale redirect on canonical slugs', async (locale) => {
    mockFetchSequence((url) => {
      if (url.includes('/api/public/news/slug/')) {
        return { article: article({ language: locale, slug: 'shared-slug' }) };
      }
      return { items: [] };
    });

    const result: any = await getServerSideProps(createCtx('shared-slug', locale));

    expect(result.redirect).toBeUndefined();
    expect(result.props.lang).toBe(locale);
    expect(result.props.article.slug).toBe('shared-slug');
  });

  test('passes the pending-translation state through without extra requests', async () => {
    const calls = mockFetchSequence(() => ({ status: 'pending', sourceLang: 'en' }));

    const result: any = await getServerSideProps(createCtx('pending-story', 'gu'));

    expect(result.props.pending).toBe(true);
    expect(result.props.article).toBeNull();
    expect(calls.some((url) => url.includes('/api/public/news?'))).toBe(false);
  });
});
