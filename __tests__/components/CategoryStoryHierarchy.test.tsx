import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import CategoryStoryHierarchy, { type CategoryStoryHierarchyItem } from '../../components/category/CategoryStoryHierarchy';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

jest.mock('../../src/components/story/StoryImage', () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

function story(index: number, overrides: Partial<CategoryStoryHierarchyItem> = {}): CategoryStoryHierarchyItem {
  return {
    id: `story-${index}`,
    title: `Story ${index}`,
    titleText: `Story ${index}`,
    href: `/news/story-${index}`,
    summary: `Summary ${index}`,
    summaryText: `Summary ${index}`,
    imageSrc: `/story-${index}.jpg`,
    label: 'National',
    dateIso: `2026-01-${String(Math.min(index, 28)).padStart(2, '0')}T10:00:00.000Z`,
    dateLabel: '1 Jan 2026',
    ...overrides,
  };
}

describe('CategoryStoryHierarchy', () => {
  const originalIntersectionObserver = global.IntersectionObserver;

  afterEach(() => {
    global.IntersectionObserver = originalIntersectionObserver;
  });

  test('partitions stories into one top story, four key stories, compact latest rows, and manual load more', () => {
    const items = Array.from({ length: 20 }, (_, index) => story(index + 1));

    render(
      <CategoryStoryHierarchy
        items={items}
        categoryLabel="National News"
        loadMoreLabel="Load More National Stories"
        emptyTitle="No stories found"
      />
    );

    expect(screen.getByText('Top Story')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Story 1' })).toBeTruthy();
    expect(screen.getByText('Key Stories')).toBeTruthy();
    expect(screen.getByText('Latest')).toBeTruthy();
    expect(screen.getByText('Story 5')).toBeTruthy();
    expect(screen.getByText('Story 13')).toBeTruthy();
    expect(screen.queryByText('Story 14')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Load More National Stories' }));

    expect(screen.getByText('Story 14')).toBeTruthy();
    expect(screen.getByText('Story 20')).toBeTruthy();
  });

  test('deduplicates stories before assigning priority positions', () => {
    render(
      <CategoryStoryHierarchy
        items={[story(1), story(1, { title: 'Duplicate Story 1', titleText: 'Duplicate Story 1' }), story(2)]}
        categoryLabel="Business News"
        loadMoreLabel="Load More Business Stories"
        emptyTitle="No stories found"
      />
    );

    expect(screen.getByRole('heading', { name: 'Story 1' })).toBeTruthy();
    expect(screen.queryByText('Duplicate Story 1')).toBeNull();
    expect(screen.getByText('Story 2')).toBeTruthy();
  });

  test('automatically requests more stories when the sentinel approaches the viewport', () => {
    const onLoadMore = jest.fn();
    let observerCallback: IntersectionObserverCallback = () => undefined;

    global.IntersectionObserver = jest.fn((callback: IntersectionObserverCallback) => {
      observerCallback = callback;
      return {
        observe: jest.fn(),
        disconnect: jest.fn(),
        root: null,
        rootMargin: '',
        thresholds: [],
        takeRecords: jest.fn(() => []),
        unobserve: jest.fn(),
      } as unknown as IntersectionObserver;
    }) as unknown as typeof IntersectionObserver;

    render(
      <CategoryStoryHierarchy
        items={Array.from({ length: 6 }, (_, index) => story(index + 1))}
        categoryLabel="National News"
        loadMoreLabel="Load More National Stories"
        emptyTitle="No stories found"
        hasMore
        autoLoadMore
        onLoadMore={onLoadMore}
      />
    );

    observerCallback([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver);

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  test('keeps loaded stories visible and shows retry for load-more errors', () => {
    const onLoadMore = jest.fn();

    render(
      <CategoryStoryHierarchy
        items={Array.from({ length: 6 }, (_, index) => story(index + 1))}
        categoryLabel="National News"
        loadMoreLabel="Load More National Stories"
        emptyTitle="No stories found"
        hasMore
        loadMoreError="API 503"
        onLoadMore={onLoadMore}
      />
    );

    expect(screen.getByRole('heading', { name: 'Story 1' })).toBeTruthy();
    expect(screen.getByText('Unable to load more stories.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });
});