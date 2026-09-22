import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

import NewsPulseCategoryShell from '../../components/NewsPulseCategoryShell';
import { fetchHomepageSponsoredFeature } from '../../lib/publicSponsoredFeature';
import { fetchPublicNews } from '../../lib/publicNewsApi';

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
  default: ({ latestItems, lang }: { latestItems: any[] | null; lang: string }) => (
    <aside data-testid="home-right-rail" data-lang={lang} data-count={Array.isArray(latestItems) ? latestItems.length : -1} />
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
  default: ({ slot }: { slot: string }) => <div data-testid={`ad-slot-${slot}`} />,
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
    expect(screen.getByTestId('ad-slot-HOME_728x90')).toBeTruthy();
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