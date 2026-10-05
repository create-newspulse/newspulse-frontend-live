import { compactNationalArticleForProps, getStaticProps } from '../../pages/national';

jest.mock('../../lib/publicApiBase', () => ({
  getPublicApiBaseUrl: () => 'http://backend.test',
}));

function makeArticle(index: number, overrides: Record<string, any> = {}) {
  const suffix = String(index + 1).padStart(2, '0');
  return {
    _id: `article-${suffix}`,
    id: `article-id-${suffix}`,
    status: 'published',
    publishedAt: `2026-01-${suffix}T10:00:00.000Z`,
    updatedAt: `2026-01-${suffix}T11:00:00.000Z`,
    category: 'national',
    categoryName: 'National',
    topic: 'Politics',
    tags: ['National', 'Delhi'],
    language: 'en',
    title: `National Story ${suffix}`,
    slug: `national-story-${suffix}`,
    slugs: { en: `national-story-${suffix}`, hi: `rashtriya-story-${suffix}`, gu: `rashtriya-gu-${suffix}` },
    summary: `Summary for national story ${suffix}`,
    excerpt: `Excerpt for national story ${suffix}`,
    description: `Description for national story ${suffix}`,
    content: `<p>${'Full article body '.repeat(500)}${suffix}</p>`,
    localizedContent: `<p>${'Duplicate localized body '.repeat(500)}${suffix}</p>`,
    localizedTitle: `Localized National Story ${suffix}`,
    detailApiUrl: `https://backend.test/api/articles/article-${suffix}?${'x'.repeat(500)}`,
    canonicalDetailUrl: `https://www.newspulse.co.in/news/national-story-${suffix}?${'x'.repeat(500)}`,
    translationAvailability: { en: true, hi: true, gu: true, debug: 'x'.repeat(500) },
    coverImageUrl: `https://res.cloudinary.com/demo/image/upload/story-${suffix}.jpg`,
    imageUrl: `https://res.cloudinary.com/demo/image/upload/duplicate-${suffix}.jpg`,
    location: { city: 'New Delhi', state: 'Delhi', country: 'India' },
    reads: 100 + index,
    ...overrides,
  };
}

function jsonBytes(value: unknown) {
  return Buffer.byteLength(JSON.stringify(value));
}

describe('/national page-data props', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('compacts articles to the fields needed by the national cards', () => {
    const compact = compactNationalArticleForProps(makeArticle(0), 'en');

    expect(compact).toMatchObject({
      _id: 'article-01',
      id: 'article-id-01',
      status: 'published',
      title: 'National Story 01',
      slug: 'national-story-01',
      category: 'national',
      categoryName: 'National',
      topic: 'Politics',
      tags: ['National', 'Delhi'],
      publishedAt: '2026-01-01T10:00:00.000Z',
      updatedAt: '2026-01-01T11:00:00.000Z',
      language: 'en',
      reads: 100,
      coverImageUrl: 'https://res.cloudinary.com/demo/image/upload/story-01.jpg',
      location: 'New Delhi, Delhi, India',
    });
    expect(compact.slugs.en).toBe('national-story-01');
    expect(compact.summary).toBe('Excerpt for national story 01');
    expect(compact.content.length).toBeLessThanOrEqual(421);
    expect(compact.searchText).toContain('Full article body');
    expect(compact.searchText.length).toBeLessThanOrEqual(901);
    expect(compact).not.toHaveProperty('localizedContent');
    expect(compact).not.toHaveProperty('localizedTitle');
    expect(compact).not.toHaveProperty('detailApiUrl');
    expect(compact).not.toHaveProperty('canonicalDetailUrl');
    expect(compact).not.toHaveProperty('translationAvailability');
    expect(compact).not.toHaveProperty('description');
    expect(compact).not.toHaveProperty('imageUrl');
  });

  test('getStaticProps excludes oversized raw fields from data and breaking props', async () => {
    const articles = Array.from({ length: 40 }, (_, index) => makeArticle(index));

    global.fetch = jest.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes('/api/ticker/')) {
        return Promise.resolve({ ok: true, json: async () => ({ items: [] }) }) as any;
      }

      if (url.includes('/api/public/news?')) {
        const params = new URL(url).searchParams;
        const limit = Number(params.get('limit'));
        const page = Number(params.get('page') || 1);
        return Promise.resolve({
          ok: true,
          json: async () => ({
            items: articles.slice((page - 1) * limit, page * limit),
            total: articles.length, page, limit, totalPages: Math.ceil(articles.length / limit),
          }),
        }) as any;
      }

      return Promise.resolve({ ok: true, json: async () => ({}) }) as any;
    });

    const result: any = await getStaticProps({ locale: 'en' } as any);
    const props = result.props;

    expect(props.data).toHaveLength(20);
    expect(props.initialPagination).toEqual({ page: 1, limit: 20, total: 40, totalPages: 2, hasMore: true });
    const firstFeedUrl = new URL(String((global.fetch as jest.Mock).mock.calls[0][0]));
    expect(firstFeedUrl.searchParams.get('page')).toBe('1');
    expect(firstFeedUrl.searchParams.get('limit')).toBe('20');
    expect(firstFeedUrl.searchParams.has('strictLocale')).toBe(false);
    expect(props.breaking).toHaveLength(5);
    expect(props.data[0]).toMatchObject({
      _id: 'article-01',
      title: 'National Story 01',
      slug: 'national-story-01',
      summary: 'Excerpt for national story 01',
      coverImageUrl: 'https://res.cloudinary.com/demo/image/upload/story-01.jpg',
      location: 'New Delhi, Delhi, India',
    });
    expect(props.data[0].content).toContain('Full article body');
    expect(props.data[0]).not.toHaveProperty('localizedContent');
    expect(props.data[0]).not.toHaveProperty('detailApiUrl');
    expect(props.data[0]).not.toHaveProperty('translationAvailability');
    expect(props.breaking[0]).toEqual({
      _id: 'article-01',
      title: 'National Story 01',
      tags: ['National', 'Delhi'],
    });
    expect(result.revalidate).toBe(60);
    expect(jsonBytes(props)).toBeLessThan(128 * 1024);
  });

  test.each([
    ['en'],
    ['hi'],
    ['gu'],
  ])('initial %s pagination uses 20-item pages and retains backend exhaustion metadata', async (locale) => {
    const title = locale === 'hi' ? '\u0938\u092e\u093e\u091a\u093e\u0930' : locale === 'gu' ? '\u0ab8\u0aae\u0abe\u0a9a\u0abe\u0ab0' : 'National story';
    const articles = Array.from({ length: 17 }, (_, index) => makeArticle(index, { language: locale, title: `${title} ${index}` }));
    global.fetch = jest.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://backend.test');
      if (url.pathname.startsWith('/api/ticker/')) return new Response(JSON.stringify({ items: [] }));
      const limit = Number(url.searchParams.get('limit'));
      return new Response(JSON.stringify({
        items: articles.slice(0, limit), page: 1, limit, total: 17, totalPages: Math.ceil(17 / limit),
      }));
    });
    const result = await getStaticProps({ locale });
    expect('props' in result).toBe(true);
    if (!('props' in result)) throw new Error('Missing National props');
    const props = await result.props;
    expect(props.data).toHaveLength(17);
    expect(props.initialPagination).toEqual({ page: 1, limit: 20, total: 17, totalPages: 1, hasMore: false });
    expect(props.data.every((item: { language: string }) => item.language === locale)).toBe(true);
    const pagedCalls = (global.fetch as jest.Mock).mock.calls
      .map(([input]) => new URL(String(input), 'http://backend.test'))
      .filter((url) => url.searchParams.has('page'));
    expect(pagedCalls).toHaveLength(1);
    expect(pagedCalls[0].searchParams.get('page')).toBe('1');
    expect(pagedCalls[0].searchParams.get('limit')).toBe('20');
    expect(pagedCalls[0].searchParams.get('lang')).toBe(locale);
    expect(pagedCalls[0].searchParams.get('language')).toBe(locale);
    expect(result.revalidate).toBe(60);
  });

  test.each([
    ['en'],
    ['hi'],
    ['gu'],
  ])('getStaticProps returns safe %s props when build-time national fetches fail', async (locale) => {
    global.fetch = jest.fn(() => Promise.reject(new Error('backend timeout')));

    const result: any = await getStaticProps({ locale } as any);

    expect(result).toMatchObject({
      props: {
        lang: locale,
        data: [],
        breaking: [],
      },
      revalidate: 60,
    });
  });
});