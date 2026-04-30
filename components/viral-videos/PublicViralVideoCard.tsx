import React from 'react';
import { ExternalLink, Play } from 'lucide-react';

import type { PublicViralVideo } from '../../lib/publicViralVideos';

type Props = {
  video: PublicViralVideo;
  compact?: boolean;
};

function formatDate(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function DarkVideoFallback({ showIcon = true, title }: { showIcon?: boolean; title: string }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.16),transparent_24%),radial-gradient(circle_at_bottom,rgba(59,130,246,0.18),transparent_30%),linear-gradient(180deg,#172033_0%,#060b16_100%)]">
      {showIcon ? (
        <span className="grid h-14 w-14 place-items-center rounded-full bg-white/18 text-white shadow-[0_18px_36px_-18px_rgba(0,0,0,0.85)] ring-1 ring-white/30 backdrop-blur-md" aria-label={title}>
          <Play className="ml-0.5 h-6 w-6 fill-current" />
        </span>
      ) : null}
    </div>
  );
}

export default function PublicViralVideoCard({ video, compact = false }: Props) {
  const [playing, setPlaying] = React.useState(false);
  const [posterFailed, setPosterFailed] = React.useState(false);
  const [posterLoaded, setPosterLoaded] = React.useState(false);
  const isPlayableEmbed = video.kind === 'youtube' && video.youtubeEmbedUrl;
  const isHtml5Video = video.kind === 'video';
  const isExternalSource = video.kind === 'external' || video.kind === 'unsupported';
  const dateLabel = formatDate(video.publishedAt);
  const canLoadPoster = Boolean(video.thumbnailUrl) && !posterFailed;
  const hasVisiblePoster = canLoadPoster && posterLoaded;
  const openLabel = isExternalSource ? 'Open source preview' : 'Play video';
  const sourcePreviewButtonClass = 'absolute left-1/2 top-[66%] inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-white/92 px-4 py-2 text-sm font-bold text-slate-950 shadow-xl transition hover:bg-white';

  React.useEffect(() => {
    setPosterFailed(false);
    setPosterLoaded(false);
  }, [video.id, video.thumbnailUrl]);

  return (
    <article id={video.slug || video.id} className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <div className={compact ? 'relative aspect-[9/16] overflow-hidden bg-slate-950' : 'relative aspect-video overflow-hidden bg-slate-950'}>
        {isHtml5Video ? (
          <video
            className="h-full w-full object-cover"
            controls
            preload="metadata"
            poster={video.thumbnailUrl || undefined}
            src={video.videoUrl}
          />
        ) : isPlayableEmbed && playing ? (
          <iframe
            title={video.title}
            src={video.youtubeEmbedUrl}
            className="h-full w-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
          />
        ) : (
          <>
            <DarkVideoFallback showIcon={!isPlayableEmbed} title={video.title} />
            {canLoadPoster ? (
              <img
                src={video.thumbnailUrl}
                alt={video.title}
                className={posterLoaded ? 'relative h-full w-full object-cover opacity-100 transition-opacity duration-200' : 'relative h-full w-full object-cover opacity-0'}
                loading="lazy"
                decoding="async"
                onLoad={() => setPosterLoaded(true)}
                onError={() => {
                  setPosterFailed(true);
                  setPosterLoaded(false);
                }}
              />
            ) : null}
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/76 via-slate-950/10 to-slate-950/20" />
            {isPlayableEmbed ? (
              <button
                type="button"
                onClick={() => setPlaying(true)}
                className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/20 text-white shadow-xl ring-1 ring-white/35 backdrop-blur transition hover:scale-105 hover:bg-white/25"
                aria-label={`Play ${video.title}`}
              >
                <Play className="ml-0.5 h-6 w-6 fill-current" />
              </button>
            ) : (
              <>
                {hasVisiblePoster ? (
                  <span className="absolute left-1/2 top-1/2 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/18 text-white shadow-[0_18px_36px_-18px_rgba(0,0,0,0.85)] ring-1 ring-white/30 backdrop-blur-md" aria-hidden="true">
                    <Play className="ml-0.5 h-6 w-6 fill-current" />
                  </span>
                ) : null}
                <a
                  href={video.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={sourcePreviewButtonClass}
                >
                  <ExternalLink className="h-4 w-4" />
                  {openLabel}
                </a>
              </>
            )}
          </>
        )}

        <div className="absolute left-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-white ring-1 ring-white/20 backdrop-blur">
          {video.kind === 'youtube' ? 'YouTube' : 'Video'}
        </div>
      </div>

      <div className={compact ? 'p-3' : 'p-4'}>
        <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
          {video.category ? <span>{video.category}</span> : null}
          {video.language ? <span>{video.language}</span> : null}
          {dateLabel ? <span>{dateLabel}</span> : null}
        </div>
        <h2 className={compact ? 'mt-2 line-clamp-2 text-sm font-black leading-tight text-slate-950' : 'mt-2 line-clamp-2 text-lg font-black leading-tight text-slate-950'}>
          {video.title}
        </h2>
        {video.summary ? (
          <p className={compact ? 'mt-2 line-clamp-2 text-xs leading-5 text-slate-600' : 'mt-2 line-clamp-3 text-sm leading-6 text-slate-600'}>
            {video.summary}
          </p>
        ) : null}
        {isExternalSource ? (
          <a
            href={video.videoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-slate-800 underline decoration-slate-300 underline-offset-4 hover:text-slate-950"
          >
            Open source preview
            <ExternalLink className="h-4 w-4" />
          </a>
        ) : null}
      </div>
    </article>
  );
}
