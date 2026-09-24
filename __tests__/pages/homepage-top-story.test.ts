import fs from 'fs';
import path from 'path';
import { act, renderHook } from '@testing-library/react';
import {
  HOMEPAGE_BACKGROUND_REVALIDATION_INTERVAL_MS,
  HOMEPAGE_LATEST_NEWS_TIMEOUT_MS,
  HOMEPAGE_RESPONSE_CACHE_CONTROL,
  HOMEPAGE_SPONSORED_FEATURE_TIMEOUT_MS,
  estimateReadMinutes,
  getHomepageLatestStoriesSignature,
  getServerSideProps,
  resolveHomepageLatestStories,
  selectHomepageEditorialArticles,
  shouldApplyHomepageLatestStoriesUpdate,
  shouldCommitHomepageLatestStoriesRefresh,
  shouldShowHomepageTopStorySkeleton,
  storyLocationLabel,
  useHomepageRevalidationTriggers,
} from '../../pages/index';
import { fetchPublicNews } from '../../lib/publicNewsApi';
import { resolvePublicHomepageSponsoredFeature } from '../../lib/publicSponsoredFeatureSource';

jest.mock('../../lib/publicNewsApi', () => ({
  fetchPublicNews: jest.fn(),
}));

jest.mock('../../lib/getMessages', () => ({
  getMessages: jest.fn(async (locale: string) => ({ locale })),
}));

jest.mock('../../lib/publicApiBase', () => ({
  getPublicApiBaseUrl: jest.fn(() => 'https://backend.test'),
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

function useRealHomepageDependencies() {
  (fetchPublicNews as jest.Mock).mockImplementationOnce(jest.requireActual('../../lib/publicNewsApi').fetchPublicNews);
  (resolvePublicHomepageSponsoredFeature as jest.Mock).mockImplementationOnce(
    jest.requireActual('../../lib/publicSponsoredFeatureSource').resolvePublicHomepageSponsoredFeature
  );
}

function sponsoredPayload(locale: string) {
  return {
    active: true,
    sponsorName: 'Test Sponsor',
    headline: `${locale} sponsored headline`,
    shortSummary: `${locale} sponsored summary`,
    ctaLabel: 'Visit sponsor',
    imageSrc: 'https://res.cloudinary.com/demo/image/upload/sponsor.jpg',
    destinationUrl: 'https://sponsor.test/landing',
  };
}

function upstreamResponse(payload: unknown) {
  return {
    ok: true,
    status: 200,
    text: jest.fn(async () => JSON.stringify(payload)),
    json: jest.fn(async () => payload),
  };
}

function setDocumentVisibilityState(value: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => value,
  });
}

describe('homepage Top Story freshness', () => {
  const source = fs.readFileSync(path.join(process.cwd(), 'pages', 'index.tsx'), 'utf8');
  const originalFetch = global.fetch;
  let dateNowSpy: jest.SpyInstance<number, []>;

  beforeEach(() => {
    jest.clearAllMocks();
    dateNowSpy = jest.spyOn(Date, 'now').mockReturnValue(Date.parse('2026-09-09T12:00:00.000Z'));
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.useRealTimers();
    setDocumentVisibilityState('visible');
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

  test('homepage Top Story keeps the existing TopStoryImage presentation path', () => {
    expect(source).toContain('import StoryImage, { TopStoryImage }');
    expect(source).toContain('<TopStoryImage');
    expect(source).not.toContain('CategoryStoryHierarchy');
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

  test('SSR resolves safely when sponsored feature never settles and still attempts latest news', async () => {
    jest.useFakeTimers();
    (resolvePublicHomepageSponsoredFeature as jest.Mock).mockImplementationOnce(() => new Promise(() => {}));
    (fetchPublicNews as jest.Mock).mockResolvedValueOnce({ items: [], meta: {}, endpoint: '/api/public/news' });
    let completed = false;
    const pending = getServerSideProps(createServerSideContext() as any).then((result) => {
      completed = true;
      return result;
    });

    await jest.advanceTimersByTimeAsync(HOMEPAGE_SPONSORED_FEATURE_TIMEOUT_MS);

    expect(completed).toBe(true);
    const result = await pending as any;
    expect(result.props.initialHomepageSponsoredFeature).toBeNull();
    expect(fetchPublicNews).toHaveBeenCalledWith(expect.objectContaining({ language: 'en', limit: 40 }));
  });

  test.each(['sponsored', 'latest'])('a rejected %s helper cannot discard the other SSR result', async (dependency) => {
    jest.useFakeTimers();
    const story = article({ _id: 'available-story' });
    (fetchPublicNews as jest.Mock).mockImplementationOnce(async () => {
      if (dependency === 'latest') throw new Error('Latest unavailable');
      return { items: [story], meta: {}, endpoint: '/api/public/news' };
    });
    (resolvePublicHomepageSponsoredFeature as jest.Mock).mockImplementationOnce(async () => {
      if (dependency === 'sponsored') throw new Error('Sponsor unavailable');
      return { feature: { ...sponsoredPayload('en'), href: 'https://sponsor.test/landing' } };
    });

    const result = await getServerSideProps(createServerSideContext() as any) as any;

    if (dependency === 'sponsored') {
      expect(result.props.initialHomepageSponsoredFeature).toBeNull();
      expect(result.props.initialTopStory).toEqual(story);
    } else {
      expect(result.props.initialHomepageSponsoredFeature.headline).toBe('en sponsored headline');
      expect(result.props.initialTopStory).toBeNull();
      expect(result.props.initialFreshStories).toBeNull();
    }
    expect(jest.getTimerCount()).toBe(0);
  });

  describe.each([
    ['/', undefined, 'en'],
    ['/en', 'en', 'en'],
    ['/hi', 'hi', 'hi'],
    ['/gu', 'gu', 'gu'],
  ])('%s SSR dependency deadlines', (_route, locale, expectedLanguage) => {
    test('fast responses preserve localized stories, sponsored content, queries, and timer cleanup', async () => {
      jest.useFakeTimers();
      useRealHomepageDependencies();
      const story = article({ _id: `story-${expectedLanguage}`, language: expectedLanguage });
      const fetchMock = jest.fn(async (url: string) => upstreamResponse(url.includes('/sponsored-feature?')
        ? sponsoredPayload(expectedLanguage!)
        : { items: [story, article({ _id: 'draft', language: expectedLanguage, status: 'draft' })] }));
      global.fetch = fetchMock as any;

      const ctx = createServerSideContext(locale);
      const result = await getServerSideProps(ctx as any) as any;

      expect(result.props.initialTopStory).toEqual(story);
      expect(result.props.initialFreshStories.map((item: any) => item.id)).toEqual([story._id]);
      expect(result.props.initialHomepageSponsoredFeature.headline).toBe(`${expectedLanguage} sponsored headline`);
      expect(ctx.res.setHeader).toHaveBeenCalledWith('Cache-Control', HOMEPAGE_RESPONSE_CACHE_CONTROL);
      expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
        `https://backend.test/api/public/sponsored-feature?placement=homepage&lang=${expectedLanguage}&language=${expectedLanguage}`,
        `https://backend.test/api/public/news?lang=${expectedLanguage}&language=${expectedLanguage}&limit=40`,
      ]);
      expect(jest.getTimerCount()).toBe(0);
    });

    test.each([
      ['sponsored', 'headers'],
      ['sponsored', 'body'],
      ['latest', 'headers'],
      ['latest', 'body'],
    ])('a stalled %s %s wait aborts at its deadline and preserves the other dependency', async (dependency, stage) => {
      jest.useFakeTimers();
      useRealHomepageDependencies();
      let stalledSignal: AbortSignal | undefined;
      const stalledBody = jest.fn(() => new Promise(() => {}));
      const story = article({ _id: `story-${expectedLanguage}`, language: expectedLanguage });
      const fetchMock = jest.fn(async (url: string, init: RequestInit) => {
        const isSponsored = url.includes('/sponsored-feature?');
        const payload = isSponsored ? sponsoredPayload(expectedLanguage!) : { items: [story] };
        if (isSponsored === (dependency === 'sponsored')) {
          stalledSignal = init.signal as AbortSignal;
          if (stage === 'headers') return new Promise(() => {});
          return { ...upstreamResponse(payload), text: stalledBody, json: stalledBody };
        }
        return upstreamResponse(payload);
      });
      global.fetch = fetchMock as any;
      let completed = false;
      const pending = getServerSideProps(createServerSideContext(locale) as any).then((result) => {
        completed = true;
        return result;
      });
      const timeoutMs = dependency === 'sponsored' ? HOMEPAGE_SPONSORED_FEATURE_TIMEOUT_MS : HOMEPAGE_LATEST_NEWS_TIMEOUT_MS;

      await jest.advanceTimersByTimeAsync(timeoutMs - 1);
      expect(completed).toBe(false);
      expect(stalledSignal?.aborted).toBe(false);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      if (stage === 'body') expect(stalledBody).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(1);
      expect(completed).toBe(true);
      expect(stalledSignal?.aborted).toBe(true);
      const result = await pending as any;
      if (dependency === 'sponsored') {
        expect(result.props.initialHomepageSponsoredFeature).toBeNull();
        expect(result.props.initialTopStory).toEqual(story);
        expect(result.props.initialFreshStories[0].lang).toBe(expectedLanguage);
      } else {
        expect(result.props.initialHomepageSponsoredFeature.headline).toBe(`${expectedLanguage} sponsored headline`);
        expect(result.props.initialTopStory).toBeNull();
        expect(result.props.initialFreshStories).toBeNull();
      }
      expect(jest.getTimerCount()).toBe(0);
    });

    test('both unresponsive dependencies return neutral props within the larger deadline, not their sum', async () => {
      jest.useFakeTimers();
      useRealHomepageDependencies();
      const signals: AbortSignal[] = [];
      global.fetch = jest.fn((_url: string, init: RequestInit) => {
        signals.push(init.signal as AbortSignal);
        return new Promise(() => {});
      }) as any;
      let completed = false;
      const pending = getServerSideProps(createServerSideContext(locale) as any).then((result) => {
        completed = true;
        return result;
      });

      await jest.advanceTimersByTimeAsync(HOMEPAGE_SPONSORED_FEATURE_TIMEOUT_MS);
      expect(signals).toHaveLength(2);
      expect(signals[0].aborted).toBe(true);
      expect(signals[1].aborted).toBe(false);
      expect(completed).toBe(false);

      await jest.advanceTimersByTimeAsync(HOMEPAGE_LATEST_NEWS_TIMEOUT_MS - HOMEPAGE_SPONSORED_FEATURE_TIMEOUT_MS);
      expect(completed).toBe(true);
      expect(signals[1].aborted).toBe(true);
      const result = await pending as any;
      expect(result.props.initialHomepageSponsoredFeature).toBeNull();
      expect(result.props.initialTopStory).toBeNull();
      expect(result.props.initialFreshStories).toBeNull();
      expect(jest.getTimerCount()).toBe(0);
    });
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

  test('background latest-news response with a later article is eligible to replace the current Top Story', async () => {
    const currentItems = [
      article({ _id: 'sept-9', title: '9 Sept article', slug: 'sept-9', publishedAt: '2026-09-09T08:00:00.000Z' }),
    ];
    const refreshedItems = [
      article({ _id: 'sept-9-later', title: '9 Sept later article', slug: 'sept-9-later', publishedAt: '2026-09-09T11:00:00.000Z' }),
      ...currentItems,
    ];

    (fetchPublicNews as jest.Mock)
      .mockResolvedValueOnce({ items: currentItems, meta: {}, endpoint: '/api/public/news' })
      .mockResolvedValueOnce({ items: refreshedItems, meta: {}, endpoint: '/api/public/news' });

    const current = await resolveHomepageLatestStories('en');
    const next = await resolveHomepageLatestStories('en');
    const currentSignature = getHomepageLatestStoriesSignature({
      topStory: current.topStory,
      rawStories: current.rawStories,
      freshStories: current.freshStories,
    }, 'en');

    expect(current.topStory?._id).toBe('sept-9');
    expect(next.topStory?._id).toBe('sept-9-later');
    expect(shouldCommitHomepageLatestStoriesRefresh({
      currentSignature,
      mode: 'background',
      next: {
        topStory: next.topStory,
        rawStories: next.rawStories,
        freshStories: next.freshStories,
      },
      requestedLang: 'en',
    })).toBe(true);
  });

  test('identical latest-news response does not request an unnecessary background state replacement', async () => {
    const items = [
      article({ _id: 'sept-9', title: '9 Sept article', slug: 'sept-9', publishedAt: '2026-09-09T08:00:00.000Z' }),
      article({ _id: 'sept-5', title: '5 Sept article', slug: 'sept-5', publishedAt: '2026-09-05T08:00:00.000Z' }),
    ];
    (fetchPublicNews as jest.Mock).mockResolvedValueOnce({ items, meta: {}, endpoint: '/api/public/news' });

    const current = await resolveHomepageLatestStories('en');
    const currentSnapshot = {
      topStory: current.topStory,
      rawStories: current.rawStories,
      freshStories: current.freshStories,
    };
    const currentSignature = getHomepageLatestStoriesSignature(currentSnapshot, 'en');

    expect(shouldApplyHomepageLatestStoriesUpdate(currentSnapshot, currentSnapshot, 'en')).toBe(false);
    expect(shouldCommitHomepageLatestStoriesRefresh({
      currentSignature,
      mode: 'background',
      next: currentSnapshot,
      requestedLang: 'en',
    })).toBe(false);
  });

  test('failed background latest-news response keeps the current homepage story visible', async () => {
    const currentSnapshot = {
      topStory: article({ _id: 'sept-9', title: '9 Sept article', slug: 'sept-9', publishedAt: '2026-09-09T08:00:00.000Z' }),
      rawStories: [article({ _id: 'sept-9', title: '9 Sept article', slug: 'sept-9', publishedAt: '2026-09-09T08:00:00.000Z' })],
      freshStories: null,
    };
    const currentSignature = getHomepageLatestStoriesSignature(currentSnapshot, 'en');

    expect(shouldCommitHomepageLatestStoriesRefresh({
      currentSignature,
      error: 'Fetch failed',
      mode: 'background',
      next: {
        topStory: null,
        rawStories: null,
        freshStories: null,
      },
      requestedLang: 'en',
    })).toBe(false);
  });

  test('background latest-news refetch keeps the active homepage language', async () => {
    (fetchPublicNews as jest.Mock).mockResolvedValueOnce({
      items: [article({ _id: 'article-hi', language: 'hi', slug: 'article-hi' })],
      meta: {},
      endpoint: '/api/public/news',
    });

    const result = await resolveHomepageLatestStories('hi');

    expect(fetchPublicNews).toHaveBeenCalledWith(expect.objectContaining({ language: 'hi', limit: 40 }));
    expect(fetchPublicNews).not.toHaveBeenCalledWith(expect.objectContaining({ language: 'gj' }));
    expect(result.topStory?._id).toBe('article-hi');
  });

  test('draft and sponsored articles returned during refetch cannot become Top Story', async () => {
    (fetchPublicNews as jest.Mock).mockResolvedValueOnce({
      items: [
        article({ _id: 'draft-sept-11', title: 'Draft', slug: 'draft-sept-11', status: 'draft', publishedAt: '2026-09-11T08:00:00.000Z' }),
        article({ _id: 'sponsored-sept-10', title: 'Sponsored', slug: 'sponsored-sept-10', publishedAt: '2026-09-10T08:00:00.000Z', isSponsoredArticle: true }),
        article({ _id: 'sept-9', title: '9 Sept article', slug: 'sept-9', publishedAt: '2026-09-09T08:00:00.000Z' }),
      ],
      meta: {},
      endpoint: '/api/public/news',
    });

    const result = await resolveHomepageLatestStories('en');

    expect(result.topStory?._id).toBe('sept-9');
    expect(result.freshStories?.map((item: any) => item.id)).toEqual(['sept-9']);
  });

  test('focus triggers a homepage background revalidation request', async () => {
    jest.useFakeTimers();
    const onRevalidate = jest.fn();

    const { unmount } = renderHook(() => useHomepageRevalidationTriggers({
      enabled: true,
      intervalMs: HOMEPAGE_BACKGROUND_REVALIDATION_INTERVAL_MS,
      onRevalidate,
    }));

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      await Promise.resolve();
    });

    expect(onRevalidate).toHaveBeenCalledTimes(1);
    unmount();
  });

  test('hidden to visible transition triggers a homepage background revalidation request', async () => {
    jest.useFakeTimers();
    const onRevalidate = jest.fn();

    const { unmount } = renderHook(() => useHomepageRevalidationTriggers({
      enabled: true,
      intervalMs: HOMEPAGE_BACKGROUND_REVALIDATION_INTERVAL_MS,
      onRevalidate,
    }));

    await act(async () => {
      setDocumentVisibilityState('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });
    expect(onRevalidate).not.toHaveBeenCalled();

    await act(async () => {
      setDocumentVisibilityState('visible');
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    expect(onRevalidate).toHaveBeenCalledTimes(1);
    unmount();
  });

  test('periodic timer triggers homepage background revalidation at the configured interval', async () => {
    jest.useFakeTimers();
    const onRevalidate = jest.fn();

    const { unmount } = renderHook(() => useHomepageRevalidationTriggers({
      enabled: true,
      intervalMs: HOMEPAGE_BACKGROUND_REVALIDATION_INTERVAL_MS,
      onRevalidate,
    }));

    act(() => {
      jest.advanceTimersByTime(HOMEPAGE_BACKGROUND_REVALIDATION_INTERVAL_MS - 1);
    });
    expect(onRevalidate).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1);
      await Promise.resolve();
    });

    expect(onRevalidate).toHaveBeenCalledTimes(1);
    unmount();
  });

  test('simultaneous focus visibility and timer triggers coalesce into one revalidation request', async () => {
    jest.useFakeTimers();
    const onRevalidate = jest.fn();

    const { unmount } = renderHook(() => useHomepageRevalidationTriggers({
      enabled: true,
      intervalMs: 1,
      onRevalidate,
    }));

    await act(async () => {
      jest.advanceTimersByTime(1);
      window.dispatchEvent(new Event('focus'));
      setDocumentVisibilityState('visible');
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    expect(onRevalidate).toHaveBeenCalledTimes(1);
    unmount();
  });

  test('homepage revalidation timers and listeners are cleaned up on unmount', async () => {
    jest.useFakeTimers();
    const onRevalidate = jest.fn();

    const { unmount } = renderHook(() => useHomepageRevalidationTriggers({
      enabled: true,
      intervalMs: 1,
      onRevalidate,
    }));

    unmount();

    await act(async () => {
      window.dispatchEvent(new Event('focus'));
      setDocumentVisibilityState('visible');
      document.dispatchEvent(new Event('visibilitychange'));
      jest.advanceTimersByTime(1);
      await Promise.resolve();
    });

    expect(onRevalidate).not.toHaveBeenCalled();
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