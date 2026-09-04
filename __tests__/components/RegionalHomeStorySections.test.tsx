import React from 'react';
import { render, screen } from '@testing-library/react';

import RegionalHomeStorySections from '../../components/regional/RegionalHomeStorySections';

jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: any) => <a href={href} {...props}>{children}</a>,
}));

jest.mock('../../src/components/story/StoryImage', () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
  TopStoryImage: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

describe('RegionalHomeStorySections', () => {
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
