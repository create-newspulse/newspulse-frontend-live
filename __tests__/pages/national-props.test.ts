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
        const limit = new URL(url).searchParams.get('limit');
        return Promise.resolve({
          ok: true,
          json: async () => ({ items: limit === '5' ? articles.slice(0, 5) : articles, total: articles.length, limit: Number(limit) }),
        }) as any;
      }

      return Promise.resolve({ ok: true, json: async () => ({}) }) as any;
    });

    const result: any = await getStaticProps({ locale: 'en' } as any);
    const props = result.props;

    expect(props.data).toHaveLength(40);
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
    expect(jsonBytes(props)).toBeLessThan(128 * 1024);
  });
});