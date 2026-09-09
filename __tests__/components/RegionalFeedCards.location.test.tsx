import React from 'react';
import { render, screen } from '@testing-library/react';

import RegionalFeedCards from '../../components/regional/RegionalFeedCards';

jest.mock('../../src/components/story/StoryImage', () => ({
  __esModule: true,
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}));

function story(overrides: Record<string, any> = {}) {
  return {
    _id: 'regional-story-1',
    slug: 'regional-story-1',
    title: 'Regional civic update',
    summary: 'A public regional summary.',
    category: 'regional',
    status: 'published',
    publishedAt: '2026-09-09T09:00:00.000Z',
    location: {
      district: 'ahmedabad',
      state: 'draft',
    },
    ...overrides,
  };
}

describe('RegionalFeedCards public location metadata', () => {
  test('renders Ahmedabad location without appending publication status', () => {
    render(
      <RegionalFeedCards
        stories={[story()]}
        requestedLang="en"
        showDistrictBadges
        loading={false}
      />
    );

    expect(screen.getByText('📍 Ahmedabad')).toBeTruthy();
    expect(screen.queryByText('draft')).toBeNull();
    expect(screen.queryByText('published')).toBeNull();
  });
});