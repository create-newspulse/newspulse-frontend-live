import {
  getPublicViralVideoKind,
  getPublicViralVideoPosterUrl,
  getPublicViralVideoXEmbedUrl,
  getPublicViralVideoXStatusUrl,
  getYouTubeEmbedUrl,
  normalizePublicViralVideosPayload,
  resolvePublicViralVideoPlayback,
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
          videoUrl: 'https://www.youtube.com/watch?v=AbCdEfGhIjK',
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
        videoUrl: 'https://www.youtube.com/watch?v=AbCdEfGhIjK',
        showOnHomepage: true,
        kind: 'youtube',
      })
    );
  });

  test('classifies YouTube, direct/cloud video, and social/external URLs', () => {
    expect(getPublicViralVideoKind('https://youtu.be/AbCdEfGhIjK')).toBe('youtube');
    expect(getYouTubeEmbedUrl('https://www.youtube.com/shorts/AbCdEfGhIjK')).toContain('/embed/AbCdEfGhIjK');
    expect(getPublicViralVideoKind('https://cdn.example.com/video.mp4?token=1')).toBe('video');
    expect(getPublicViralVideoKind('https://cdn.example.com/video.webm?token=1')).toBe('video');
    expect(getPublicViralVideoKind('https://cdn.example.com/video.mov?token=1')).toBe('video');
    expect(getPublicViralVideoKind('https://res.cloudinary.com/newspulse/video/upload/v1/news-pulse/clip')).toBe('video');
    expect(getPublicViralVideoKind('https://x.com/i/status/2049485537057427784')).toBe('external');
    expect(getPublicViralVideoKind('https://twitter.com/news/status/2049485537057427784')).toBe('external');
    expect(getPublicViralVideoKind('https://www.instagram.com/reel/example/')).toBe('external');
    expect(getPublicViralVideoKind('')).toBe('unsupported');
  });

  test('detects X and Twitter status URLs for official embeds', () => {
    expect(getPublicViralVideoXStatusUrl('https://x.com/i/status/2050104453630718079')).toBe('https://x.com/i/status/2050104453630718079');
    expect(getPublicViralVideoXStatusUrl('https://x.com/newspulse/status/2050104453630718079?s=20')).toBe('https://x.com/newspulse/status/2050104453630718079');
    expect(getPublicViralVideoXStatusUrl('https://twitter.com/i/status/2050104453630718079')).toBe('https://twitter.com/i/status/2050104453630718079');
    expect(getPublicViralVideoXStatusUrl('https://twitter.com/newspulse/status/2050104453630718079')).toBe('https://twitter.com/newspulse/status/2050104453630718079');
    expect(getPublicViralVideoXStatusUrl('https://www.instagram.com/reel/example/')).toBe('');
  });

  test('keeps X status URLs available for embedded detail playback', () => {
    const payload = normalizePublicViralVideosPayload({
      ok: true,
      settings: { frontendEnabled: true },
      items: [
        {
          id: 'x-video',
          title: 'X status video',
          posterImageUrl: 'https://cdn.example.com/x-poster.jpg',
          videoUrl: 'https://x.com/i/status/2050104453630718079',
          videoType: 'x',
          playbackMode: 'x_embed',
          status: 'published',
        },
      ],
    });

    expect(payload.items[0]).toEqual(expect.objectContaining({
      kind: 'external',
      videoType: 'x',
      playbackMode: 'x_embed',
      posterImageUrl: 'https://cdn.example.com/x-poster.jpg',
    }));
    expect(getPublicViralVideoXEmbedUrl(payload.items[0])).toBe('https://x.com/i/status/2050104453630718079');
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
        posterImageUrl: 'https://cdn.example.com/poster.jpg',
        thumbnailUrl: '',
        videoUrl: 'https://x.com/i/status/2049485537057427784',
        sourceUrl: 'https://x.com/i/status/2049485537057427784',
        showOnHomepage: true,
        status: 'published',
        kind: 'external',
        language: 'en',
      })
    );
  });

  test('prefers posterImageUrl and plays uploaded internal video files', () => {
    process.env.NEXT_PUBLIC_API_BASE = 'https://api.example.com/api';

    const payload = normalizePublicViralVideosPayload({
      ok: true,
      settings: { frontendEnabled: true },
      items: [
        {
          id: 'uploaded-reel',
          title: 'Uploaded News Pulse reel',
          summary: 'Uploaded MP4 from admin.',
          posterImageUrl: '/uploads/posters/reel.jpg',
          thumbnailUrl: '/uploads/thumbs/reel-thumb.jpg',
          videoFileUrl: '/uploads/videos/reel.mp4',
          sourceUrl: 'https://news.example.com/story',
          videoType: 'uploaded',
          playbackMode: 'internal',
          homepageFeature: true,
          status: 'published',
          publishedAt: '2026-05-01T10:00:00.000Z',
        },
      ],
    });

    const video = payload.items[0];
    expect(video).toEqual(expect.objectContaining({
      posterImageUrl: 'https://api.example.com/uploads/posters/reel.jpg',
      thumbnailUrl: 'https://api.example.com/uploads/thumbs/reel-thumb.jpg',
      videoFileUrl: 'https://api.example.com/uploads/videos/reel.mp4',
      showOnHomepage: true,
      kind: 'video',
    }));
    expect(getPublicViralVideoPosterUrl(video)).toBe('https://api.example.com/uploads/posters/reel.jpg');
    expect(resolvePublicViralVideoPlayback(video)).toEqual(expect.objectContaining({
      mode: 'direct',
      directUrl: 'https://api.example.com/uploads/videos/reel.mp4',
    }));

    delete process.env.NEXT_PUBLIC_API_BASE;
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

  test('keeps active videos with published backend flags for listing pages', () => {
    const payload = normalizePublicViralVideosPayload({
      ok: true,
      settings: { frontendEnabled: true },
      items: [
        {
          id: 'active-published-video',
          title: 'Published active global video',
          thumbnailUrl: 'https://cdn.example.com/thumb.jpg',
          videoUrl: 'https://cdn.example.com/video.mp4',
          status: 'active',
          publishStatus: 'Published',
          active: true,
          showOnHomepage: false,
        },
        {
          id: 'inactive-published-video',
          title: 'Inactive published video',
          thumbnailUrl: 'https://cdn.example.com/inactive.jpg',
          videoUrl: 'https://cdn.example.com/inactive.mp4',
          status: 'published',
          active: false,
        },
      ],
    });

    expect(payload.items.map((item) => item.id)).toEqual(['active-published-video']);
    expect(payload.items[0]).toEqual(expect.objectContaining({ status: 'published', showOnHomepage: false }));
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
