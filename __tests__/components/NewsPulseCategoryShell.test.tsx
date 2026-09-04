import React from 'react';
import { render, screen } from '@testing-library/react';

import NewsPulseCategoryShell from '../../components/NewsPulseCategoryShell';

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
  articleToHomeRightRailFeedItem: (article: any) => article,
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
  HomeSpotlightCarousel: ({ items }: { items: any[] | null }) => <section data-testid="home-spotlight" data-count={Array.isArray(items) ? items.length : -1} />,
}));

jest.mock('../../lib/publicNewsApi', () => ({
  __esModule: true,
  fetchPublicNews: jest.fn(async () => ({ items: [] })),
}));

jest.mock('../../src/components/ads/AdSlot', () => ({
  __esModule: true,
  default: ({ slot }: { slot: string }) => <div data-testid={`ad-slot-${slot}`} />,
}));

describe('NewsPulseCategoryShell', () => {
  test('reuses Home shell rails and highlights the active category route', () => {
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
    expect(screen.getByTestId('home-spotlight').getAttribute('data-count')).toBe('2');
  });

  test('maps route aliases used by category pages', () => {
    render(
      <NewsPulseCategoryShell activeCategory="science-technology" latestItems={[]} lang="gu" topContent={<div data-testid="category-top-content">Regional controls</div>}>
        <h1>Science & Technology</h1>
      </NewsPulseCategoryShell>
    );

    expect(screen.getByTestId('explore-categories').getAttribute('data-pathname')).toBe('/science-technology');
    expect(screen.getByTestId('home-right-rail').getAttribute('data-lang')).toBe('gu');
    expect(screen.getByTestId('category-top-content')).toBeTruthy();
  });

  test('allows a page to preserve its existing right rail inside the shared shell', () => {
    render(
      <NewsPulseCategoryShell activeCategory="national" latestItems={[]} lang="en" rightRail={<aside data-testid="custom-national-rail" />}>
        <h1>National</h1>
      </NewsPulseCategoryShell>
    );

    expect(screen.getByTestId('explore-categories').getAttribute('data-pathname')).toBe('/national');
    expect(screen.getByTestId('custom-national-rail')).toBeTruthy();
    expect(screen.queryByTestId('home-right-rail')).toBeNull();
  });
});