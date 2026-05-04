import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React from 'react';
import { ArrowLeft, ArrowRight, Copy, ExternalLink, Play, Share2 } from 'lucide-react';

import { COVER_PLACEHOLDER_SRC } from '../../lib/coverImages';
import { fetchServerPublicFounderToggles } from '../../lib/publicFounderToggles';
import { getPublicViralVideoPosterUrl, normalizePublicViralVideosPayload, resolvePublicViralVideoPlayback, type PublicViralVideo } from '../../lib/publicViralVideos';
import { useI18n } from '../../src/i18n/LanguageProvider';

type Props = {
  messages: any;
  locale: string;
};

function detailHref(video: PublicViralVideo): string {
  return `/viral-videos/${encodeURIComponent(video.slug || video.id)}`;
}

function handlePosterError(event: React.SyntheticEvent<HTMLImageElement>) {
  if (process.env.NODE_ENV === 'development') {
    // eslint-disable-next-line no-console
    console.debug('[ViralVideosPage] poster failed to load:', event.currentTarget.src);
  }
  if (event.currentTarget.src.endsWith(COVER_PLACEHOLDER_SRC)) return;
  event.currentTarget.src = COVER_PLACEHOLDER_SRC;
}

export const getServerSideProps: GetServerSideProps<Props> = async (ctx) => {
  const featureToggles = await fetchServerPublicFounderToggles();

  if (featureToggles.viralVideosFrontendEnabled === false) {
    return {
      redirect: {
        destination: '/',
        permanent: false,
      },
    };
  }

  const locale = (ctx.locale || 'en') as string;
  const { getMessages } = await import('../../lib/getMessages');
  const messages = await getMessages(locale);

  return {
    props: {
      messages,
      locale,
    },
  };
};

export default function ViralVideosPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [items, setItems] = React.useState<PublicViralVideo[]>([]);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [playingId, setPlayingId] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const debugEnabled = process.env.NODE_ENV === 'development';
  const title = t('categories.viralVideos') || 'Viral Videos';
  const activeVideo = items[activeIndex] || null;
  const canGoPrevious = items.length > 1;
  const canGoNext = items.length > 1;

  React.useEffect(() => {
    const controller = new AbortController();
    const lang = String(router.locale || 'en').toLowerCase();
    setLoaded(false);
    setError(null);

    (async () => {
      const fetchViralVideos = async (apiUrl: string) => {
        if (debugEnabled) {
          // eslint-disable-next-line no-console
          console.debug('[ViralVideosPage] API URL called:', apiUrl);
        }

        const response = await fetch(apiUrl, {
          method: 'GET',
          headers: { Accept: 'application/json' },
          cache: 'no-store',
          signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);
        const normalized = normalizePublicViralVideosPayload(payload);

        if (debugEnabled) {
          // eslint-disable-next-line no-console
          console.debug('[ViralVideosPage] response status:', response.status);
          // eslint-disable-next-line no-console
          console.debug('[ViralVideosPage] videos received:', normalized.items.length);
        }

        return { response, normalized };
      };

      const params = new URLSearchParams();
      params.set('lang', lang);
      params.set('limit', '20');
      const apiUrl = `/api/public/viral-videos?${params.toString()}`;
      let { response, normalized } = await fetchViralVideos(apiUrl);
      if (controller.signal.aborted) return;

      if (!response.ok) {
        setItems([]);
        setError(t('errors.fetchFailed'));
        setLoaded(true);
        if (debugEnabled) {
          // eslint-disable-next-line no-console
          console.debug('[ViralVideosPage] empty state reason:', `response not ok (${response.status})`);
        }
        return;
      }

      if (normalized.settings.frontendEnabled !== false && normalized.items.length === 0) {
        const fallbackUrl = '/api/public/viral-videos?limit=20';
        const fallback = await fetchViralVideos(fallbackUrl);
        if (controller.signal.aborted) return;
        if (fallback.response.ok && fallback.normalized.settings.frontendEnabled !== false && fallback.normalized.items.length > 0) {
          response = fallback.response;
          normalized = fallback.normalized;
        }
      }

      const nextItems = normalized.settings.frontendEnabled === false ? [] : normalized.items;
      setItems(nextItems);
      setActiveIndex(0);
      setPlayingId(null);
      setLoaded(true);
      if (debugEnabled && nextItems.length === 0) {
        // eslint-disable-next-line no-console
        console.debug(
          '[ViralVideosPage] empty state reason:',
          normalized.settings.frontendEnabled === false ? 'global frontend disabled' : 'public API returned zero videos'
        );
      }
    })().catch(() => {
      if (controller.signal.aborted) return;
      setItems([]);
      setError(t('errors.fetchFailed'));
      setLoaded(true);
      if (debugEnabled) {
        // eslint-disable-next-line no-console
        console.debug('[ViralVideosPage] empty state reason:', 'fetch failed');
      }
    });

    return () => controller.abort();
  }, [debugEnabled, router.locale, t]);

  React.useEffect(() => {
    setCopied(false);
  }, [activeVideo?.id]);

  const goPrevious = React.useCallback(() => {
    if (!items.length) return;
    setActiveIndex((value) => (value - 1 + items.length) % items.length);
    setPlayingId(null);
  }, [items.length]);

  const goNext = React.useCallback(() => {
    if (!items.length) return;
    setActiveIndex((value) => (value + 1) % items.length);
    setPlayingId(null);
  }, [items.length]);

  const shareUrl = React.useMemo(() => {
    if (typeof window === 'undefined') return '';
    return activeVideo ? `${window.location.origin}${detailHref(activeVideo)}` : `${window.location.origin}/viral-videos`;
  }, [activeVideo?.id, activeVideo?.slug]);

  const shareText = activeVideo?.title || title;
  const facebookShareHref = shareUrl ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}` : '#';
  const xShareHref = shareUrl ? `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}` : '#';

  const copyShareUrl = React.useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }, [shareUrl]);

  const playActiveVideo = React.useCallback(() => {
    if (!activeVideo) return;
    const playback = resolvePublicViralVideoPlayback(activeVideo);
    if (playback.mode === 'external') return;
    if (playback.mode === 'unavailable') return;
    setPlayingId(activeVideo.id);
  }, [activeVideo]);

  const posterSrc = getPublicViralVideoPosterUrl(activeVideo) || COVER_PLACEHOLDER_SRC;
  const activePlayback = React.useMemo(() => resolvePublicViralVideoPlayback(activeVideo), [activeVideo]);
  const isPlayingActive = Boolean(activeVideo && playingId === activeVideo.id);

  React.useEffect(() => {
    if (!debugEnabled || !activeVideo) return;
    // eslint-disable-next-line no-console
    console.debug('[ViralVideosPage] selected player videoUrl:', activeVideo.videoUrl || '');
    // eslint-disable-next-line no-console
    console.debug('[ViralVideosPage] resolved embed/direct URL:', activePlayback.embedUrl || activePlayback.directUrl || activePlayback.externalUrl || '');
  }, [activePlayback.directUrl, activePlayback.embedUrl, activePlayback.externalUrl, activeVideo, debugEnabled]);

  return (
    <>
      <Head>
        <title>{`${title} | ${t('brand.name')}`}</title>
      </Head>

      <main className="min-h-screen overflow-hidden bg-[#07090f] text-white">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(220,38,38,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.16),transparent_32%)]" />
        <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
          <header className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
            <Link href="/" className="group inline-flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-red-600 text-base font-black shadow-[0_18px_36px_-18px_rgba(220,38,38,0.9)]">NP</span>
              <span className="min-w-0">
                <span className="block truncate text-lg font-black tracking-tight">News Pulse</span>
                <span className="block truncate text-xs font-semibold uppercase tracking-[0.18em] text-white/48">Short Video Desk</span>
              </span>
            </Link>
            <Link
              href="/"
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-bold text-white shadow-lg transition hover:bg-white/14"
            >
              View News
              <ExternalLink className="h-4 w-4" />
            </Link>
          </header>

          {error ? (
            <div className="mx-auto mt-10 w-full max-w-2xl rounded-lg border border-white/12 bg-white/8 p-5 text-white">
              <div className="text-base font-bold">{t('categoryPage.unableToLoadTitle')}</div>
              <div className="mt-1 text-sm text-white/70">{error}</div>
            </div>
          ) : loaded && items.length === 0 ? (
            <div className="mx-auto mt-10 w-full max-w-2xl rounded-lg border border-white/12 bg-white/8 p-6 text-center">
              <div className="text-lg font-black">No viral videos yet.</div>
              <div className="mt-2 text-sm text-white/62">Published short videos will appear here.</div>
            </div>
          ) : !loaded ? (
            <div className="grid flex-1 place-items-center py-16 text-sm font-semibold text-white/60">Loading short videos...</div>
          ) : activeVideo ? (
            <section className="grid flex-1 items-center gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_88px]">
              <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(180px,260px)_minmax(280px,420px)_minmax(180px,1fr)] lg:items-center">
                <aside className="hidden max-h-[74vh] overflow-y-auto pr-2 lg:block">
                  <div className="grid gap-3">
                    {items.map((video, index) => (
                      <Link
                        key={video.id}
                        href={detailHref(video)}
                        className={`group flex items-center gap-3 rounded-lg border p-2 text-left transition ${index === activeIndex ? 'border-red-400/70 bg-red-500/14' : 'border-white/10 bg-white/6 hover:bg-white/10'}`}
                      >
                        <span className="relative h-20 w-14 shrink-0 overflow-hidden rounded-md bg-slate-900">
                          <img src={getPublicViralVideoPosterUrl(video) || COVER_PLACEHOLDER_SRC} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" onError={handlePosterError} />
                          <span className="absolute inset-0 grid place-items-center bg-black/20 text-white">
                            <Play className="h-4 w-4 fill-current" />
                          </span>
                        </span>
                        <span className="min-w-0">
                          <span className="line-clamp-2 text-sm font-bold leading-snug text-white">{video.title}</span>
                          <span className="mt-1 block text-xs font-semibold uppercase tracking-[0.12em] text-white/42">Video</span>
                        </span>
                      </Link>
                    ))}
                  </div>
                </aside>

                <div className="mx-auto w-full max-w-[420px]">
                  <div className="relative overflow-hidden rounded-[22px] border border-white/14 bg-black shadow-[0_40px_90px_-46px_rgba(0,0,0,0.95)]">
                    <div className="relative aspect-[9/16] w-full overflow-hidden bg-slate-950">
                      {activePlayback.mode === 'direct' && isPlayingActive ? (
                        <video className="h-full w-full object-cover" src={activePlayback.directUrl} poster={posterSrc} controls autoPlay playsInline />
                      ) : activePlayback.mode === 'youtube' && isPlayingActive ? (
                        <iframe
                          title={activeVideo.title}
                          src={activePlayback.embedUrl}
                          className="h-full w-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      ) : (
                        <>
                          <img src={posterSrc} alt={activeVideo.title} className="h-full w-full object-cover" loading="eager" decoding="async" onError={handlePosterError} />
                          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.28)_0%,rgba(2,6,23,0.04)_42%,rgba(2,6,23,0.76)_100%)]" />
                          {activePlayback.mode === 'unavailable' ? (
                            <div className="absolute inset-x-5 top-1/2 -translate-y-1/2 rounded-lg bg-black/54 p-4 text-center text-sm font-bold text-white shadow-xl ring-1 ring-white/15 backdrop-blur">Video source unavailable</div>
                          ) : activePlayback.mode === 'external' ? (
                            <a
                              href={activePlayback.externalUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950 shadow-xl transition hover:bg-white/90"
                            >
                              Open Source
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          ) : (
                            <button
                              type="button"
                              onClick={playActiveVideo}
                              className="absolute left-1/2 top-1/2 grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/18 text-white shadow-[0_22px_42px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/35 backdrop-blur-md transition hover:scale-105 hover:bg-white/24"
                              aria-label={`Play ${activeVideo.title}`}
                            >
                              <Play className="ml-1 h-9 w-9 fill-current" />
                            </button>
                          )}
                        </>
                      )}
                      <div className="absolute left-4 top-4 rounded-full bg-red-600 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-white shadow-lg">Video</div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={goPrevious}
                      disabled={!canGoPrevious}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/8 text-white transition hover:bg-white/14 disabled:opacity-35"
                      aria-label="Previous video"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </button>
                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-white/44">{activeIndex + 1} / {items.length}</div>
                    <button
                      type="button"
                      onClick={goNext}
                      disabled={!canGoNext}
                      className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/8 text-white transition hover:bg-white/14 disabled:opacity-35"
                      aria-label="Next video"
                    >
                      <ArrowRight className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                <div className="mx-auto w-full max-w-xl lg:mx-0">
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-red-300">News Pulse Video</div>
                  <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl">{activeVideo.title}</h1>
                  {activeVideo.summary ? <p className="mt-4 text-base leading-7 text-white/68">{activeVideo.summary}</p> : null}
                  <div className="mt-5 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-white/44">
                    {activeVideo.category ? <span>{activeVideo.category}</span> : null}
                    {activeVideo.language ? <span>{activeVideo.language}</span> : null}
                  </div>
                  {activePlayback.mode === 'external' && activePlayback.externalUrl ? (
                    <a
                      href={activePlayback.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-white/90"
                    >
                      Open Source
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  ) : null}
                </div>
              </div>

              <aside className="flex justify-center gap-3 lg:flex-col lg:items-center">
                <a
                  href={facebookShareHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="grid h-12 w-12 place-items-center rounded-full border border-white/12 bg-white/8 text-sm font-black text-white transition hover:bg-white/14"
                  aria-label="Share on Facebook"
                >
                  f
                </a>
                <a
                  href={xShareHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="grid h-12 w-12 place-items-center rounded-full border border-white/12 bg-white/8 text-sm font-black text-white transition hover:bg-white/14"
                  aria-label="Share on X or Twitter"
                >
                  X
                </a>
                <button
                  type="button"
                  onClick={copyShareUrl}
                  className="grid h-12 w-12 place-items-center rounded-full border border-white/12 bg-white/8 text-white transition hover:bg-white/14"
                  aria-label="Copy Link"
                >
                  {copied ? <Share2 className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                </button>
              </aside>
            </section>
          ) : (
            <div className="grid flex-1 place-items-center py-16 text-sm font-semibold text-white/60">Loading short videos...</div>
          )}
        </div>
      </main>
    </>
  );
}
