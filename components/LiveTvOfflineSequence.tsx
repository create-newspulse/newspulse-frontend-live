import React from 'react';

type OfflinePlaybackMode = 'poster' | 'video' | 'fallback';

type LiveTvOfflineSequenceProps = {
  posterUrl: string;
  videoUrl: string;
  title: string;
  mediaClassName: string;
  fallbackNode: React.ReactNode;
  surface: string;
  posterDurationMs?: number;
  controls?: boolean;
};

const DEFAULT_POSTER_DURATION_MS = 5000;

function resolveInitialMode(posterUrl: string, videoUrl: string): OfflinePlaybackMode {
  if (posterUrl) return 'poster';
  if (videoUrl) return 'video';
  return 'fallback';
}

export default function LiveTvOfflineSequence({
  posterUrl,
  videoUrl,
  title,
  mediaClassName,
  fallbackNode,
  surface,
  posterDurationMs = DEFAULT_POSTER_DURATION_MS,
  controls = true,
}: LiveTvOfflineSequenceProps) {
  const [mode, setMode] = React.useState<OfflinePlaybackMode>(() => resolveInitialMode(posterUrl, videoUrl));
  const [videoUnavailable, setVideoUnavailable] = React.useState(false);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const loggedModesRef = React.useRef<Set<string>>(new Set());

  const hasPoster = !!posterUrl;
  const hasVideo = !!videoUrl && !videoUnavailable;

  React.useEffect(() => {
    setVideoUnavailable(false);
    setMode(resolveInitialMode(posterUrl, videoUrl));
  }, [posterUrl, videoUrl]);

  React.useEffect(() => {
    if (mode !== 'poster' || !hasPoster || !hasVideo) return;

    const timer = window.setTimeout(() => {
      setMode('video');
    }, posterDurationMs);

    return () => window.clearTimeout(timer);
  }, [hasPoster, hasVideo, mode, posterDurationMs]);

  React.useEffect(() => {
    if (mode !== 'video') return;
    const video = videoRef.current;
    if (!video) return;

    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch(() => {
        // Controls remain visible so the user can start playback if autoplay is blocked.
      });
    }
  }, [mode, videoUrl]);

  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    const key = `${surface}:${mode}:${posterUrl}:${videoUrl}`;
    if (loggedModesRef.current.has(key)) return;
    loggedModesRef.current.add(key);

    console.debug('[LiveTV] playback mode', {
      surface,
      activeLive: false,
      offlinePosterImageUrl: posterUrl,
      offlineLoopVideoUrl: videoUrl,
      playbackMode: mode,
    });
  }, [mode, posterUrl, surface, videoUrl]);

  if (mode === 'poster' && hasPoster) {
    return (
      <img
        src={posterUrl}
        alt={title || 'News Pulse Live TV offline'}
        className={mediaClassName}
      />
    );
  }

  if (mode === 'video' && hasVideo) {
    return (
      <video
        key={videoUrl}
        ref={videoRef}
        className={mediaClassName}
        autoPlay
        controls={controls}
        loop={!hasPoster}
        muted
        playsInline
        poster={posterUrl || undefined}
        preload="auto"
        src={videoUrl}
        onEnded={() => {
          setMode(hasPoster ? 'poster' : 'video');
        }}
        onError={() => {
          setVideoUnavailable(true);
          setMode(hasPoster ? 'poster' : 'fallback');
        }}
      />
    );
  }

  return <>{fallbackNode}</>;
}