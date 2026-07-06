import Link from 'next/link';
import React from 'react';
import { Pause, Play, RotateCcw, RotateCw, Volume2, VolumeX } from 'lucide-react';

export type ViralVideoUiLocale = 'en' | 'hi' | 'gu';

export type ViralVideoUiLabels = {
  videoBadge: string;
  readNews: string;
  viewMore: string;
  facebook: string;
  x: string;
  copyLink: string;
  copied: string;
  play: string;
  pause: string;
  mute: string;
  unmute: string;
  rewind: string;
  forward: string;
  speed: string;
};

type NewsPulseVideoPlayerProps = {
  src: string;
  posterSrc: string;
  title: string;
  summary?: string;
  readNewsHref: string;
  viewMoreHref?: string;
  labels: ViralVideoUiLabels;
  className?: string;
  minHeightClassName?: string;
  autoPlay?: boolean;
  showBottomSummary?: boolean;
  showBottomTitle?: boolean;
  compactReelControls?: boolean;
  hideTopBranding?: boolean;
  lightTopChrome?: boolean;
  hasNextVideo?: boolean;
  onAdvanceToNext?: () => void;
  onPosterError?: React.ReactEventHandler<HTMLVideoElement>;
};

export function normalizeViralVideoUiLocale(value: unknown): ViralVideoUiLocale {
  const locale = String(value || '').toLowerCase().trim();
  if (locale === 'gu' || locale.startsWith('/gu')) return 'gu';
  if (locale === 'hi' || locale.startsWith('/hi')) return 'hi';
  return 'en';
}

export function getViralVideoUiLabels(value: unknown): ViralVideoUiLabels {
  const locale = normalizeViralVideoUiLocale(value);

  if (locale === 'gu') {
    return {
      videoBadge: 'વીડિયો',
      readNews: 'સમાચાર વાંચો',
      viewMore: 'વધુ જુઓ',
      facebook: 'ફેસબુક',
      x: 'એક્સ',
      copyLink: 'લિંક કૉપી કરો',
      copied: 'કૉપી થઈ',
      play: 'ચાલુ કરો',
      pause: 'રોકો',
      mute: 'મ્યૂટ',
      unmute: 'અનમ્યૂટ',
      rewind: '5 સેકન્ડ પાછળ',
      forward: '5 સેકન્ડ આગળ',
      speed: 'સ્પીડ',
    };
  }

  if (locale === 'hi') {
    return {
      videoBadge: 'वीडियो',
      readNews: 'खबर पढ़ें',
      viewMore: 'और देखें',
      facebook: 'फेसबुक',
      x: 'एक्स',
      copyLink: 'लिंक कॉपी करें',
      copied: 'कॉपी हो गया',
      play: 'चलाएँ',
      pause: 'रोकें',
      mute: 'म्यूट',
      unmute: 'अनम्यूट',
      rewind: '5 सेकंड पीछे',
      forward: '5 सेकंड आगे',
      speed: 'स्पीड',
    };
  }

  return {
    videoBadge: 'VIDEO',
    readNews: 'Read News',
    viewMore: 'View more',
    facebook: 'Facebook',
    x: 'X',
    copyLink: 'Copy Link',
    copied: 'Copied',
    play: 'Play',
    pause: 'Pause',
    mute: 'Mute',
    unmute: 'Unmute',
    rewind: 'Back 5 seconds',
    forward: 'Forward 5 seconds',
    speed: 'Speed',
  };
}

function formatTime(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '0:00';
  const totalSeconds = Math.floor(value);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export default function NewsPulseVideoPlayer({
  src,
  posterSrc,
  title,
  summary,
  readNewsHref,
  viewMoreHref,
  labels,
  className = '',
  minHeightClassName = 'min-h-[420px]',
  autoPlay = false,
  showBottomSummary = false,
  showBottomTitle = true,
  compactReelControls = false,
  hideTopBranding = false,
  lightTopChrome = false,
  hasNextVideo = false,
  onAdvanceToNext,
  onPosterError,
}: NewsPulseVideoPlayerProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const safeSrc = String(src || '').trim();
  const [playing, setPlaying] = React.useState(false);
  const [muted, setMuted] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [playbackRate, setPlaybackRate] = React.useState(1);
  const [videoLoadFailed, setVideoLoadFailed] = React.useState(false);
  const videoUnavailable = !safeSrc || videoLoadFailed;

  React.useEffect(() => {
    const video = videoRef.current;
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackRate(1);
    setVideoLoadFailed(false);
    if (!video || !safeSrc) return;
    video.playbackRate = 1;
    video.load();
    if (!autoPlay) return;

    const playRequest = video.play();
    if (playRequest && typeof playRequest.catch === 'function') {
      playRequest.catch(() => setPlaying(false));
    }
  }, [autoPlay, safeSrc]);

  const togglePlay = React.useCallback(() => {
    const video = videoRef.current;
    if (!video || videoUnavailable) return;

    if (video.paused || video.ended) {
      if (video.ended) video.currentTime = 0;
      const playRequest = video.play();
      if (playRequest && typeof playRequest.catch === 'function') {
        playRequest.catch(() => setPlaying(false));
      }
      return;
    }

    video.pause();
  }, [videoUnavailable]);

  const seekBy = React.useCallback((amount: number) => {
    const video = videoRef.current;
    if (!video || videoUnavailable) return;
    video.currentTime = Math.min(Math.max(video.currentTime + amount, 0), Number.isFinite(video.duration) ? video.duration : video.currentTime + amount);
  }, [videoUnavailable]);

  const toggleMute = React.useCallback(() => {
    const video = videoRef.current;
    if (!video || videoUnavailable) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }, [videoUnavailable]);

  const cycleSpeed = React.useCallback(() => {
    const video = videoRef.current;
    if (!video || videoUnavailable) return;
    const rates = [1, 1.25, 1.5, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length] || 1;
    video.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  }, [playbackRate, videoUnavailable]);

  const progressValue = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;
  const hasReadNewsHref = Boolean(readNewsHref);
  const hasViewMoreHref = Boolean(viewMoreHref);
  const readNewsIsExternal = /^https?:\/\//i.test(readNewsHref);

  const renderReadNewsAction = () => {
    if (!hasReadNewsHref) return null;

    if (readNewsIsExternal) {
      return (
        <a
          href={readNewsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 rounded-full bg-white/96 px-3 py-1.5 text-[10px] font-black text-slate-950 shadow-lg transition hover:bg-white"
        >
          {labels.readNews}
        </a>
      );
    }

    return (
      <Link
        href={readNewsHref}
        className="shrink-0 rounded-full bg-white/96 px-3 py-1.5 text-[10px] font-black text-slate-950 shadow-lg transition hover:bg-white"
      >
        {labels.readNews}
      </Link>
    );
  };

  return (
    <div className={`portrait-video-card viral-video-player viral-video-card video-player-card video-reel-card relative h-full w-full overflow-hidden rounded-[24px] border-0 bg-[#111318] p-0 shadow-none outline-none ${minHeightClassName} ${className}`}>
      <style jsx>{`
        .portrait-video-card,
        .viral-video-card,
        .video-player-card {
          position: relative;
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          padding: 0 !important;
          overflow: hidden !important;
          border-radius: 24px;
          background: #111318;
          isolation: isolate;
          clip-path: inset(0 round 24px);
        }
        .portrait-video-card::before,
        .portrait-video-card::after,
        .viral-video-card::before,
        .viral-video-card::after,
        .video-player-card::before,
        .video-player-card::after {
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
        }
        .portrait-video-card video,
        .viral-video-player video,
        .viral-video-card video,
        .video-player-card video,
        .video-reel-card video,
        .portrait-video-card img,
        .viral-video-player img,
        .viral-video-card img,
        .video-player-card img,
        .video-reel-card img,
        .video-media-wrapper {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
          border: none !important;
          outline: none !important;
          box-shadow: none !important;
          padding: 0 !important;
          border-radius: inherit;
          transform: scale(1.01);
        }
      `}</style>
      <video
        ref={videoRef}
        className="portrait-video-media video-media-wrapper video-shell video-frame h-full w-full cursor-pointer rounded-[24px] border-0 object-cover outline-none"
        controls={false}
        controlsList="nodownload noplaybackrate noremoteplayback nofullscreen"
        disablePictureInPicture
        playsInline
        preload="metadata"
        poster={posterSrc || undefined}
        src={safeSrc || undefined}
        onClick={togglePlay}
        onContextMenu={(event) => event.preventDefault()}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime || 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          if (hasNextVideo && onAdvanceToNext) {
            onAdvanceToNext();
            return;
          }

          setPlaying(false);
        }}
        onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
        onError={(event) => {
          setVideoLoadFailed(true);
          setPlaying(false);
          onPosterError?.(event);
        }}
      />

      {videoUnavailable ? (
        <div className="pointer-events-none absolute inset-0 z-40 grid place-items-center bg-[#111318] text-center text-sm font-black text-white/86">
          Video unavailable right now.
        </div>
      ) : null}

      <div className={lightTopChrome
        ? 'pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.10)_0%,rgba(2,6,23,0.04)_24%,rgba(2,6,23,0.05)_48%,rgba(2,6,23,0.82)_100%)]'
        : 'pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.58)_0%,rgba(2,6,23,0.10)_28%,rgba(2,6,23,0.05)_52%,rgba(2,6,23,0.88)_100%)]'} />

      {!hideTopBranding || hasReadNewsHref ? (
        <div className="absolute inset-x-[18px] top-4 z-30 flex items-start justify-between gap-3">
          {!hideTopBranding ? (
            <>
              <span className="truncate pt-1 text-xs font-black uppercase tracking-[0.18em] leading-none text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]">
                News Pulse
              </span>
              <span className="ml-auto rounded-full bg-[#2563EB] px-3 py-1 text-xs font-black uppercase tracking-[0.18em] leading-none text-white shadow-[0_10px_24px_rgba(37,99,235,0.35)]">Viral</span>
            </>
          ) : (
            <span className="min-w-0" />
          )}

          <div className="pointer-events-auto ml-2 shrink-0">{renderReadNewsAction()}</div>
        </div>
      ) : null}

      {!playing ? (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute left-1/2 top-1/2 z-30 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/18 text-white shadow-[0_22px_42px_-20px_rgba(0,0,0,0.95)] ring-1 ring-white/35 backdrop-blur-md transition hover:scale-105 hover:bg-white/24"
          aria-label={labels.play}
        >
          <Play className="ml-0.5 h-7 w-7 fill-current" />
        </button>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 z-30 p-3 sm:p-4">
        {hasViewMoreHref ? (
          <div className="mb-2 flex justify-end">
            <Link href={viewMoreHref || '#'} className="rounded-full bg-black/44 px-2.5 py-1 text-[10px] font-bold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-black/60">
              {labels.viewMore}
            </Link>
          </div>
        ) : null}

        {showBottomTitle || (showBottomSummary && summary) ? (
          <div className="mb-3">
            {showBottomTitle ? (
              <h3 className="line-clamp-2 text-[15px] font-black leading-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)] sm:text-base">
                {title}
              </h3>
            ) : null}
            {showBottomSummary && summary ? (
              <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-white/72 drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]">
                {summary}
              </p>
            ) : null}
          </div>
        ) : null}

        <input
          type="range"
          min={0}
          max={100}
          step={0.1}
          value={progressValue}
          onChange={(event) => {
            const video = videoRef.current;
            if (!video || duration <= 0) return;
            video.currentTime = (Number(event.currentTarget.value) / 100) * duration;
          }}
          className="h-1 w-full cursor-pointer accent-white"
          style={{ accentColor: '#FFFFFF' }}
          aria-label="Video progress"
        />

        {compactReelControls ? (
          <div className="mt-2 grid grid-cols-[42px_minmax(0,1fr)_42px] items-center gap-2 text-[11px] font-bold text-white/86">
            <span className="tabular-nums text-white opacity-100" style={{ color: '#FFFFFF', opacity: 1 }}>{formatTime(currentTime)}</span>
            <div className="flex min-w-0 items-center justify-center gap-1.5">
              <button type="button" onClick={cycleSpeed} className="h-8 rounded-full bg-white/10 px-2 text-[11px] font-black text-white ring-1 ring-white/10 transition hover:bg-white/16" aria-label={labels.speed}>
                {playbackRate}x
              </button>
              <button type="button" onClick={() => seekBy(-5)} className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/10 transition hover:bg-white/16" aria-label={labels.rewind}>
                <RotateCcw className="h-4 w-4" />
              </button>
              <button type="button" onClick={togglePlay} className="grid h-9 w-9 place-items-center rounded-full bg-white/14 text-white ring-1 ring-white/14 shadow-lg transition hover:bg-white/20" aria-label={playing ? labels.pause : labels.play}>
                {playing ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
              </button>
              <button type="button" onClick={() => seekBy(5)} className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/10 transition hover:bg-white/16" aria-label={labels.forward}>
                <RotateCw className="h-4 w-4" />
              </button>
              <button type="button" onClick={toggleMute} className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/10 transition hover:bg-white/16" aria-label={muted ? labels.unmute : labels.mute}>
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
            </div>
            <span className="text-right tabular-nums text-white opacity-100" style={{ color: '#FFFFFF', opacity: 1 }}>{formatTime(duration)}</span>
          </div>
        ) : (
          <div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-bold text-white/86">
            <span className="tabular-nums text-white opacity-100" style={{ color: '#FFFFFF', opacity: 1 }}>{formatTime(currentTime)} / {formatTime(duration)}</span>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => seekBy(-5)} className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/10 transition hover:bg-white/16" aria-label={labels.rewind}>
                <RotateCcw className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => seekBy(5)} className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/10 transition hover:bg-white/16" aria-label={labels.forward}>
                <RotateCw className="h-4 w-4" />
              </button>
              <button type="button" onClick={toggleMute} className="grid h-8 w-8 place-items-center rounded-full bg-white/10 text-white ring-1 ring-white/10 transition hover:bg-white/16" aria-label={muted ? labels.unmute : labels.mute}>
                {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
              </button>
              <button type="button" onClick={cycleSpeed} className="h-8 rounded-full bg-white/10 px-2.5 text-[11px] font-black text-white ring-1 ring-white/10 transition hover:bg-white/16" aria-label={labels.speed}>
                {playbackRate}x
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
