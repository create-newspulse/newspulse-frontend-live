import { getServerSideProps } from '../../pages/news/[slug]';

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
  });

  test('returns the article and its related lists', async () => {
    mockFetchSequence((url) => {
      if (url.includes('/api/public/news/slug/')) return { article: article() };
      if (url.includes('/api/public/news?')) {
        return { items: [article({ _id: 'other-1', slug: 'other-story', title: 'Other Story' })] };
      }
      return {};
    });

    const result: any = await getServerSideProps(createCtx('gujarat-budget-2026'));

    expect(result.props.article._id).toBe('507f1f77bcf86cd799439011');
    expect(result.props.safeHtml).toContain('Body');
    expect(result.props.relatedStories).toHaveLength(1);
    expect(result.props.relatedStories[0]._id).toBe('other-1');
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
