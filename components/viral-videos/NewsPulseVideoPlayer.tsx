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
  onPosterError,
}: NewsPulseVideoPlayerProps) {
  const videoRef = React.useRef<HTMLVideoElement | null>(null);
  const [playing, setPlaying] = React.useState(false);
  const [muted, setMuted] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [duration, setDuration] = React.useState(0);
  const [playbackRate, setPlaybackRate] = React.useState(1);

  React.useEffect(() => {
    const video = videoRef.current;
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setPlaybackRate(1);
    if (!video) return;
    video.playbackRate = 1;
    video.load();
    if (!autoPlay) return;

    const playRequest = video.play();
    if (playRequest && typeof playRequest.catch === 'function') {
      playRequest.catch(() => setPlaying(false));
    }
  }, [autoPlay, src]);

  const togglePlay = React.useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused || video.ended) {
      const playRequest = video.play();
      if (playRequest && typeof playRequest.catch === 'function') {
        playRequest.catch(() => setPlaying(false));
      }
      return;
    }

    video.pause();
  }, []);

  const seekBy = React.useCallback((amount: number) => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = Math.min(Math.max(video.currentTime + amount, 0), Number.isFinite(video.duration) ? video.duration : video.currentTime + amount);
  }, []);

  const toggleMute = React.useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }, []);

  const cycleSpeed = React.useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const rates = [1, 1.25, 1.5, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length] || 1;
    video.playbackRate = nextRate;
    setPlaybackRate(nextRate);
  }, [playbackRate]);

  const progressValue = duration > 0 ? Math.min((currentTime / duration) * 100, 100) : 0;
  const hasReadNewsHref = Boolean(readNewsHref);
  const hasViewMoreHref = Boolean(viewMoreHref);
  const readNewsIsExternal = /^https?:\/\//i.test(readNewsHref);

  return (
    <div className={`relative h-full w-full overflow-hidden bg-slate-950 ${minHeightClassName} ${className}`}>
      <video
        ref={videoRef}
        className="h-full w-full cursor-pointer object-cover"
        controls={false}
        controlsList="nodownload noplaybackrate noremoteplayback nofullscreen"
        disablePictureInPicture
        playsInline
        preload="metadata"
        poster={posterSrc || undefined}
        src={src}
        onClick={togglePlay}
        onLoadedMetadata={(event) => setDuration(event.currentTarget.duration || 0)}
        onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime || 0)}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onVolumeChange={(event) => setMuted(event.currentTarget.muted)}
        onError={onPosterError}
      />

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.58)_0%,rgba(2,6,23,0.10)_28%,rgba(2,6,23,0.05)_52%,rgba(2,6,23,0.88)_100%)]" />
      <div className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10" />

      <div className="absolute inset-x-0 top-0 z-30 flex items-start justify-between gap-3 p-3">
        <div className="min-w-0">
          <div className="inline-flex max-w-full items-center gap-2 rounded-full bg-black/46 px-2.5 py-1 text-white shadow-sm ring-1 ring-white/16 backdrop-blur">
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded bg-newsPulse-navy text-[10px] font-black leading-none">NP</span>
            <span className="truncate text-[11px] font-black leading-none">News Pulse</span>
          </div>
          <div className="mt-2 inline-flex rounded-full bg-newsPulse-blue px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-newsPulse-white shadow-lg">
            {labels.videoBadge}
          </div>
        </div>

        {hasReadNewsHref ? (
          readNewsIsExternal ? (
            <a
              href={readNewsHref}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-slate-950 shadow-lg transition hover:bg-white/90"
            >
              {labels.readNews}
            </a>
          ) : (
            <Link
              href={readNewsHref}
              className="shrink-0 rounded-full bg-white px-3 py-1.5 text-[11px] font-black text-slate-950 shadow-lg transition hover:bg-white/90"
            >
              {labels.readNews}
            </Link>
          )
        ) : null}
      </div>

      <button
        type="button"
        onClick={togglePlay}
        className="absolute left-1/2 top-1/2 z-30 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/18 text-white shadow-[0_22px_42px_-20px_rgba(0,0,0,0.95)] ring-1 ring-white/35 backdrop-blur-md transition hover:scale-105 hover:bg-white/24"
        aria-label={playing ? labels.pause : labels.play}
      >
        {playing ? <Pause className="h-7 w-7 fill-current" /> : <Play className="ml-0.5 h-7 w-7 fill-current" />}
      </button>

      <div className="absolute inset-x-0 bottom-0 z-30 p-3 sm:p-4">
        {hasViewMoreHref ? (
          <div className="mb-2 flex justify-end">
            <Link href={viewMoreHref || '#'} className="rounded-full bg-black/44 px-2.5 py-1 text-[10px] font-bold text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-black/60">
              {labels.viewMore}
            </Link>
          </div>
        ) : null}

        <div className="mb-3">
          <h3 className="line-clamp-2 text-[15px] font-black leading-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.65)] sm:text-base">
            {title}
          </h3>
          {showBottomSummary && summary ? (
            <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-white/72 drop-shadow-[0_2px_10px_rgba(0,0,0,0.55)]">
              {summary}
            </p>
          ) : null}
        </div>

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
          className="h-1 w-full cursor-pointer accent-newsPulse-blue"
          aria-label="Video progress"
        />

        <div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-bold text-white/86">
          <span className="tabular-nums">{formatTime(currentTime)} / {formatTime(duration)}</span>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => seekBy(-5)} className="grid h-8 w-8 place-items-center rounded-full bg-white/12 text-white ring-1 ring-white/12 transition hover:bg-white/18" aria-label={labels.rewind}>
              <RotateCcw className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => seekBy(5)} className="grid h-8 w-8 place-items-center rounded-full bg-white/12 text-white ring-1 ring-white/12 transition hover:bg-white/18" aria-label={labels.forward}>
              <RotateCw className="h-4 w-4" />
            </button>
            <button type="button" onClick={toggleMute} className="grid h-8 w-8 place-items-center rounded-full bg-white/12 text-white ring-1 ring-white/12 transition hover:bg-white/18" aria-label={muted ? labels.unmute : labels.mute}>
              {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <button type="button" onClick={cycleSpeed} className="h-8 rounded-full bg-white/12 px-2.5 text-[11px] font-black text-white ring-1 ring-white/12 transition hover:bg-white/18" aria-label={labels.speed}>
              {playbackRate}x
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
