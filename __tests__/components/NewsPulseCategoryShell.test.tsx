import fs from 'fs';
import path from 'path';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

import NewsPulseCategoryShell from '../../components/NewsPulseCategoryShell';
import { HOME_SPOTLIGHT_SECTION_KEYS } from '../../lib/homeSpotlight';
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
  articleToHomeRightRailFeedItem: (article: any) => ({ ...article, publishedAt: undefined, iso: article.publishedAt }),
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
    publishedAt,
    imageUrl: `/images/${id}.jpg`,
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

function mockPublicNews(options: { categories?: Record<string, any[]>; global?: any[] } = {}) {
  fetchPublicNewsMock.mockImplementation(async (request: any = {}) => {
    if (request.category) return { items: options.categories?.[String(request.category)] || [] };
    return { items: options.global || [] };
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
      <NewsPulseCategoryShell activeCategory="business" latestItems={[{ id: '1' }, { id: '2' }]} lang="en">
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

  test('loads Home-style global spotlight when category latestItems are empty', async () => {
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
    expect(fetchPublicNewsMock).toHaveBeenCalledWith(expect.objectContaining({ category: 'science-technology', language: 'en', limit: 18 }));
    expect(firstSpotlightCategory()).toBe('business');
    expect(firstSpotlightTitle()).toBe('business story global-business');
  });

  test('does not filter shared Spotlight by activeCategory', async () => {
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
      expect(firstSpotlightCategory()).toBe('business');
    });

    const categoryCalls = fetchPublicNewsMock.mock.calls
      .map(([request]) => request?.category)
      .filter(Boolean);
    expect(new Set(categoryCalls)).toEqual(new Set(HOME_SPOTLIGHT_SECTION_KEYS));
    expect(firstSpotlightTitle()).toBe('business story global-business');
  });

  test('uses the same homepage sponsored-feature exclusion as Home Spotlight', async () => {
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
      expect(firstSpotlightCategory()).toBe('regional');
    });
    expect(firstSpotlightTitle()).toBe('regional story global-regional');
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

    expect(source).toContain('buildHomeSpotlightItems({');
    expect(source).toContain('fetchHomeSpotlightSectionArticles({ lang: apiLang');
    expect(source).toContain('SharedHomeSpotlightCarousel');
    expect(source).toContain('items={spotlightItems}');
    expect(sharedSource).toContain('export const HOME_SPOTLIGHT_SOURCE_LIMIT = 18;');
    expect(sharedSource).toMatch(/fetchPublicNews\(\{\s*category:\s*sectionKey,\s*language:\s*options\.lang,\s*limit:\s*HOME_SPOTLIGHT_SOURCE_LIMIT,/);
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