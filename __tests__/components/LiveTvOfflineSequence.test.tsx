import React from 'react';
import { act, fireEvent, render } from '@testing-library/react';

import LiveTvOfflineSequence from '../../components/LiveTvOfflineSequence';

describe('LiveTvOfflineSequence', () => {
  const playMock = jest.spyOn(window.HTMLMediaElement.prototype, 'play').mockImplementation(() => Promise.resolve());

  beforeEach(() => {
    jest.useFakeTimers();
    playMock.mockClear();
  });

  afterEach(() => {
    act(() => {
      jest.runOnlyPendingTimers();
    });
    jest.useRealTimers();
  });

  afterAll(() => {
    playMock.mockRestore();
  });

  test('shows poster first, then video, then poster again after video ends', () => {
    const { container } = render(
      <LiveTvOfflineSequence
        posterUrl="/uploads/live-tv/poster.jpg"
        videoUrl="/uploads/live-tv/loop.mp4"
        title="Offline Live TV"
        mediaClassName="media"
        posterClassName="poster-media"
        surface="test"
        posterDurationMs={1000}
        fallbackNode={<div data-testid="fallback">Coming soon</div>}
      />
    );

    const poster = container.querySelector('img');
    expect(poster?.getAttribute('src')).toBe('/uploads/live-tv/poster.jpg');
    expect(poster?.getAttribute('alt')).toBe('News Pulse Live TV offline poster');
    expect(poster?.className).toBe('poster-media');
    expect(poster?.style.objectFit).toBe('contain');
    expect(poster?.style.objectPosition).toBe('center center');
    expect(container.querySelector('video')).toBeNull();

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    const video = container.querySelector('video');
    expect(video?.getAttribute('src')).toBe('/uploads/live-tv/loop.mp4');
    expect(video?.className).toBe('media');
    expect(video?.hasAttribute('autoplay')).toBe(true);
    expect((video as HTMLVideoElement).muted).toBe(true);
    expect(video?.hasAttribute('loop')).toBe(false);
    expect(video?.hasAttribute('playsinline')).toBe(true);
    expect(video?.style.objectFit).toBe('cover');
    expect(video?.style.background).toBe('rgb(0, 0, 0)');
    expect(playMock).toHaveBeenCalledTimes(1);
    expect(container.querySelector('img')).toBeNull();

    fireEvent.ended(video as HTMLVideoElement);

    expect(container.querySelector('img')?.getAttribute('src')).toBe('/uploads/live-tv/poster.jpg');
  });

  test('keeps poster visible if offline video fails', () => {
    const { container } = render(
      <LiveTvOfflineSequence
        posterUrl="/uploads/live-tv/poster.jpg"
        videoUrl="/uploads/live-tv/loop.mp4"
        title="Offline Live TV"
        mediaClassName="media"
        surface="test"
        posterDurationMs={1000}
        fallbackNode={<div data-testid="fallback">Coming soon</div>}
      />
    );

    act(() => {
      jest.advanceTimersByTime(1000);
    });

    fireEvent.error(container.querySelector('video') as HTMLVideoElement);

    const poster = container.querySelector('img');
    expect(poster?.getAttribute('src')).toBe('/uploads/live-tv/poster.jpg');
    expect(poster?.style.objectFit).toBe('contain');
    expect(poster?.style.objectPosition).toBe('center center');
  });

  test('uses fallback node if video-only offline media fails', () => {
    const { container, getByTestId } = render(
      <LiveTvOfflineSequence
        posterUrl=""
        videoUrl="/uploads/live-tv/loop.mp4"
        title="Offline Live TV"
        mediaClassName="media"
        surface="test"
        fallbackNode={<div data-testid="fallback">Coming soon</div>}
      />
    );

    const video = container.querySelector('video') as HTMLVideoElement;
    expect(video?.getAttribute('src')).toBe('/uploads/live-tv/loop.mp4');
    expect(video?.hasAttribute('loop')).toBe(true);

    fireEvent.error(video);

    expect(getByTestId('fallback').textContent).toBe('Coming soon');
  });
});