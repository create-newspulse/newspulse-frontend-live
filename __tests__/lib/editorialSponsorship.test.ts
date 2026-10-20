import { fetchCategoryFeedPage, selectCategoryFeedArticles } from '../../lib/categoryFeed';
import { buildHomepageSponsoredFeatureIdentitySet, fetchHomeSpotlightArticles, fetchHomeSpotlightSectionArticles, isHomeSpotlightSponsoredContent } from '../../lib/homeSpotlight';
import { fetchPublicNews } from '../../lib/publicNewsApi';
import { fetchRegionalStoryPage, selectRegionalInitialStories } from '../../lib/regionalInitialStories';
import { getYouthTrendingByLanguage } from '../../features/youthPulse/api';

jest.mock('../../lib/publicApiBase', () => ({ getPublicApiBaseUrl: () => 'https://backend.test' }));

type Locale = 'en' | 'hi' | 'gu';
const locales: Locale[] = ['en', 'hi', 'gu'];

function article(id: string, language: Locale, fields: Record<string, unknown> = {}) {
  return {
    _id: id, slug: id, title: `${language} ${id}`, summary: 'Public summary', content: 'Public body',
    language, category: 'business', status: 'published', publishedAt: '2026-01-01T10:00:00Z',
    ...fields,
  };
}

const sponsoredCases: Array<[string, Record<string, unknown>]> = [
  ['active article', { isSponsoredArticle: true }],
  ['expired article', { isSponsoredArticle: true, sponsoredEndAt: '2000-01-01T00:00:00Z' }],
  ['paused campaign', { isSponsored: true, campaignStatus: 'paused' }],
  ['scheduled campaign', { isSponsoredArticle: true, sponsoredStartAt: '2999-01-01T00:00:00Z' }],
  ['disabled feature with an article', { isSponsoredArticle: true, sponsoredFeatureActive: false }],
  ['linked combo article', { sponsorFeatureLinkedId: 'feature-1' }],
  ['legacy linked feature', { linkedSponsoredFeatureId: 'feature-1' }],
  ['typed expired article', { contentType: 'sponsored_article', campaignStatus: 'expired' }],
  ['nested article flags', { metadata: { sponsoredContent: { isSponsored: true, campaignStatus: 'paused' } } }],
];

describe('editorial sponsorship identity', () => {
  test('sponsored placement identities use persisted links, never the promotion headline', () => {
    expect(buildHomepageSponsoredFeatureIdentitySet({
      linkedArticleId: 'paid-id', linkedArticleSlug: 'paid-slug', headline: 'ordinary-story-slug',
    })).toEqual(new Set(['paid-id', 'paid-slug']));
    expect(buildHomepageSponsoredFeatureIdentitySet({ headline: 'ordinary-story-slug' })).toEqual(new Set());
  });

  test.each(sponsoredCases)('excludes %s independently of campaign visibility', (_label, fields) => {
    expect(isHomeSpotlightSponsoredContent(article('candidate', 'en', fields), 'en')).toBe(true);
  });

  test.each([
    { tags: ['sponsored'] }, { keywords: ['sponsored article'] }, { category: 'sponsored feature' },
    { labels: ['partner content'] }, { title: 'Sponsored legislation debated' },
    { isSponsored: false, isSponsoredArticle: false, sponsorFeatureLinkedId: null },
    { campaignId: 'editorial-series', campaignStatus: 'active' },
    { linkedSponsoredFeature: { id: 'feature-1', linkedArticleId: 'some-other-article' } },
  ])('does not infer paid status from ordinary text or unrelated metadata: %j', (fields) => {
    expect(isHomeSpotlightSponsoredContent(article('candidate', 'en', fields), 'en')).toBe(false);
  });

  test('recognizes an explicit linked sponsored feature targeting the article source identity', () => {
    expect(isHomeSpotlightSponsoredContent(article('translation', 'hi', {
      sourceNewsId: 'source-article',
      linkedSponsoredFeature: { id: 'feature-1', linkedArticleId: 'source-article', status: 'expired' },
    }), 'hi')).toBe(true);
  });
});

describe.each(locales)('%s editorial selection', (language) => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
  beforeEach(() => { fetchMock.mockReset(); global.fetch = fetchMock; });
  afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); jest.restoreAllMocks(); });

  const stories = (category = 'business') => [
    article('paid', language, { category, isSponsoredArticle: true, publishedAt: '2026-01-03T10:00:00Z' }),
    article('ordinary', language, { category, tags: ['sponsored'], publishedAt: '2026-01-02T10:00:00Z' }),
    article('older', language, { category }),
  ];

  test.each(['business', 'national', 'faith-culture', 'tech', 'tech-gadgets', 'editorial'])(
    '%s Top Story and remaining editorial positions keep ordinary ordering', (category) => {
      expect(selectCategoryFeedArticles(stories(category), category, language).map(item => item._id))
        .toEqual(['ordinary', 'older']);
    }
  );

  test('Regional Top Story and remaining positions use the same sponsorship identity', () => {
    expect(selectRegionalInitialStories(stories('regional'), language).map(item => item._id)).toEqual(['ordinary', 'older']);
  });

  test('Backend-selected Spotlight excludes sponsored stories without changing backend editorial order or refilling', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ items: stories() })));
    expect((await fetchHomeSpotlightArticles({ lang: language })).map(item => item._id)).toEqual(['ordinary', 'older']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const url = new URL(String(fetchMock.mock.calls[0][0]));
    expect(url.searchParams.get('spotlight')).toBe('1');
    expect(url.searchParams.get('strictLocale')).toBe('1');
    expect(url.searchParams.get('lang')).toBe(language);
  });

  test('homepage web stories retain editorial text tags but not inactive paid articles', async () => {
    const items = stories('web-stories');
    items[0] = article('paid', language, { category: 'web-stories', isSponsoredArticle: true, campaignStatus: 'paused' });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ items })));
    const result = await fetchHomeSpotlightSectionArticles({ lang: language, signal: new AbortController().signal });
    expect(result['web-stories']).toMatchObject({
      status: 'fulfilled', value: [{ _id: 'ordinary' }, { _id: 'older' }],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test('Youth Pulse homepage trending excludes sponsored articles before mapping', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ items: stories('youth-pulse') })));
    expect((await getYouthTrendingByLanguage(12, language)).map(item => item.id)).toEqual(['ordinary', 'older']);
  });

  test('the public News API client still exposes sponsored articles for non-ranking consumers', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ items: stories() })));
    const result = await fetchPublicNews({ language });
    expect(result.error).toBeUndefined();
    expect(result.items.map(item => item._id)).toEqual(['paid', 'ordinary', 'older']);
  });

  test.each(['business', 'national', 'regional'])('%s skips an all-sponsored page without false exhaustion', async (category) => {
    const limit = category === 'national' ? 20 : 30;
    const paid = Array.from({ length: limit }, (_, i) => article(`paid-${i}`, language, { category, isSponsored: true }));
    fetchMock.mockImplementation(async (input) => {
      const page = Number(new URL(String(input), 'https://frontend.test').searchParams.get('page'));
      return new Response(JSON.stringify({
        items: page === 1 ? paid : [article('ordinary', language, { category })],
        page, limit, total: limit + 1, totalPages: 2, hasMore: page === 1,
      }));
    });
    const request = { category, language, page: 1, limit };
    const result = category === 'regional'
      ? await fetchRegionalStoryPage(new URLSearchParams({ lang: language, page: '1', limit: String(limit) }))
      : await fetchCategoryFeedPage(request);
    const items = 'stories' in result ? result.stories : result.items;
    expect(items.map(item => item._id)).toEqual(['ordinary']);
    expect(result.pagination).toEqual({ page: 2, limit, total: limit + 1, totalPages: 2, hasMore: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test.each(['HTTP 503', 'malformed JSON', 'invalid pagination'])(
    'does not turn %s after an all-sponsored page into a successful empty category', async (failure) => {
      const paid = Array.from({ length: 30 }, (_, i) => article(`paid-${i}`, language, { isSponsored: true }));
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
        items: paid, page: 1, limit: 30, total: 31, totalPages: 2,
      }))).mockResolvedValueOnce(failure === 'HTTP 503'
        ? new Response('Unavailable', { status: 503 })
        : failure === 'malformed JSON' ? new Response('{broken')
          : new Response(JSON.stringify({ items: [article('ordinary', language)], page: 2, limit: 30, total: -1 })));
      await expect(fetchCategoryFeedPage({ category: 'business', language, page: 1, limit: 30 })).rejects.toThrow();
      expect(fetchMock).toHaveBeenCalledTimes(2);
    }
  );

  test('filtering an all-sponsored page does not reset the existing four-second read deadline', async () => {
    jest.useFakeTimers();
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
      items: Array.from({ length: 30 }, (_, i) => article(`paid-${i}`, language, { isSponsored: true })),
      page: 1, limit: 30, total: 31, totalPages: 2,
    }))).mockImplementationOnce(() => new Promise(() => {}));
    const result = fetchCategoryFeedPage({ category: 'business', language, page: 1, limit: 30 });
    const assertion = expect(result).rejects.toThrow('timed out');
    await jest.advanceTimersByTimeAsync(4001);
    await assertion;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][1]?.signal?.aborted).toBe(true);
  });

  test('Faith keeps fixed page membership and raw pagination when a page contains only sponsored stories', async () => {
    fetchMock.mockImplementation(async (input) => {
      const page = Number(new URL(String(input)).searchParams.get('page'));
      return new Response(JSON.stringify({
        items: page === 1
          ? Array.from({ length: 30 }, (_, i) => article(`paid-${i}`, language, { category: 'faith-culture', isSponsoredArticle: true }))
          : [article('ordinary', language, { category: 'faith-culture' })],
        page, limit: 30, total: 31, totalPages: 2, hasMore: page === 1,
      }));
    });
    const first = await fetchCategoryFeedPage({ category: 'faith-culture', language, page: 1, limit: 30 });
    expect(first.items).toEqual([]);
    expect(first.pagination).toEqual({ page: 1, limit: 30, total: 31, totalPages: 2, hasMore: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const second = await fetchCategoryFeedPage({ category: 'faith-culture', language, page: 2, limit: 30 });
    expect(second.items.map(item => item._id)).toEqual(['ordinary']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
