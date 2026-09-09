import fs from 'fs';
import path from 'path';
import {
  HOMEPAGE_RESPONSE_CACHE_CONTROL,
  estimateReadMinutes,
  getServerSideProps,
  resolveHomepageLatestStories,
  selectHomepageEditorialArticles,
  shouldShowHomepageTopStorySkeleton,
  storyLocationLabel,
} from '../../pages/index';
import { fetchPublicNews } from '../../lib/publicNewsApi';

jest.mock('../../lib/publicNewsApi', () => ({
  fetchPublicNews: jest.fn(),
}));

jest.mock('../../lib/getMessages', () => ({
  getMessages: jest.fn(async (locale: string) => ({ locale })),
}));

jest.mock('../../lib/publicSponsoredFeatureSource', () => ({
  normalizeSponsoredFeatureLang: jest.fn((locale: string) => (locale === 'hi' ? 'hi' : locale === 'gu' ? 'gu' : 'en')),
  resolvePublicHomepageSponsoredFeature: jest.fn(async () => ({ feature: null })),
}));

type TestLang = 'en' | 'hi' | 'gu';

function article(overrides: Record<string, any>) {
  return {
    _id: 'article',
    title: 'Article',
    summary: 'Summary',
    slug: 'article',
    language: 'en',
    status: 'published',
    publishedAt: '2026-09-01T10:00:00.000Z',
    createdAt: '2026-09-01T09:00:00.000Z',
    updatedAt: '2026-09-01T11:00:00.000Z',
    category: 'national',
    ...overrides,
  };
}

function createServerSideContext(locale?: string) {
  return {
    locale,
    res: {
      setHeader: jest.fn(),
    },
  };
}

describe('homepage Top Story freshness', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'pages', 'index.tsx'), 'utf8');
  let dateNowSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    jest.clearAllMocks();
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-09T12:00:00.000Z'));
  });

  afterEach(() => {
    dateNowSpy.mockRestore();
  });

  test('homepage initial Top Story uses the newest valid published article by publication time', () => {
    const staleSept5 = article({
      _id: 'sept-5',
      title: '5 Sept article',
      slug: 'sept-5',
      publishedAt: '2026-09-05T08:00:00.000Z',
      updatedAt: '2026-09-10T08:00:00.000Z',
    });
    const latestSept9 = article({
      _id: 'sept-9',
      title: '9 Sept article',
      slug: 'sept-9',
      publishedAt: '2026-09-09T08:00:00.000Z',
      updatedAt: '2026-09-09T08:30:00.000Z',
    });
    const draftSept10 = article({
      _id: 'draft-sept-10',
      status: 'draft',
      publishedAt: '2026-09-10T08:00:00.000Z',
    });
    const sponsoredSept9 = article({
      _id: 'sponsored-sept-9',
      publishedAt: '2026-09-09T09:00:00.000Z',
      isSponsoredArticle: true,
    });

    const selected = selectHomepageEditorialArticles([
      staleSept5,
      latestSept9,
      draftSept10,
      sponsoredSept9,
    ] as any, 'en');

    expect(selected.map((item) => item._id)).toEqual(['sept-9', 'sept-5']);
  });

  test('public Top Story metadata renders location without publication status and keeps reading time', () => {
    const publicAhmedabadArticle = article({
      _id: 'ahmedabad-location',
      status: 'published',
      location: {
        district: 'ahmedabad',
        state: 'draft',
      },
    });

    expect(storyLocationLabel(publicAhmedabadArticle)).toBe('Ahmedabad');
    expect(storyLocationLabel(publicAhmedabadArticle)).not.toContain('draft');
    expect(storyLocationLabel(publicAhmedabadArticle)).not.toContain('published');
    expect(storyLocationLabel(article({ location: { city: 'ahmedabad', state: 'gujarat' } }))).toBe('Ahmedabad, Gujarat');
    expect(estimateReadMinutes(Array.from({ length: 1321 }, () => 'word').join(' '))).toBe(7);
    expect(source).toContain('<MapPin className="h-3.5 w-3.5" /> {vm.location}');
    expect(source).toContain('<BookOpen className="h-3.5 w-3.5" /> {vm.readMinutes} {t(\'common.minutesShort\')}');
  });

  test('server-rendered homepage props contain the newest published Top Story and no-store cache headers', async () => {
    (fetchPublicNews as jest.Mock).mockResolvedValueOnce({
      items: [
        article({ _id: 'sept-5', title: '5 Sept article', slug: 'sept-5', publishedAt: '2026-09-05T08:00:00.000Z' }),
        article({ _id: 'draft-sept-10', title: 'Draft homepage article', slug: 'draft-sept-10', status: 'draft', publishedAt: '2026-09-10T08:00:00.000Z' }),
        article({ _id: 'sept-9', title: '9 Sept article', slug: 'sept-9', publishedAt: '2026-09-09T08:00:00.000Z' }),
      ],
      meta: {},
      endpoint: '/api/public/news',
    });

    const ctx = createServerSideContext();
    const result = await getServerSideProps(ctx as any) as any;

    expect(ctx.res.setHeader).toHaveBeenCalledWith('Cache-Control', HOMEPAGE_RESPONSE_CACHE_CONTROL);
    expect(fetchPublicNews).toHaveBeenCalledWith(expect.objectContaining({ language: 'en', limit: 40 }));
    expect(result.props.initialTopStory._id).toBe('sept-9');
    expect(result.props.initialFreshStories.map((item: any) => item.id)).toEqual(['sept-9', 'sept-5']);
    expect(result.props.initialFreshStories.map((item: any) => item.title)).not.toContain('Draft homepage article');
  });

  test('stale previous articles are not read from persisted homepage cache as loading fallback', () => {
    expect(source).not.toContain('newspulse-home-cache');
    expect(source).not.toContain('readHomeStoryCache');
    expect(source).not.toContain('writeHomeStoryCache');
    expect(source).not.toContain('cachedHome.topStory');
    expect(shouldShowHomepageTopStorySkeleton(null, null)).toBe(true);
  });

  test('hydration refetch uses the same latest-story query and selector as server render', async () => {
    const items = [
      article({ _id: 'sept-5', title: '5 Sept article', slug: 'sept-5', publishedAt: '2026-09-05T08:00:00.000Z' }),
      article({ _id: 'draft-sept-10', title: 'Draft homepage article', slug: 'draft-sept-10', status: 'draft', publishedAt: '2026-09-10T08:00:00.000Z' }),
      article({ _id: 'sept-9', title: '9 Sept article', slug: 'sept-9', publishedAt: '2026-09-09T08:00:00.000Z' }),
    ];

    (fetchPublicNews as jest.Mock)
      .mockResolvedValueOnce({ items, meta: {}, endpoint: '/api/public/news' })
      .mockResolvedValueOnce({ items, meta: {}, endpoint: '/api/public/news' });

    const serverResult = await getServerSideProps(createServerSideContext() as any) as any;
    const clientResult = await resolveHomepageLatestStories('en');

    expect(serverResult.props.initialTopStory._id).toBe(clientResult.topStory?._id);
    expect(serverResult.props.initialFreshStories.map((item: any) => item.id)).toEqual(clientResult.freshStories?.map((item: any) => item.id));
    expect(clientResult.freshStories?.map((item: any) => item.title)).not.toContain('Draft homepage article');
    expect(fetchPublicNews).toHaveBeenNthCalledWith(1, expect.objectContaining({ language: 'en', limit: 40 }));
    expect(fetchPublicNews).toHaveBeenNthCalledWith(2, expect.objectContaining({ language: 'en', limit: 40 }));
  });

  test('genuine latest-news API loading or failure resolves to a neutral skeleton state', async () => {
    (fetchPublicNews as jest.Mock).mockResolvedValueOnce({
      items: [],
      meta: {},
      endpoint: '/api/public/news',
      error: 'Fetch failed',
    });

    const result = await getServerSideProps(createServerSideContext() as any) as any;

    expect(result.props.initialTopStory).toBeNull();
    expect(result.props.initialFreshStories).toBeNull();
    expect(shouldShowHomepageTopStorySkeleton(result.props.initialTopStory, result.props.initialFreshStories)).toBe(true);
  });

  test.each([
    ['/', undefined, 'en'],
    ['/hi', 'hi', 'hi'],
    ['/gu', 'gu', 'gu'],
  ])('%s language render requests %s latest news', async (_route, locale, expectedLanguage) => {
    const lang = expectedLanguage as TestLang;
    (fetchPublicNews as jest.Mock).mockResolvedValueOnce({
      items: [article({ _id: `article-${lang}`, language: lang, slug: `article-${lang}` })],
      meta: {},
      endpoint: '/api/public/news',
    });

    const result = await getServerSideProps(createServerSideContext(locale) as any) as any;

    expect(fetchPublicNews).toHaveBeenCalledWith(expect.objectContaining({ language: expectedLanguage }));
    expect(result.props.initialTopStory._id).toBe(`article-${lang}`);
    expect(result.props.initialFreshStories[0].lang).toBe(lang);
  });
});