import fs from 'fs';
import path from 'path';
import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';

import NewsPulseCategoryShell from '../../components/NewsPulseCategoryShell';
import { fetchHomepageSponsoredFeature } from '../../lib/publicSponsoredFeature';
import { fetchPublicNews } from '../../lib/publicNewsApi';
import { dispatchPublicDataRefresh } from '../../lib/publicDataRefresh';
import { jsonResponse } from '../fixtures/editorialTopics';

jest.mock('../../components/ExploreCategories', () => ({
  __esModule: true,
  default: ({ pathname }: { pathname: string }) => <nav data-testid="explore-categories" data-pathname={pathname} />,
}));

jest.mock('../../components/home/HomeRightRail', () => ({
  __esModule: true,
  DEFAULT_HOME_RIGHT_RAIL_THEME: {
    mode: 'light',
    surface: '#fff',
    surface2: '#fff',
    border: '#ddd',
    text: '#111',
    sub: '#555',
    accent: '#2563eb',
    accent2: '#7c3aed',
  },
  articleToHomeRightRailFeedItem: (article: any) => ({
    ...article,
    imageSrc: jest.requireActual('../../lib/coverImages').resolveCoverImageUrl(article),
    publishedAt: undefined,
    iso: article.publishedAt,
  }),
  default: ({ latestItems, latestReadError = false, lang }: { latestItems: any[] | null; latestReadError?: boolean; lang: string }) => (
    <aside
      data-testid="home-right-rail"
      data-lang={lang}
      data-count={Array.isArray(latestItems) ? latestItems.length : -1}
      data-ids={Array.isArray(latestItems) ? latestItems.map(item => item._id || item.id).join(',') : ''}
      data-titles={Array.isArray(latestItems) ? latestItems.map(item => item.title).join('|') : ''}
      data-read-error={String(latestReadError)}
    />
  ),
}));

jest.mock('../../components/home/HomeLeftRailUtilities', () => ({
  __esModule: true,
  HomeLeftRailLiveTvCard: () => <div data-testid="home-left-live-tv-card" />,
  HomeLeftRailSnapshotsCard: () => <div data-testid="home-left-snapshots-card" />,
}));

jest.mock('../../components/home/HomeSharedFeatureModules', () => ({
  __esModule: true,
  HomeTrendingStrip: () => <div data-testid="home-trending-strip" />,
  HomeSpotlightCarousel: ({ items }: { items: any[] | null }) => {
    const list = Array.isArray(items) ? items : [];
    const first = list[0] || null;
    return (
      <section
        data-testid="home-spotlight"
        data-count={list.length}
        data-first-category={String(first?.category || '')}
        data-first-title={String(first?.title || '')}
        data-first-image-src={String(first?.imageSrc || '')}
      />
    );
  },
}));

jest.mock('../../lib/publicNewsApi', () => ({
  __esModule: true,
  fetchPublicNews: jest.fn(async () => ({ items: [] })),
}));

jest.mock('../../lib/publicSponsoredFeature', () => ({
  __esModule: true,
  fetchHomepageSponsoredFeature: jest.fn(async () => null),
}));

jest.mock('../../src/components/ads/AdSlot', () => ({
  __esModule: true,
  default: ({ slot, variant, className }: { slot: string; variant?: string; className?: string }) => <div data-testid={`ad-slot-${slot}`} data-variant={variant} className={className} />,
}));

const fetchPublicNewsMock = fetchPublicNews as jest.Mock;
const fetchHomepageSponsoredFeatureMock = fetchHomepageSponsoredFeature as jest.Mock;

function publicArticle(id: string, category: string, publishedAt: string) {
  return {
    _id: id,
    slug: `${id}-slug`,
    title: `${category} story ${id}`,
    summary: 'A useful homepage-style summary for the shared spotlight module.',
    category,
    status: 'published',
    publishedAt,
    imageUrl: `/images/${id}.jpg`,
  };
}

function draftArticle(id: string, category: string, publishedAt: string) {
  return {
    ...publicArticle(id, category, publishedAt),
    title: `draft ${category} story ${id}`,
    status: 'draft',
  };
}

function spotlightCount(): number {
  return Number(screen.getByTestId('home-spotlight').getAttribute('data-count'));
}

function firstSpotlightCategory(): string {
  return String(screen.getByTestId('home-spotlight').getAttribute('data-first-category') || '');
}

function firstSpotlightTitle(): string {
  return String(screen.getByTestId('home-spotlight').getAttribute('data-first-title') || '');
}

function firstSpotlightImageSrc(): string {
  return String(screen.getByTestId('home-spotlight').getAttribute('data-first-image-src') || '');
}

function mockPublicNews(options: { categories?: Record<string, any[]>; global?: any[]; spotlight?: any[] } = {}) {
  fetchPublicNewsMock.mockImplementation(async (request: any = {}) => {
    const items = request.extraQuery?.spotlight === '1'
      ? options.spotlight ?? options.global ?? []
      : request.category
        ? options.categories?.[String(request.category)] || []
        : options.global || [];
    return { items: items.filter((item: any) => item?.status !== 'draft') };
  });
}

describe('NewsPulseCategoryShell', () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    fetchPublicNewsMock.mockReset();
    fetchHomepageSponsoredFeatureMock.mockReset();
    fetchHomepageSponsoredFeatureMock.mockResolvedValue(null);
    mockPublicNews({
      global: [
        publicArticle('global-lead', 'national', '2026-09-05T10:00:00.000Z'),
        publicArticle('global-regional', 'regional', '2026-09-05T09:00:00.000Z'),
        publicArticle('global-business', 'business', '2026-09-05T08:00:00.000Z'),
      ],
    });
  });

  describe.each(['en', 'hi', 'gu'] as const)('%s mounted shared news', (lang) => {
    const story = (id: string, title = `${lang} ${id}`) => ({
      ...publicArticle(id, 'national', '2026-10-01T10:00:00Z'), language: lang, title,
    });
    const reply = (items: ReturnType<typeof story>[]) => ({ items, meta: {}, endpoint: '/api/public/news' });
    const event = () => dispatchPublicDataRefresh({ version: 'sidebar-change', previousVersion: null, source: 'test' });
    const shell = (locale = lang, category = 'business') => (
      <NewsPulseCategoryShell activeCategory={category} latestItems={[]} lang={locale}>Stories</NewsPulseCategoryShell>
    );
    const titles = () => screen.getByTestId('home-right-rail').getAttribute('data-titles');

    beforeEach(() => {
      jest.spyOn(console, 'warn').mockImplementation(() => {});
      mockPublicNews({ global: [story('first'), story('second')], spotlight: [story('first')] });
    });
    afterEach(() => {
      jest.restoreAllMocks();
      jest.useRealTimers();
    });

    test('version refresh updates same-ID content and preserves authoritative ordering without another interval', async () => {
      const interval = jest.spyOn(global, 'setInterval');
      await act(async () => { render(shell()); });
      expect(firstSpotlightTitle()).toBe(`${lang} first`);
      fetchPublicNewsMock.mockClear();
      mockPublicNews({ global: [story('second'), story('first', `${lang} edited`)], spotlight: [story('first', `${lang} edited`)] });
      await act(async () => { event(); });
      expect(titles()).toBe(`${lang} second|${lang} edited`);
      expect(firstSpotlightTitle()).toBe(`${lang} edited`);
      expect(fetchPublicNewsMock.mock.calls.map(([request]) => request.language)).toEqual([lang, lang]);
      expect(interval).not.toHaveBeenCalled();
    });

    test('authoritative replacement removes withdrawn stories, allows published restoration and applies genuine empty', async () => {
      render(shell());
      await waitFor(() => expect(firstSpotlightTitle()).toBe(`${lang} first`));
      mockPublicNews({ global: [story('second')], spotlight: [story('second')] });
      await act(async () => { event(); });
      expect(titles()).toBe(`${lang} second`);
      expect(firstSpotlightTitle()).toBe(`${lang} second`);
      mockPublicNews({ global: [story('first')], spotlight: [story('first')] });
      await act(async () => { event(); });
      expect(titles()).toBe(`${lang} first`);
      mockPublicNews({ global: [], spotlight: [] });
      await act(async () => { event(); });
      expect(titles()).toBe('');
      expect(screen.queryByTestId('home-spotlight')).toBeNull();
      expect(screen.getByTestId('home-right-rail').getAttribute('data-read-error')).toBe('false');
    });

    test.each(['returned', 'rejected', 'malformed', 'timeout'])('%s failure retains both last valid surfaces', async (failure) => {
      render(shell());
      await waitFor(() => expect(firstSpotlightTitle()).toBe(`${lang} first`));
      if (failure === 'returned') fetchPublicNewsMock.mockResolvedValue({ ...reply([]), error: 'API 503' });
      else if (failure === 'rejected') fetchPublicNewsMock.mockRejectedValue(new Error('offline'));
      else if (failure === 'malformed') {
        jest.spyOn(console, 'error').mockImplementation(() => {});
        jest.spyOn(global, 'fetch').mockResolvedValue(jsonResponse({ items: [{ title: 'Incomplete record' }] }));
        fetchPublicNewsMock.mockImplementation(jest.requireActual<typeof import('../../lib/publicNewsApi')>('../../lib/publicNewsApi').fetchPublicNews);
      } else {
        jest.useFakeTimers();
        fetchPublicNewsMock.mockImplementation(() => new Promise(() => {}));
      }
      await act(async () => {
        event();
        if (failure === 'timeout') await jest.advanceTimersByTimeAsync(4000);
      });
      expect(titles()).toBe(`${lang} first|${lang} second`);
      expect(firstSpotlightTitle()).toBe(`${lang} first`);
      expect(screen.getByTestId('home-right-rail').getAttribute('data-read-error')).toBe('true');
      expect(console.warn).toHaveBeenCalled();
      mockPublicNews({ global: [story('recovered')], spotlight: [story('recovered')] });
      await act(async () => { event(); });
      expect(titles()).toBe(`${lang} recovered`);
      expect(screen.getByTestId('home-right-rail').getAttribute('data-read-error')).toBe('false');
    });

    test.each(['latest', 'spotlight'])('%s failure does not block the other successful sidebar surface', async (failed) => {
      render(shell());
      await waitFor(() => expect(firstSpotlightTitle()).toBe(`${lang} first`));
      fetchPublicNewsMock.mockImplementation(async (request) => {
        const spotlight = request.extraQuery?.spotlight === '1';
        if (spotlight === (failed === 'spotlight')) throw new Error('unavailable');
        return reply([story('updated')]);
      });
      await act(async () => { event(); });
      expect(titles()).toBe(failed === 'latest' ? `${lang} first|${lang} second` : `${lang} updated`);
      expect(firstSpotlightTitle()).toBe(failed === 'spotlight' ? `${lang} first` : `${lang} updated`);
    });

    test.each(['locale', 'category', 'superseded', 'unmount'])('%s invalidates pending shared reads even if fetch ignores abort', async (change) => {
      const view = render(shell());
      await waitFor(() => expect(firstSpotlightTitle()).toBe(`${lang} first`));
      const finish: Array<(value: ReturnType<typeof reply>) => void> = [];
      fetchPublicNewsMock.mockClear().mockImplementation(() => new Promise((resolve) => { finish.push(resolve); }));
      await act(async () => { event(); });
      const oldSignals = fetchPublicNewsMock.mock.calls.map(([request]) => request.signal as AbortSignal);
      mockPublicNews({ global: [story('new-owner')], spotlight: [story('new-owner')] });
      if (change === 'unmount') view.unmount();
      else if (change === 'locale') {
        const locale = lang === 'en' ? 'hi' : lang === 'hi' ? 'gu' : 'en';
        await act(async () => { view.rerender(shell(locale)); });
        expect(fetchPublicNewsMock.mock.calls.slice(2).map(([request]) => request.language)).toEqual([locale, locale]);
      } else if (change === 'category') await act(async () => { view.rerender(shell(lang, 'international')); });
      else await act(async () => { event(); });
      expect(oldSignals.every((signal) => signal.aborted)).toBe(true);
      await act(async () => { finish.forEach((resolve) => resolve(reply([story('late-old')]))); });
      if (change === 'unmount') {
        await act(async () => { event(); });
        expect(fetchPublicNewsMock).toHaveBeenCalledTimes(2);
        expect(view.container.innerHTML).toBe('');
      } else {
        expect(titles()).toBe(`${lang} new-owner`);
        expect(firstSpotlightTitle()).toBe(`${lang} new-owner`);
        expect(fetchPublicNewsMock).toHaveBeenCalledTimes(4);
      }
    });
  });

  test('reuses Home shell rails and highlights the active category route', async () => {
    render(
      <NewsPulseCategoryShell activeCategory="business" latestItems={[
        publicArticle('latest-1', 'business', '2026-09-05T10:00:00.000Z'),
        publicArticle('latest-2', 'business', '2026-09-05T09:00:00.000Z'),
      ]} lang="en">
        <h1>Business Desk</h1>
      </NewsPulseCategoryShell>
    );

    expect(screen.getByRole('heading', { name: 'Business Desk' })).toBeTruthy();
    expect(screen.getByTestId('explore-categories').getAttribute('data-pathname')).toBe('/business');
    expect(screen.getByTestId('home-right-rail').getAttribute('data-lang')).toBe('en');
    expect(screen.getByTestId('home-right-rail').getAttribute('data-count')).toBe('2');
    expect(screen.getByTestId('ad-slot-CATEGORY_TOP_970x90')).toBeTruthy();
    expect(screen.getByTestId('home-trending-strip')).toBeTruthy();
    expect(screen.getByTestId('ad-slot-HOME_LEFT_300x600')).toBeTruthy();
    expect(screen.getByTestId('home-left-live-tv-card')).toBeTruthy();
    expect(screen.getByTestId('home-left-snapshots-card')).toBeTruthy();
    expect(screen.getByTestId('ad-slot-HOME_LEFT_300x250')).toBeTruthy();
    expect(screen.getByTestId('ad-slot-HOME_BILLBOARD_970x250')).toBeTruthy();

    await waitFor(() => {
      expect(spotlightCount()).toBeGreaterThan(0);
    });
  });

  test.each(
    ['regional', 'national', 'international', 'business', 'sports', 'lifestyle', 'glamour', 'science-technology', 'tech-gadgets', 'faith-culture']
      .flatMap((activeCategory) => (['en', 'hi', 'gu'] as const).map((lang) => ({ activeCategory, lang })))
  )('uses category-only top inventory and preserves the lower billboard for $activeCategory/$lang', async ({ activeCategory, lang }) => {
    const { container } = render(<NewsPulseCategoryShell activeCategory={activeCategory} latestItems={[]} lang={lang}>Stories</NewsPulseCategoryShell>);
    const topAd = screen.getByTestId('ad-slot-CATEGORY_TOP_970x90');
    const billboard = screen.getByTestId('ad-slot-HOME_BILLBOARD_970x250');
    expect(topAd.getAttribute('data-variant')).toBe('homeBanner');
    expect(topAd.className).toBe('home-shell mx-auto mt-4');
    expect(screen.queryByTestId('ad-slot-HOME_728x90')).toBeNull();
    expect(screen.queryByTestId('ad-slot-TOP_HOME_BILLBOARD_970x250')).toBeNull();
    expect(billboard.getAttribute('data-variant')).toBe('billboard970x250');
    expect(billboard.classList.contains('w-full')).toBe(true);
    expect(billboard.classList.contains('mx-auto')).toBe(true);
    expect(billboard.parentElement).toBe(container.querySelector('.post-home-grid-ads'));
    expect(billboard.closest('.home-left, .home-center, .home-right')).toBeNull();
    await waitFor(() => expect(spotlightCount()).toBeGreaterThan(0));
  });

  test.each(
    ['editorial', 'web-stories', 'pulse-dialogue']
      .flatMap((activeCategory) => (['en', 'hi', 'gu'] as const).map((lang) => ({ activeCategory, lang })))
  )('keeps the existing top slot for excluded shared-shell route $activeCategory/$lang', async ({ activeCategory, lang }) => {
    render(<NewsPulseCategoryShell activeCategory={activeCategory} latestItems={[]} lang={lang}>Stories</NewsPulseCategoryShell>);
    expect(screen.getByTestId('ad-slot-HOME_728x90')).toBeTruthy();
    expect(screen.queryByTestId('ad-slot-CATEGORY_TOP_970x90')).toBeNull();
    await waitFor(() => expect(spotlightCount()).toBeGreaterThan(0));
  });

  test('places optional continuation after all columns and before the existing bottom ad and Spotlight', async () => {
    const { container, rerender } = render(
      <NewsPulseCategoryShell activeCategory="business" latestItems={[]} lang="en" afterColumns={<footer data-testid="category-continuation">Feed complete</footer>}>
        <div data-testid="category-feed">Stories</div>
      </NewsPulseCategoryShell>
    );

    const grid = container.querySelector('.home-grid--three');
    const continuation = screen.getByTestId('category-continuation');
    const postAds = container.querySelector('.post-home-grid-ads');
    expect(grid?.contains(screen.getByTestId('category-feed'))).toBe(true);
    expect(grid?.contains(continuation)).toBe(false);
    expect(continuation.closest('.home-left, .home-center, .home-right')).toBeNull();
    expect(grid!.compareDocumentPosition(continuation) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(continuation.compareDocumentPosition(postAds!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    await waitFor(() => expect(spotlightCount()).toBeGreaterThan(0));
    expect(postAds!.compareDocumentPosition(screen.getByTestId('home-spotlight')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();

    rerender(
      <NewsPulseCategoryShell activeCategory="business" latestItems={[]} lang="en">
        <div data-testid="category-feed">Stories</div>
      </NewsPulseCategoryShell>
    );
    expect(container.querySelector('.category-after-columns')).toBeNull();
    expect(screen.getByTestId('ad-slot-HOME_BILLBOARD_970x250')).toBeTruthy();
  });

  test('maps route aliases used by category pages', async () => {
    render(
      <NewsPulseCategoryShell activeCategory="science-technology" latestItems={[]} lang="gu" topContent={<div data-testid="category-top-content">Regional controls</div>}>
        <h1>Science & Technology</h1>
      </NewsPulseCategoryShell>
    );

    expect(screen.getByTestId('explore-categories').getAttribute('data-pathname')).toBe('/science-technology');
    expect(screen.getByTestId('home-right-rail').getAttribute('data-lang')).toBe('gu');
    expect(screen.getByTestId('category-top-content')).toBeTruthy();

    await waitFor(() => {
      expect(spotlightCount()).toBeGreaterThan(0);
    });
  });

  test('loads canonical backend Spotlight when category latestItems are empty', async () => {
    mockPublicNews({
      global: [
        publicArticle('global-lead', 'national', '2026-09-05T10:00:00.000Z'),
        publicArticle('global-business', 'business', '2026-09-05T09:00:00.000Z'),
        publicArticle('global-regional', 'regional', '2026-09-05T08:00:00.000Z'),
      ],
    });

    render(
      <NewsPulseCategoryShell activeCategory="international" latestItems={[]} lang="en">
        <h1>International</h1>
      </NewsPulseCategoryShell>
    );

    await waitFor(() => {
      expect(spotlightCount()).toBeGreaterThan(0);
    });

    expect(fetchPublicNewsMock).toHaveBeenCalledWith(expect.objectContaining({ language: 'en', limit: 40 }));
    expect(fetchPublicNewsMock).toHaveBeenCalledWith(expect.objectContaining({
      language: 'en',
      limit: 8,
      extraQuery: { spotlight: '1', strictLocale: '1' },
    }));
    expect(firstSpotlightCategory()).toBe('national');
    expect(firstSpotlightTitle()).toBe('national story global-lead');
  });

  test('passes the same resolved article image into shared Spotlight items', async () => {
    const imageUrl = 'https://res.cloudinary.com/dc918or5b/image/upload/v1788930962/newspulse/articles/tvo76azi8mlvnqziihay.png';
    mockPublicNews({
      global: [
        publicArticle('global-lead', 'national', '2026-09-05T10:00:00.000Z'),
      ],
      spotlight: [
        {
          ...publicArticle('target-article', 'regional', '2026-09-05T09:00:00.000Z'),
          imageUrl,
          coverImage: { url: imageUrl, publicId: 'newspulse/articles/tvo76azi8mlvnqziihay' },
          coverImageUrl: imageUrl,
        },
      ],
    });

    render(
      <NewsPulseCategoryShell activeCategory="regional" latestItems={[]} lang="en">
        <h1>Regional</h1>
      </NewsPulseCategoryShell>
    );

    await waitFor(() => {
      expect(firstSpotlightImageSrc()).toBe(imageUrl);
    });
  });

  test('excludes draft articles from shared Spotlight and latest rail data', async () => {
    mockPublicNews({
      global: [
        publicArticle('global-lead', 'national', '2026-09-05T10:00:00.000Z'),
        draftArticle('draft-regional', 'regional', '2026-09-05T09:30:00.000Z'),
        publicArticle('published-regional', 'regional', '2026-09-05T09:00:00.000Z'),
      ],
      spotlight: [
        draftArticle('draft-regional', 'regional', '2026-09-05T09:30:00.000Z'),
        publicArticle('published-regional', 'regional', '2026-09-05T09:00:00.000Z'),
      ],
    });

    render(
      <NewsPulseCategoryShell activeCategory="regional" latestItems={[
        draftArticle('draft-prop', 'regional', '2026-09-05T11:00:00.000Z'),
        publicArticle('published-prop', 'regional', '2026-09-05T10:00:00.000Z'),
      ]} lang="en">
        <h1>Regional</h1>
      </NewsPulseCategoryShell>
    );

    await waitFor(() => {
      expect(firstSpotlightTitle()).toBe('regional story published-regional');
    });
    expect(firstSpotlightTitle()).not.toContain('draft');
    expect(screen.getByTestId('home-right-rail').getAttribute('data-count')).toBe('2');
  });

  test('does not resurrect cached draft homepage stories from storage', async () => {
    window.localStorage.setItem('newspulse-home-cache', JSON.stringify({
      lang: 'en',
      topStory: draftArticle('cached-draft-lead', 'national', '2026-09-05T12:00:00.000Z'),
      freshStories: [draftArticle('cached-draft-story', 'business', '2026-09-05T11:00:00.000Z')],
    }));
    mockPublicNews({ global: [] });

    render(
      <NewsPulseCategoryShell activeCategory="business" latestItems={[]} lang="en">
        <h1>Business</h1>
      </NewsPulseCategoryShell>
    );

    expect(screen.queryByTestId('home-spotlight')).toBeNull();
  expect(screen.getByTestId('home-right-rail').getAttribute('data-count')).toBe('0');

    await waitFor(() => {
      expect(fetchPublicNewsMock).toHaveBeenCalledWith(expect.objectContaining({ language: 'en', limit: 40 }));
    });
    expect(screen.queryByTestId('home-spotlight')).toBeNull();
  });

  describe.each(['en', 'hi', 'gu'] as const)('historical homepage cache (%s)', (lang) => {
    describe.each(['localStorage', 'sessionStorage'] as const)('%s', (storage) => {
      beforeEach(() => {
        window[storage].setItem('newspulse-home-cache', JSON.stringify({
          lang,
          timestamp: 1,
          topStory: publicArticle('cached-lead', 'national', '2020-01-01T10:00:00Z'),
          freshStories: [publicArticle('cached-fresh', 'business', '2020-01-01T09:00:00Z')],
        }));
      });

      function renderShell(latestItems: any[] | null = [publicArticle('category-prop', 'business', '2026-09-05T10:00:00Z')]) {
        return render(
          <NewsPulseCategoryShell activeCategory="business" latestItems={latestItems} lang={lang}>
            <h1>Business</h1>
          </NewsPulseCategoryShell>
        );
      }

      test('does not seed a pending read from historical storage', async () => {
        let resolveRead!: (result: Awaited<ReturnType<typeof fetchPublicNews>>) => void;
        fetchPublicNewsMock.mockImplementation((request) => request.extraQuery?.spotlight === '1'
          ? Promise.resolve({ items: [] })
          : new Promise(resolve => { resolveRead = resolve; }));
        renderShell(null);
        expect(screen.getByTestId('home-right-rail').getAttribute('data-count')).toBe('-1');
        expect(screen.getByTestId('home-right-rail').getAttribute('data-ids')).toBe('');
        await act(async () => { resolveRead({ items: [], meta: {}, endpoint: '/api/public/news' }); });
        expect(screen.getByTestId('home-right-rail').getAttribute('data-count')).toBe('0');
      });

      test('fresh empty is authoritative over cached stories and category props', async () => {
        mockPublicNews({ global: [] });
        renderShell();
        await waitFor(() => expect(screen.getByTestId('home-right-rail').getAttribute('data-count')).toBe('0'));
        expect(screen.getByTestId('home-right-rail').getAttribute('data-ids')).toBe('');
        expect(screen.getByTestId('home-right-rail').getAttribute('data-read-error')).toBe('false');
        expect(window[storage].getItem('newspulse-home-cache')).not.toBeNull();
      });

      test.each(['returned', 'rejected'] as const)('%s read failure is unavailable, not historical/current news', async (failure) => {
        fetchPublicNewsMock.mockImplementation(async (request) => {
          if (request.extraQuery?.spotlight === '1') return { items: [] };
          if (failure === 'rejected') throw new Error('Read unavailable');
          return { items: [publicArticle('failed-response', 'national', '2026-09-05T11:00:00Z')], error: 'API 503' };
        });
        renderShell();
        await waitFor(() => expect(screen.getByTestId('home-right-rail').getAttribute('data-read-error')).toBe('true'));
        expect(screen.getByTestId('home-right-rail').getAttribute('data-count')).toBe('0');
        expect(screen.getByTestId('home-right-rail').getAttribute('data-ids')).toBe('');
      });

      test('fresh real stories replace props without merging historical storage', async () => {
        mockPublicNews({ global: [publicArticle('fresh-public', 'national', '2026-09-05T12:00:00Z')] });
        renderShell();
        await waitFor(() => expect(screen.getByTestId('home-right-rail').getAttribute('data-ids')).toBe('fresh-public'));
        expect(screen.getByTestId('home-right-rail').getAttribute('data-count')).toBe('1');
        expect(screen.getByTestId('home-right-rail').getAttribute('data-read-error')).toBe('false');
      });
    });
  });

  test('does not filter canonical Spotlight by activeCategory', async () => {
    mockPublicNews({
      categories: {
        international: [publicArticle('international-section', 'international', '2026-09-05T07:00:00.000Z')],
      },
      global: [
        publicArticle('global-lead', 'national', '2026-09-05T10:00:00.000Z'),
        publicArticle('global-business', 'business', '2026-09-05T09:00:00.000Z'),
        publicArticle('global-regional', 'regional', '2026-09-05T08:00:00.000Z'),
      ],
    });

    render(
      <NewsPulseCategoryShell activeCategory="international" latestItems={[]} lang="en">
        <h1>International</h1>
      </NewsPulseCategoryShell>
    );

    await waitFor(() => {
      expect(firstSpotlightCategory()).toBe('national');
    });

    const categoryCalls = fetchPublicNewsMock.mock.calls
      .map(([request]) => request?.category)
      .filter(Boolean);
    expect(categoryCalls).toEqual([]);
    expect(firstSpotlightTitle()).toBe('national story global-lead');
  });

  test('preserves canonical Spotlight order without sponsored-feature re-selection', async () => {
    fetchHomepageSponsoredFeatureMock.mockResolvedValue({ linkedArticleId: 'global-business' });
    mockPublicNews({
      global: [
        publicArticle('global-lead', 'national', '2026-09-05T10:00:00.000Z'),
        publicArticle('global-business', 'business', '2026-09-05T09:00:00.000Z'),
        publicArticle('global-regional', 'regional', '2026-09-05T08:00:00.000Z'),
      ],
    });

    render(
      <NewsPulseCategoryShell activeCategory="international" latestItems={[]} lang="en">
        <h1>International</h1>
      </NewsPulseCategoryShell>
    );

    await waitFor(() => {
      expect(firstSpotlightCategory()).toBe('national');
    });
    expect(firstSpotlightTitle()).toBe('national story global-lead');
    expect(fetchHomepageSponsoredFeatureMock).not.toHaveBeenCalled();
  });

  test('renders only one shared Spotlight module', async () => {
    mockPublicNews({
      global: [
        publicArticle('global-lead', 'national', '2026-09-05T10:00:00.000Z'),
        publicArticle('global-business', 'business', '2026-09-05T09:00:00.000Z'),
      ],
    });

    render(
      <NewsPulseCategoryShell activeCategory="business" latestItems={[]} lang="en">
        <h1>Business</h1>
      </NewsPulseCategoryShell>
    );

    await waitFor(() => {
      expect(screen.getAllByTestId('home-spotlight')).toHaveLength(1);
    });
  });

  test('hides Spotlight when the shared Home source is empty', async () => {
    mockPublicNews({ global: [] });

    render(
      <NewsPulseCategoryShell activeCategory="international" latestItems={[]} lang="en">
        <h1>International</h1>
      </NewsPulseCategoryShell>
    );

    await waitFor(() => {
      expect(fetchPublicNewsMock).toHaveBeenCalledWith(expect.objectContaining({ language: 'en', limit: 40 }));
    });
    await waitFor(() => {
      expect(screen.queryByTestId('home-spotlight')).toBeNull();
    });
  });

  test('keeps Home Spotlight source wiring unchanged', () => {
    const source = fs.readFileSync(path.join(process.cwd(), 'pages/index.tsx'), 'utf8');
    const sharedSource = fs.readFileSync(path.join(process.cwd(), 'lib/homeSpotlight.ts'), 'utf8');

    expect(source).toContain('fetchHomeSpotlightArticles({ lang: apiLang');
    expect(source).toContain('fetchHomeSpotlightSectionArticles({ lang: apiLang');
    expect(source).toContain('SharedHomeSpotlightCarousel');
    expect(source).toContain('items={spotlightItems}');
    expect(sharedSource).toMatch(/fetchPublicNews\(\{\s*language:\s*options\.lang,\s*limit:\s*HOME_SPOTLIGHT_MAX_ITEMS,\s*extraQuery:\s*\{ spotlight:\s*'1', strictLocale:\s*'1' \}/);
  });

  test('allows a page to preserve its existing right rail inside the shared shell', async () => {
    render(
      <NewsPulseCategoryShell activeCategory="national" latestItems={[]} lang="en" rightRail={<aside data-testid="custom-national-rail" />}>
        <h1>National</h1>
      </NewsPulseCategoryShell>
    );

    expect(screen.getByTestId('explore-categories').getAttribute('data-pathname')).toBe('/national');
    expect(screen.getByTestId('custom-national-rail')).toBeTruthy();
    expect(screen.queryByTestId('home-right-rail')).toBeNull();

    await waitFor(() => {
      expect(spotlightCount()).toBeGreaterThan(0);
    });
  });
});