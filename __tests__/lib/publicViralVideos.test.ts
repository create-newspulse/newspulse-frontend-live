import {
  getPublicViralVideoKind,
  getYouTubeEmbedUrl,
  normalizePublicViralVideosPayload,
} from '../../lib/publicViralVideos';

describe('publicViralVideos helpers', () => {
  test('normalizes published videos from backend thumbnailUrl and videoUrl fields', () => {
    const payload = normalizePublicViralVideosPayload({
      ok: true,
      settings: { frontendEnabled: true },
      items: [
        {
          _id: 'video-1',
          title: 'A useful viral clip',
          summary: 'Short context for the clip',
          thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
          videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          category: 'Viral Videos',
          status: 'published',
          showOnHomepage: true,
          publishedAt: '2026-04-30T10:00:00.000Z',
        },
        {
          _id: 'draft-video',
          title: 'Draft clip',
          thumbnailUrl: 'https://cdn.example.com/draft.jpg',
          videoUrl: 'https://cdn.example.com/draft.mp4',
          status: 'draft',
        },
      ],
    });

    expect(payload.settings.frontendEnabled).toBe(true);
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]).toEqual(
      expect.objectContaining({
        id: 'video-1',
        title: 'A useful viral clip',
        summary: 'Short context for the clip',
        thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        showOnHomepage: true,
        kind: 'youtube',
      })
    );
  });

  test('classifies YouTube, direct/cloud video, and social/external URLs', () => {
    expect(getPublicViralVideoKind('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube');
    expect(getYouTubeEmbedUrl('https://www.youtube.com/shorts/dQw4w9WgXcQ')).toContain('/embed/dQw4w9WgXcQ');
    expect(getPublicViralVideoKind('https://cdn.example.com/video.mp4?token=1')).toBe('video');
    expect(getPublicViralVideoKind('https://cdn.example.com/video.webm?token=1')).toBe('video');
    expect(getPublicViralVideoKind('https://cdn.example.com/video.mov?token=1')).toBe('video');
    expect(getPublicViralVideoKind('https://res.cloudinary.com/demo/video/upload/v1/news-pulse/clip')).toBe('video');
    expect(getPublicViralVideoKind('https://x.com/i/status/2049485537057427784')).toBe('external');
    expect(getPublicViralVideoKind('https://twitter.com/news/status/2049485537057427784')).toBe('external');
    expect(getPublicViralVideoKind('https://www.instagram.com/reel/example/')).toBe('external');
    expect(getPublicViralVideoKind('')).toBe('unsupported');
  });

  test('keeps social source videos even when thumbnailUrl is missing', () => {
    const payload = normalizePublicViralVideosPayload({
      ok: true,
      settings: { frontendEnabled: true },
      items: [
        {
          id: 'social-video',
          title: 'Social source clip',
          summary: 'This clip opens on its original source.',
          videoUrl: 'https://www.instagram.com/reel/example/',
          status: 'published',
          showOnHomepage: true,
        },
      ],
    });

    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]).toEqual(
      expect.objectContaining({
        id: 'social-video',
        thumbnailUrl: '',
        kind: 'external',
        summary: 'This clip opens on its original source.',
      })
    );
  });

  test('maps backend aliases for published homepage videos', () => {
    const payload = normalizePublicViralVideosPayload({
      ok: true,
      settings: { frontendEnabled: true },
      items: [
        {
          id: 'homepage-video',
          title: 'Homepage social clip',
          caption: 'Caption from admin',
          posterImage: 'https://cdn.example.com/poster.jpg',
          sourceUrl: 'https://x.com/i/status/2049485537057427784',
          publishStatus: 'Published',
          isHomepageFeatured: true,
          category: 'Social',
          language: 'en',
          publishedAt: '2026-04-30T12:00:00.000Z',
        },
        {
          id: 'draft-video',
          title: 'Draft social clip',
          posterImage: 'https://cdn.example.com/draft.jpg',
          sourceUrl: 'https://x.com/i/status/111',
          publishStatus: 'Draft',
          isHomepageFeatured: true,
        },
      ],
    });

    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]).toEqual(
      expect.objectContaining({
        id: 'homepage-video',
        summary: 'Caption from admin',
        thumbnailUrl: 'https://cdn.example.com/poster.jpg',
        videoUrl: 'https://x.com/i/status/2049485537057427784',
        showOnHomepage: true,
        status: 'published',
        kind: 'external',
        language: 'en',
      })
    );
  });

  test('maps boolean published and homepage feature aliases', () => {
    const payload = normalizePublicViralVideosPayload({
      ok: true,
      settings: { frontendEnabled: true },
      items: [
        {
          id: 'published-boolean-video',
          title: 'Boolean published video',
          thumbnail: 'https://cdn.example.com/thumb.jpg',
          url: 'https://cdn.example.com/video.mp4',
          published: true,
          homepageFeatured: true,
        },
        {
          id: 'unpublished-boolean-video',
          title: 'Unpublished boolean video',
          thumbnail: 'https://cdn.example.com/draft.jpg',
          url: 'https://cdn.example.com/draft.mp4',
          published: false,
          homepageFeatured: true,
        },
      ],
    });

    expect(payload.items.map((item) => item.id)).toEqual(['published-boolean-video']);
    expect(payload.items[0]).toEqual(expect.objectContaining({ showOnHomepage: true, kind: 'video' }));
  });

  test('keeps frontend-disabled payloads empty', () => {
    const payload = normalizePublicViralVideosPayload({
      ok: true,
      settings: { frontendEnabled: false },
      items: [
        {
          id: 'video-1',
          title: 'Published clip',
          thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
          videoUrl: 'https://cdn.example.com/video.mp4',
          status: 'published',
        },
      ],
    });

    expect(payload.settings.frontendEnabled).toBe(false);
    expect(payload.items).toEqual([]);
  });
});
