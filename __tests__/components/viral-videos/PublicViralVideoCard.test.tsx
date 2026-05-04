import React from 'react';
import { render, screen } from '@testing-library/react';

import PublicViralVideoCard from '../../../components/viral-videos/PublicViralVideoCard';
import type { PublicViralVideo } from '../../../lib/publicViralVideos';

function makeVideo(overrides: Partial<PublicViralVideo> = {}): PublicViralVideo {
  return {
    id: 'viral-video-1',
    title: 'Viral source clip',
    summary: 'Clip summary for the public card.',
    posterImageUrl: 'https://cdn.example.com/poster.jpg',
    thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
    videoFileUrl: '',
    videoUrl: 'https://x.com/i/status/2049868222804222122',
    sourceUrl: 'https://x.com/i/status/2049868222804222122',
    videoType: 'external',
    playbackMode: 'external',
    category: 'Viral Videos',
    publishedAt: '2026-04-30T10:00:00.000Z',
    language: 'en',
    showOnHomepage: true,
    status: 'published',
    slug: 'viral-source-clip',
    kind: 'external',
    youtubeEmbedUrl: '',
    raw: {},
    ...overrides,
  };
}

describe('PublicViralVideoCard', () => {
  test('opens X source preview directly in a new tab without an internal route', () => {
    const sourceUrl = 'https://x.com/i/status/2049868222804222122';
    const { container } = render(<PublicViralVideoCard video={makeVideo({ videoUrl: sourceUrl })} />);

    expect(container.querySelector('video')).toBeNull();
    expect(container.querySelector('iframe')).toBeNull();

    const previewLinks = screen.getAllByRole('link', { name: /open source/i });
    expect(previewLinks.length).toBeGreaterThan(0);

    previewLinks.forEach((link) => {
      expect(link.getAttribute('href')).toBe(sourceUrl);
      expect(link.getAttribute('target')).toBe('_blank');
      expect(link.getAttribute('rel')).toBe('noopener noreferrer');
      expect(link.getAttribute('href')).not.toMatch(/^\//);
    });
  });

  test('hides source preview links when an external source URL is missing or relative', () => {
    const missing = render(<PublicViralVideoCard video={makeVideo({ videoUrl: '', sourceUrl: '' })} />);
    expect(missing.queryByRole('link', { name: /open source/i })).toBeNull();
    missing.unmount();

    render(<PublicViralVideoCard video={makeVideo({ videoUrl: 'x.com/i/status/2049868222804222122', sourceUrl: '' })} />);
    expect(screen.queryByRole('link', { name: /open source/i })).toBeNull();
  });
});
