import {
  LIVE_TV_OFFLINE_MESSAGE,
  LIVE_TV_VIDEO_UNAVAILABLE_MESSAGE,
  getLiveTvDisplayBadgeLabel,
  normalizeLiveTvCurrentSource,
  normalizeLiveTvUpcomingSchedule,
  resolveLiveTvCurrentSourcePresentation,
  resolveLiveTvPresentation,
} from '../../src/lib/liveTv';

describe('Live TV current source presentation', () => {
  test('shows AIRA bulletin as on air without using the LIVE label', () => {
    const source = normalizeLiveTvCurrentSource({
      enabled: true,
      sourceType: 'aira_bulletin',
      title: 'AIRA Morning Bulletin',
      embedUrl: 'https://www.youtube.com/watch?v=AbCdEfGhIjK',
    });

    expect(source).not.toBeNull();
    const presentation = resolveLiveTvCurrentSourcePresentation(source!);

    expect(presentation.badgeLabel).toBe('AIRA BULLETIN • ON AIR');
    expect(presentation.modeLabel).toBe('AIRA BULLETIN • ON AIR');
    expect(presentation.playerKind).toBe('iframe');
    expect(presentation.playerUrl).toBe('https://www.youtube-nocookie.com/embed/AbCdEfGhIjK?rel=0&modestbranding=1&playsinline=1');
  });

  test('keeps MP4 replay sources as fallback media', () => {
    const source = normalizeLiveTvCurrentSource({
      enabled: true,
      sourceType: 'offline_replay',
      fallbackVideoUrl: 'https://cdn.example.com/replays/latest.mp4',
    });

    expect(source).not.toBeNull();
    const presentation = resolveLiveTvCurrentSourcePresentation(source!);

    expect(presentation.badgeLabel).toBe('REPLAY');
    expect(presentation.playerKind).toBeNull();
    expect(presentation.playerUrl).toBe('');
    expect(presentation.fallbackVideoKind).toBe('video');
    expect(presentation.fallbackVideoUrl).toBe('https://cdn.example.com/replays/latest.mp4');
  });

  test('prefers offline media over fallback replay when there is no active stream', () => {
    const presentation = resolveLiveTvPresentation({
      enabled: false,
      mode: 'offline-replay',
      embedUrl: 'https://www.youtube.com/watch?v=AbCdEfGhIjK',
      offlineLoopVideoUrl: 'https://cdn.example.com/live-tv/offline-loop.mp4',
      offlinePosterImageUrl: 'https://cdn.example.com/live-tv/offline-poster.jpg',
      fallbackVideoUrl: 'https://youtu.be/ZyXwVuTsRqP',
      title: '',
      subtitle: '',
    });

    expect(presentation.playerUrl).toBe('');
    expect(presentation.playerKind).toBeNull();
    expect(presentation.offlineLoopVideoUrl).toBe('https://cdn.example.com/live-tv/offline-loop.mp4');
    expect(presentation.offlinePosterImageUrl).toBe('https://cdn.example.com/live-tv/offline-poster.jpg');
    expect(presentation.fallbackVideoUrl).toBe('https://www.youtube-nocookie.com/embed/ZyXwVuTsRqP?rel=0&modestbranding=1&playsinline=1');
    expect(presentation.fallbackVideoKind).toBe('iframe');
  });

  test('keeps active YouTube embed as the primary player', () => {
    const presentation = resolveLiveTvPresentation({
      enabled: true,
      mode: 'news-pulse-live',
      embedUrl: 'https://www.youtube-nocookie.com/embed/AbCdEfGhIjK?rel=0&modestbranding=1&playsinline=1',
      offlineLoopVideoUrl: 'https://cdn.example.com/live-tv/offline-loop.mp4',
      offlinePosterImageUrl: 'https://cdn.example.com/live-tv/offline-poster.jpg',
      fallbackVideoUrl: 'https://cdn.example.com/live-tv/replay.mp4',
      title: '',
      subtitle: '',
    });

    expect(presentation.playerKind).toBe('iframe');
    expect(presentation.playerUrl).toBe('https://www.youtube-nocookie.com/embed/AbCdEfGhIjK?rel=0&modestbranding=1&playsinline=1');
    expect(presentation.offlineLoopVideoUrl).toBe('https://cdn.example.com/live-tv/offline-loop.mp4');
    expect(presentation.fallbackVideoUrl).toBe('https://cdn.example.com/live-tv/replay.mp4');
  });

  test('uses non-live badges for offline and fallback media', () => {
    const offline = resolveLiveTvPresentation({
      enabled: false,
      mode: 'news-pulse-live',
      embedUrl: '',
      offlineLoopVideoUrl: '',
      offlinePosterImageUrl: 'https://cdn.example.com/live-tv/offline.jpg',
      fallbackVideoUrl: 'https://cdn.example.com/live-tv/replay.mp4',
      title: '',
      subtitle: '',
    });

    const replay = resolveLiveTvPresentation({
      enabled: false,
      mode: 'news-pulse-live',
      embedUrl: '',
      offlineLoopVideoUrl: '',
      offlinePosterImageUrl: '',
      fallbackVideoUrl: 'https://cdn.example.com/live-tv/replay.mp4',
      title: '',
      subtitle: '',
    });

    const empty = resolveLiveTvPresentation({
      enabled: false,
      mode: 'news-pulse-live',
      embedUrl: '',
      offlineLoopVideoUrl: '',
      offlinePosterImageUrl: '',
      fallbackVideoUrl: '',
      title: '',
      subtitle: '',
    });

    expect(getLiveTvDisplayBadgeLabel(offline)).toBe('OFFLINE');
    expect(getLiveTvDisplayBadgeLabel(replay)).toBe('REPLAY');
    expect(getLiveTvDisplayBadgeLabel(empty)).toBe('COMING SOON');
  });

  test('shows offline message when current source is disabled', () => {
    const source = normalizeLiveTvCurrentSource({
      enabled: false,
      sourceType: 'youtube_live',
      embedUrl: 'https://www.youtube.com/watch?v=AbCdEfGhIjK',
      offlineLoopVideoUrl: 'https://cdn.example.com/live-tv/offline-loop.mp4',
      offlinePosterImageUrl: 'https://cdn.example.com/live-tv/offline-poster.jpg',
    });

    expect(source).not.toBeNull();
    const presentation = resolveLiveTvCurrentSourcePresentation(source!);

    expect(presentation.playerUrl).toBe('');
    expect(presentation.playerKind).toBeNull();
    expect(presentation.offlineLoopVideoUrl).toBe('https://cdn.example.com/live-tv/offline-loop.mp4');
    expect(presentation.offlinePosterImageUrl).toBe('https://cdn.example.com/live-tv/offline-poster.jpg');
    expect(presentation.message).toBe(LIVE_TV_OFFLINE_MESSAGE);
  });

  test('does not render a broken player when the active source has no video URL', () => {
    const source = normalizeLiveTvCurrentSource({
      enabled: true,
      sourceType: 'breaking_bulletin',
      title: 'Breaking Update',
    });

    expect(source).not.toBeNull();
    const presentation = resolveLiveTvCurrentSourcePresentation(source!);

    expect(presentation.badgeLabel).toBe('BREAKING BULLETIN');
    expect(presentation.playerUrl).toBe('');
    expect(presentation.playerKind).toBeNull();
    expect(presentation.message).toBe(LIVE_TV_VIDEO_UNAVAILABLE_MESSAGE);
  });

  test('keeps offline poster when the active source has no video URL', () => {
    const source = normalizeLiveTvCurrentSource({
      enabled: true,
      sourceType: 'youtube_live',
      posterImageUrl: '/uploads/live-tv/holding.jpg',
    });

    expect(source).not.toBeNull();
    const presentation = resolveLiveTvCurrentSourcePresentation(source!);

    expect(presentation.playerUrl).toBe('');
    expect(presentation.playerKind).toBeNull();
    expect(presentation.offlineLoopVideoUrl).toBe('');
    expect(presentation.offlinePosterImageUrl).toBe('/uploads/live-tv/holding.jpg');
    expect(presentation.message).toBe(LIVE_TV_VIDEO_UNAVAILABLE_MESSAGE);
  });

  test('normalizes upcoming schedule items without exposing internal IDs', () => {
    const schedule = normalizeLiveTvUpcomingSchedule({
      items: [
        {
          id: 'internal-123',
          startTime: '2026-07-13T18:00:00.000Z',
          endTime: '2026-07-13T18:30:00.000Z',
          title: 'Evening Headlines',
          sourceType: 'scheduled_program',
        },
        {
          _id: 'internal-456',
          time: 'Tonight',
          title: 'Partner Special',
          type: 'sponsored_program',
        },
      ],
    });

    expect(schedule).toHaveLength(2);
    expect(schedule[0]).toMatchObject({
      title: 'Evening Headlines',
      label: 'SCHEDULED',
      type: 'scheduled_program',
    });
    expect(schedule[1]).toMatchObject({
      time: 'Tonight',
      title: 'Partner Special',
      label: 'SPONSORED PROGRAM',
      type: 'sponsored_program',
    });
    expect(schedule[0] as any).not.toHaveProperty('id');
    expect(schedule[1] as any).not.toHaveProperty('_id');
  });
});