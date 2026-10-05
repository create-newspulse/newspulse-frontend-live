import React from 'react';
import { render, screen } from '@testing-library/react';

import RegionalHomeStorySections from '../../components/regional/RegionalHomeStorySections';
import { HomeRightRailLatestNews } from '../../components/home/HomeRightRail';
import { compactRegionalInitialStories } from '../../lib/regionalListingStories';

jest.mock('../../src/i18n/LanguageProvider', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

jest.mock('../../src/components/story/StoryImage', () => ({
  __esModule: true,
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
  TopStoryImage: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

describe('RegionalHomeStorySections', () => {
  test.each(['en', 'hi', 'gu'] as const)('%s preserves the Regional shell right-rail fallback, including time and Original label', (locale) => {
    const story = {
      _id: 'regional-sidebar-story',
      slug: 'regional-sidebar-slug',
      title: 'Regional sidebar headline',
      category: 'regional',
      language: locale,
      status: 'published',
      publishedAt: '2026-10-03T20:15:33.097Z',
      time: '4 Oct 2026 | 1:45 AM',
      titleIsOriginal: true,
    };
    const raw = render(<HomeRightRailLatestNews items={[story]} lang={locale} />);
    const before = raw.container.innerHTML;
    raw.unmount();
    const compact = render(<HomeRightRailLatestNews items={compactRegionalInitialStories([story], locale)} lang={locale} />);
    expect(compact.container.innerHTML).toBe(before);
    expect(screen.getByText(story.time)).toBeTruthy();
  });

  test.each(['en', 'hi', 'gu'] as const)('%s renders identical raw/compact cards and all ten stories before caught-up', (locale) => {
    const stories = Array.from({ length: 10 }, (_, index) => ({
      _id: `story-${index}`,
      title: index ? `Regional story ${index}` : 'October bridge Top Story',
      summary: `Regional summary ${index}`,
      content: '<p>Long regional body word </p>'.repeat(200),
      category: 'regional',
      language: locale,
      sourceLanguage: locale,
      status: 'published',
      publishedAt: new Date(Date.parse('2026-10-03T20:15:33.097Z') - index * 86400000).toISOString(),
      coverImage: { url: `https://images.example.test/story-${index}.jpg` },
      location: { district: 'Ahmedabad', city: 'Ahmedabad' },
    }));
    const props = {
      requestedLang: locale,
      stateName: 'Gujarat',
      categoryLabel: 'Latest from Gujarat',
      emptyTitle: 'No stories match your filters.',
      readMoreLabel: 'Read more',
      fallbackCategoryLabel: 'Regional',
      getDistrictLabel: (item: typeof stories[number]) => item.location.district,
      hasMore: false,
    };
    const raw = render(<RegionalHomeStorySections {...props} stories={stories} />);
    const before = raw.container.innerHTML;
    raw.unmount();
    const compact = render(<RegionalHomeStorySections {...props} stories={compactRegionalInitialStories(stories, locale)} />);
    expect(compact.container.innerHTML).toBe(before);
    expect(screen.getByText(/all caught up/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /load more/i })).toBeNull();
    for (const item of stories) expect(screen.getAllByRole('link').some((link) => link.getAttribute('href')?.endsWith(`/news/${item._id}`))).toBe(true);
    expect(screen.getByText('October bridge Top Story')).toBeTruthy();
  });

  test('renders top story and fresh stories from filtered Regional data', () => {
    render(
      <RegionalHomeStorySections
        stories={[
          {
            _id: 'gujarat-top',
            title: 'Ahmedabad civic update leads Gujarat coverage',
            summary: 'A regional update from Ahmedabad.',
            category: 'Civic',
            district: 'Ahmedabad',
            status: 'published',
            publishedAt: '2026-01-01T10:00:00.000Z',
            language: 'en',
          },
          {
            _id: 'gujarat-fresh',
            title: 'Surat education story moves ahead',
            summary: 'A fresh regional story from Surat.',
            category: 'Education',
            district: 'Surat',
            status: 'published',
            publishedAt: '2026-01-01T09:00:00.000Z',
            language: 'en',
          },
        ]}
        requestedLang="en"
        stateName="Gujarat"
        categoryLabel="Latest from Gujarat"
        emptyTitle="No stories match your filters."
        readMoreLabel="Read more"
        fallbackCategoryLabel="Regional"
        showDistrictBadges
        getDistrictLabel={(story) => story.district}
      />
    );

    expect(screen.getByText('Gujarat Top Story')).toBeTruthy();
    expect(screen.getByText(/Ahmedabad civic update/)).toBeTruthy();
    expect(screen.getByText('Gujarat Key Stories')).toBeTruthy();
    expect(screen.getByText(/Surat education story/)).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /Ahmedabad civic update/i }).some((link) => link.getAttribute('href') === '/news/gujarat-top')).toBe(true);
  });

  test('uses a context-specific load more label when provided', () => {
    const stories = Array.from({ length: 14 }, (_, index) => ({
      _id: `gujarat-story-${index}`,
      title: `Gujarat civic story ${index}`,
      summary: 'A regional civic update.',
      category: 'Civic',
      district: 'Ahmedabad',
      status: 'published',
      publishedAt: `2026-01-01T${String(23 - index).padStart(2, '0')}:00:00.000Z`,
      language: 'en',
    }));

    render(
      <RegionalHomeStorySections
        stories={stories}
        requestedLang="en"
        stateName="Gujarat"
        categoryLabel="Latest from Gujarat"
        emptyTitle="No stories match your filters."
        readMoreLabel="Read more"
        loadMoreLabel="Load More Civic Stories"
        fallbackCategoryLabel="Regional"
      />
    );

    expect(screen.getByRole('button', { name: 'Load More Civic Stories' })).toBeTruthy();
  });
});
