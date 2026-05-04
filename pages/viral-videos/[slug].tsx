import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React from 'react';
import { ArrowLeft, ArrowRight, Copy, ExternalLink, Play, Share2 } from 'lucide-react';

import { COVER_PLACEHOLDER_SRC } from '../../lib/coverImages';
import { fetchServerPublicFounderToggles } from '../../lib/publicFounderToggles';
import { getPublicViralVideoPosterUrl, getPublicViralVideoXEmbedUrl, normalizePublicViralVideosPayload, resolvePublicViralVideoPlayback, type PublicViralVideo } from '../../lib/publicViralVideos';
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
    console.debug('[ViralVideoDetailPage] poster failed to load:', event.currentTarget.src);
  }
  if (event.currentTarget.src.endsWith(COVER_PLACEHOLDER_SRC)) return;
  event.currentTarget.src = COVER_PLACEHOLDER_SRC;
}

function XEmbedPlayer({ tweetUrl, posterSrc, title, slug }: { tweetUrl: string; posterSrc: string; title: string; slug: string }) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [embedFailed, setEmbedFailed] = React.useState(false);

  React.useEffect(() => {
    setEmbedFailed(false);
    if (!tweetUrl || typeof window === 'undefined') return;

    let cancelled = false;
    let timerId: number | undefined;
    const scriptId = 'news-pulse-x-widgets';
    const debugEnabled = process.env.NODE_ENV === 'development';

    const logState = (widgetsLoaded: boolean) => {
      if (!debugEnabled) return;
      // eslint-disable-next-line no-console
      console.debug('[ViralVideoDetailPage] X embed state:', {
        slug,
        widgetsJsLoaded: widgetsLoaded,
        twttrAvailable: Boolean((window as any).twttr?.widgets?.load),
        embedContainerRendered: Boolean(containerRef.current),
      });
    };

    const markFailed = () => {
      if (!cancelled) {
        logState(false);
        setEmbedFailed(true);
      }
    };

    const loadTweet = () => {
      if (timerId) window.clearTimeout(timerId);
      const twttr = (window as any).twttr;
      logState(true);
      if (!containerRef.current || !twttr?.widgets?.load) {
        markFailed();
        return;
      }

      try {
        const loadResult = twttr.widgets.load(containerRef.current);
        Promise.resolve(loadResult).catch(markFailed);
        timerId = window.setTimeout(() => {
          if (cancelled || !containerRef.current) return;
          const hasRenderedFrame = Boolean(containerRef.current.querySelector('iframe'));
          if (debugEnabled) {
            // eslint-disable-next-line no-console
            console.debug('[ViralVideoDetailPage] X embed iframe check:', { slug, hasRenderedFrame });
          }
          if (!hasRenderedFrame) setEmbedFailed(true);
        }, 7000);
      } catch {
        markFailed();
      }
    };

    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existingScript) {
      if ((window as any).twttr?.widgets?.load) loadTweet();
      else {
        existingScript.addEventListener('load', loadTweet, { once: true });
        existingScript.addEventListener('error', markFailed, { once: true });
        timerId = window.setTimeout(() => {
          if (!(window as any).twttr?.widgets?.load) markFailed();
        }, 7000);
      }
    } else {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://platform.twitter.com/widgets.js';
      script.async = true;
      script.charset = 'utf-8';
      script.addEventListener('load', loadTweet, { once: true });
      script.addEventListener('error', markFailed, { once: true });
      document.body.appendChild(script);
      timerId = window.setTimeout(() => {
        if (!(window as any).twttr?.widgets?.load) markFailed();
      }, 7000);
    }

    return () => {
      cancelled = true;
      if (timerId) window.clearTimeout(timerId);
      const script = document.getElementById(scriptId);
      script?.removeEventListener('load', loadTweet);
      script?.removeEventListener('error', markFailed);
    };
  }, [tweetUrl]);

  if (embedFailed) {
    return <img src={posterSrc} alt={title} className="h-full w-full object-cover" loading="eager" decoding="async" onError={handlePosterError} />;
  }

  return (
    <div ref={containerRef} className="flex min-h-[520px] w-full items-center justify-center overflow-y-auto bg-black px-3 py-6 text-white">
      <blockquote className="twitter-tweet mx-auto min-h-[360px] w-full max-w-[360px]" data-theme="dark" data-dnt="true" data-conversation="none">
        <a href={tweetUrl}></a>
      </blockquote>
    </div>
  );
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

export default function ViralVideoDetailPage() {
  const router = useRouter();
  const { t } = useI18n();
  const [video, setVideo] = React.useState<PublicViralVideo | null>(null);
  const [related, setRelated] = React.useState<PublicViralVideo[]>([]);
  const [loaded, setLoaded] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [playing, setPlaying] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const title = t('categories.viralVideos') || 'Viral Videos';

  React.useEffect(() => {
    const rawSlug = Array.isArray(router.query.slug) ? router.query.slug[0] : router.query.slug;
    const slug = String(rawSlug || '').trim();
    if (!router.isReady || !slug) return;

    const controller = new AbortController();
    setLoaded(false);
    setError(null);
    setPlaying(false);
    setCopied(false);

    (async () => {
      const response = await fetch(`/api/public/viral-videos/${encodeURIComponent(slug)}`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      });
      const payload = await response.json().catch(() => null);
      if (controller.signal.aborted) return;

      if (!response.ok || !payload?.item) {
        setVideo(null);
        setRelated([]);
        setError('Video not found.');
        setLoaded(true);
        return;
      }

      const currentVideo = payload.item as PublicViralVideo;
      const listResponse = await fetch('/api/public/viral-videos?limit=20', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
      });
      const listPayload = await listResponse.json().catch(() => null);
      if (controller.signal.aborted) return;

      const normalizedList = normalizePublicViralVideosPayload(listPayload);
      const nextRelated = normalizedList.items.some((item) => item.id === currentVideo.id)
        ? normalizedList.items
        : [currentVideo, ...normalizedList.items];

      setVideo(currentVideo);
      setRelated(nextRelated);
      setLoaded(true);
    })().catch(() => {
      if (controller.signal.aborted) return;
      setVideo(null);
      setRelated([]);
      setError(t('errors.fetchFailed'));
      setLoaded(true);
    });

    return () => controller.abort();
  }, [router.isReady, router.query.slug, t]);

  const currentIndex = React.useMemo(() => {
    if (!video) return -1;
    return related.findIndex((item) => item.id === video.id || item.slug === video.slug);
  }, [related, video]);

  const previousVideo = currentIndex >= 0 && related.length > 1 ? related[(currentIndex - 1 + related.length) % related.length] : null;
  const nextVideo = currentIndex >= 0 && related.length > 1 ? related[(currentIndex + 1) % related.length] : null;
  const posterSrc = getPublicViralVideoPosterUrl(video) || COVER_PLACEHOLDER_SRC;
  const playback = React.useMemo(() => resolvePublicViralVideoPlayback(video), [video]);
  const xEmbedUrl = React.useMemo(() => getPublicViralVideoXEmbedUrl(video), [video]);
  const sourcePlayback = React.useMemo(
    () => resolvePublicViralVideoPlayback(video?.sourceUrl ? { playbackMode: 'external', sourceUrl: video.sourceUrl } : null),
    [video?.sourceUrl]
  );
  const sourceHref = xEmbedUrl || (sourcePlayback.mode === 'external' ? sourcePlayback.externalUrl : '');
  const debugSlug = Array.isArray(router.query.slug) ? router.query.slug[0] : router.query.slug;
  const shareUrl = typeof window === 'undefined' ? '' : window.location.href;
  const facebookShareHref = shareUrl ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}` : '#';
  const xShareHref = shareUrl && video ? `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(video.title)}` : '#';

  const copyShareUrl = React.useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }, [shareUrl]);

  const playVideo = React.useCallback(() => {
    if (!video) return;
    const nextPlayback = resolvePublicViralVideoPlayback(video);
    if (nextPlayback.mode === 'external') return;
    if (nextPlayback.mode === 'unavailable') return;
    setPlaying(true);
  }, [video]);

  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'development' || !video) return;
    // eslint-disable-next-line no-console
    console.debug('[ViralVideoDetailPage] playback diagnostics:', {
      slug: String(debugSlug || video.slug || video.id || ''),
      videoUrl: video.videoUrl || '',
      videoType: video.videoType || '',
      playbackMode: video.playbackMode || '',
      isXUrl: Boolean(xEmbedUrl),
    });
  }, [debugSlug, video, xEmbedUrl]);

  return (
    <>
      <Head>
        <title>{`${video?.title || title} | ${t('brand.name')}`}</title>
      </Head>

      <main className="min-h-screen overflow-hidden bg-[#07090f] text-white">
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(220,38,38,0.18),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(14,165,233,0.16),transparent_32%)]" />
        <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-5 sm:px-6 lg:px-8">
          <header className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
            <Link href="/" className="inline-flex min-w-0 items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-red-600 text-base font-black shadow-[0_18px_36px_-18px_rgba(220,38,38,0.9)]">NP</span>
              <span className="min-w-0">
                <span className="block truncate text-lg font-black tracking-tight">News Pulse</span>
                <span className="block truncate text-xs font-semibold uppercase tracking-[0.18em] text-white/48">Short Video Desk</span>
              </span>
            </Link>
            <Link
              href="/viral-videos"
              className="inline-flex shrink-0 items-center gap-2 rounded-full border border-white/12 bg-white/8 px-4 py-2 text-sm font-bold text-white shadow-lg transition hover:bg-white/14"
            >
              Back to Viral Videos
            </Link>
          </header>

          {!loaded ? (
            <div className="grid flex-1 place-items-center py-16 text-sm font-semibold text-white/60">Loading video...</div>
          ) : error || !video ? (
            <div className="mx-auto mt-10 w-full max-w-2xl rounded-lg border border-white/12 bg-white/8 p-6 text-center">
              <div className="text-lg font-black">{error || 'Video not found.'}</div>
              <Link href="/viral-videos" className="mt-5 inline-flex rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950">Back to Viral Videos</Link>
            </div>
          ) : (
            <section className="grid flex-1 items-center gap-6 py-6 lg:grid-cols-[minmax(0,1fr)_88px]">
              <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-[minmax(280px,420px)_minmax(220px,1fr)] lg:items-center">
                <div className="mx-auto w-full max-w-[420px]">
                  <div className="relative overflow-hidden rounded-[22px] border border-white/14 bg-black shadow-[0_40px_90px_-46px_rgba(0,0,0,0.95)]">
                    <div className="relative aspect-[9/16] w-full overflow-hidden bg-slate-950">
                      {playback.mode === 'direct' && playing ? (
                        <video className="h-full w-full object-cover" src={playback.directUrl} poster={posterSrc} controls autoPlay playsInline />
                      ) : playback.mode === 'youtube' && playing ? (
                        <iframe
                          title={video.title}
                          src={playback.embedUrl}
                          className="h-full w-full"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                          allowFullScreen
                        />
                      ) : xEmbedUrl ? (
                        <XEmbedPlayer key={xEmbedUrl} tweetUrl={xEmbedUrl} posterSrc={posterSrc} title={video.title} slug={String(debugSlug || video.slug || video.id || '')} />
                      ) : (
                        <>
                          <img src={posterSrc} alt={video.title} className="h-full w-full object-cover" loading="eager" decoding="async" onError={handlePosterError} />
                          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.28)_0%,rgba(2,6,23,0.04)_42%,rgba(2,6,23,0.76)_100%)]" />
                          {playback.mode === 'unavailable' ? (
                            <div className="absolute inset-x-5 top-1/2 -translate-y-1/2 rounded-lg bg-black/54 p-4 text-center text-sm font-bold text-white shadow-xl ring-1 ring-white/15 backdrop-blur">Video source unavailable</div>
                          ) : playback.mode === 'external' ? (
                            sourceHref ? (
                              <a
                                href={sourceHref}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950 shadow-xl transition hover:bg-white/90"
                              >
                                Open Source
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            ) : null
                          ) : (
                            <button
                              type="button"
                              onClick={playVideo}
                              className="absolute left-1/2 top-1/2 grid h-20 w-20 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/18 text-white shadow-[0_22px_42px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/35 backdrop-blur-md transition hover:scale-105 hover:bg-white/24"
                              aria-label={`Play ${video.title}`}
                            >
                              <Play className="ml-1 h-9 w-9 fill-current" />
                            </button>
                          )}
                        </>
                      )}
                      <div className="absolute left-4 top-4 rounded-full bg-red-600 px-3 py-1 text-[11px] font-black uppercase tracking-[0.16em] text-white shadow-lg">News Pulse Video</div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    {previousVideo ? (
                      <Link href={detailHref(previousVideo)} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/8 text-white transition hover:bg-white/14" aria-label="Previous video">
                        <ArrowLeft className="h-5 w-5" />
                      </Link>
                    ) : <span className="h-11 w-11" />}
                    <div className="text-xs font-bold uppercase tracking-[0.18em] text-white/44">{currentIndex >= 0 ? currentIndex + 1 : 1} / {Math.max(related.length, 1)}</div>
                    {nextVideo ? (
                      <Link href={detailHref(nextVideo)} className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/8 text-white transition hover:bg-white/14" aria-label="Next video">
                        <ArrowRight className="h-5 w-5" />
                      </Link>
                    ) : <span className="h-11 w-11" />}
                  </div>
                </div>

                <div className="mx-auto w-full max-w-xl lg:mx-0">
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-red-300">News Pulse Video</div>
                  <h1 className="mt-3 text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl">{video.title}</h1>
                  {video.summary ? <p className="mt-4 text-base leading-7 text-white/68">{video.summary}</p> : null}
                  <div className="mt-6 flex flex-wrap gap-3">
                    {sourceHref ? (
                      <a href={sourceHref} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-white/90">
                        {xEmbedUrl ? 'Open on X' : playback.mode === 'external' ? 'Open Source' : 'Read News'}
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : null}
                    <Link href="/viral-videos" className="inline-flex rounded-full border border-white/14 bg-white/8 px-4 py-2 text-sm font-bold text-white transition hover:bg-white/14">
                      Back to Viral Videos
                    </Link>
                  </div>
                </div>
              </div>

              <aside className="flex justify-center gap-3 lg:flex-col lg:items-center">
                <a href={facebookShareHref} target="_blank" rel="noopener noreferrer" className="grid h-12 w-12 place-items-center rounded-full border border-white/12 bg-white/8 text-sm font-black text-white transition hover:bg-white/14" aria-label="Share on Facebook">f</a>
                <a href={xShareHref} target="_blank" rel="noopener noreferrer" className="grid h-12 w-12 place-items-center rounded-full border border-white/12 bg-white/8 text-sm font-black text-white transition hover:bg-white/14" aria-label="Share on X or Twitter">X</a>
                <button type="button" onClick={copyShareUrl} className="grid h-12 w-12 place-items-center rounded-full border border-white/12 bg-white/8 text-white transition hover:bg-white/14" aria-label="Copy Link">
                  {copied ? <Share2 className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                </button>
              </aside>
            </section>
          )}
        </div>
      </main>
    </>
  );
}