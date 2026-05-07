import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Copy, Play, Share2 } from 'lucide-react';

import NewsPulseVideoPlayer, { getViralVideoUiLabels } from '../../components/viral-videos/NewsPulseVideoPlayer';
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

function PlayerTopOverlay() {
  return (
    <div className="pointer-events-none absolute inset-x-[18px] top-4 z-30 flex items-center justify-between gap-3">
      <span className="text-sm font-extrabold leading-none text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]">Viral</span>
      <span className="ml-auto truncate text-sm font-extrabold leading-none text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]">News Pulse</span>
    </div>
  );
}

function pickViralVideoNewsLine(video: PublicViralVideo | null | undefined): string {
  const raw = video?.raw || {};
  const candidates = [
    raw.newsLine,
    raw.caption,
    raw.shortCaption,
    raw.video?.newsLine,
    raw.video?.caption,
    video?.summary,
    video?.title,
  ];

  for (const candidate of candidates) {
    const text = String(candidate || '').replace(/\s+/g, ' ').trim();
    if (text) return text;
  }
  return '';
}

function splitViralVideoNewsLine(value: string): { accent: string; rest: string } {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return { accent: '', rest: '' };

  const separatorMatch = text.match(/^(.{8,90}?)([-:.,]|\s(?:has|have|is|are|was|were|in)\s)/i);
  if (separatorMatch?.index === 0 && separatorMatch[1]) {
    const accent = separatorMatch[1].trim();
    const rest = text.slice(accent.length).replace(/^\s*[-:.,]?\s*/, '').trim();
    return { accent, rest };
  }

  const words = text.split(' ').filter(Boolean);
  const accentCount = Math.min(4, Math.max(1, Math.ceil(words.length / 3)));
  return {
    accent: words.slice(0, accentCount).join(' '),
    rest: words.slice(accentCount).join(' '),
  };
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
  const routeLocale = String(router.asPath || '').toLowerCase().startsWith('/gu') ? 'gu' : String(router.asPath || '').toLowerCase().startsWith('/hi') ? 'hi' : router.locale;
  const reelLabels = getViralVideoUiLabels(routeLocale);

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
  const relatedNewsHref = video?.relatedNewsUrl || '';
  const newsLine = React.useMemo(() => pickViralVideoNewsLine(video), [video]);
  const styledNewsLine = React.useMemo(() => splitViralVideoNewsLine(newsLine), [newsLine]);
  const showNewsLine = Boolean(newsLine && newsLine.toLowerCase() !== String(video?.title || '').trim().toLowerCase());
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

      <main className="relative min-h-screen overflow-hidden bg-[#111214] text-white">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.035)_0%,rgba(255,255,255,0)_22%,rgba(0,0,0,0.28)_100%)]" />
        <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-8 pt-4 sm:px-6 sm:pt-5 lg:px-8">

          {!loaded ? (
            <div className="grid flex-1 place-items-center py-16 text-sm font-semibold text-white/60">Loading video...</div>
          ) : error || !video ? (
            <div className="mx-auto mt-10 w-full max-w-2xl rounded-lg border border-white/12 bg-white/8 p-6 text-center">
              <div className="text-lg font-black">{error || 'Video not found.'}</div>
              <Link href="/viral-videos" className="mt-5 inline-flex rounded-full bg-white px-4 py-2 text-sm font-black text-slate-950">Back to Viral Videos</Link>
            </div>
          ) : (
            <section className="relative flex flex-1 flex-col items-center justify-start pt-0 sm:pt-2">
              <div className="relative flex w-full justify-center lg:min-h-[calc(100vh-5.5rem)]">
                <div className="mx-auto min-w-0" style={{ width: 'min(100%, clamp(360px, calc(82vh * 9 / 16), 460px))' }}>
                  <div className="relative overflow-hidden rounded-[22px] border border-white/14 bg-black shadow-[0_42px_96px_-48px_rgba(0,0,0,0.98)]">
                    <div className="relative aspect-[9/16] w-full overflow-hidden bg-slate-950" style={{ aspectRatio: '9 / 16' }}>
                      {playback.mode === 'direct' ? (
                        <NewsPulseVideoPlayer
                          key={video.id}
                          src={playback.directUrl}
                          posterSrc={posterSrc}
                          title={video.title}
                          summary={video.summary}
                          readNewsHref={relatedNewsHref}
                          labels={reelLabels}
                          autoPlay={playing}
                          showBottomTitle={false}
                          compactReelControls
                          minHeightClassName="min-h-full"
                        />
                      ) : playback.mode === 'youtube' ? (
                        <>
                          <iframe
                            title={video.title}
                            src={playback.embedUrl}
                            className="h-full w-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                          />
                          <PlayerTopOverlay />
                        </>
                      ) : xEmbedUrl ? (
                        <>
                          <XEmbedPlayer key={xEmbedUrl} tweetUrl={xEmbedUrl} posterSrc={posterSrc} title={video.title} slug={String(debugSlug || video.slug || video.id || '')} />
                          <PlayerTopOverlay />
                        </>
                      ) : (
                        <>
                          <img src={posterSrc} alt={video.title} className="h-full w-full object-cover" loading="eager" decoding="async" onError={handlePosterError} />
                          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.46)_0%,rgba(2,6,23,0.05)_42%,rgba(2,6,23,0.78)_100%)]" />
                          <PlayerTopOverlay />
                          {playback.mode === 'unavailable' ? (
                            <div className="absolute inset-x-5 top-1/2 -translate-y-1/2 rounded-lg bg-black/54 p-4 text-center text-sm font-bold text-white shadow-xl ring-1 ring-white/15 backdrop-blur">Video source unavailable</div>
                          ) : playback.mode === 'external' ? null : (
                            <button
                              type="button"
                              onClick={playVideo}
                              className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/18 text-white shadow-[0_22px_42px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/35 backdrop-blur-md transition hover:scale-105 hover:bg-white/24"
                              aria-label={`Play ${video.title}`}
                            >
                              <Play className="ml-0.5 h-7 w-7 fill-current" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 rounded-full border border-white/10 bg-white/6 px-2 py-2 text-white shadow-[0_18px_38px_-30px_rgba(0,0,0,0.9)] backdrop-blur md:hidden">
                    {previousVideo ? (
                      <Link href={detailHref(previousVideo)} className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-bold transition hover:bg-white/10" aria-label="Previous video">
                        <ArrowLeft className="h-4 w-4" />
                        Previous
                      </Link>
                    ) : <span className="min-h-10 px-3" />}
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-white/58">{currentIndex >= 0 ? currentIndex + 1 : 1} / {Math.max(related.length, 1)}</div>
                    {nextVideo ? (
                      <Link href={detailHref(nextVideo)} className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-bold transition hover:bg-white/10" aria-label="Next video">
                        Next
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    ) : <span className="min-h-10 px-3" />}
                  </div>

                  <div className="mt-5 text-center">
                    <h1 className="text-balance text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">
                      {video.title}
                    </h1>
                    {showNewsLine ? (
                      <p className="mx-auto mt-3 line-clamp-2 max-w-[760px] text-balance text-[18px] font-extrabold leading-[1.4] text-white drop-shadow-[0_2px_14px_rgba(0,0,0,0.72)] sm:text-[21px]">
                        {styledNewsLine.accent ? <span className="text-orange-400">{styledNewsLine.accent}</span> : null}
                        {styledNewsLine.rest ? <span> {styledNewsLine.rest}</span> : null}
                      </p>
                    ) : null}
                  </div>
                </div>

                <aside className="mt-5 flex justify-center gap-4 md:absolute md:left-[calc(50%+270px)] md:top-1/2 md:mt-0 md:-translate-y-1/2 md:flex-col md:items-center md:gap-4">
                  <a href={facebookShareHref} target="_blank" rel="noopener noreferrer" className="group flex w-16 flex-col items-center gap-1.5 text-center text-[10px] font-bold text-white/78 transition hover:text-white" aria-label={reelLabels.facebook}>
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-black text-sm font-black text-white shadow-[0_16px_30px_-20px_rgba(0,0,0,0.95)] transition group-hover:bg-neutral-900">f</span>
                    <span>{reelLabels.facebook}</span>
                  </a>
                  <a href={xShareHref} target="_blank" rel="noopener noreferrer" className="group flex w-16 flex-col items-center gap-1.5 text-center text-[10px] font-bold text-white/78 transition hover:text-white" aria-label={reelLabels.x}>
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-black text-sm font-black text-white shadow-[0_16px_30px_-20px_rgba(0,0,0,0.95)] transition group-hover:bg-neutral-900">X</span>
                    <span>{reelLabels.x}</span>
                  </a>
                  <button type="button" onClick={copyShareUrl} className="group flex w-16 flex-col items-center gap-1.5 text-center text-[10px] font-bold text-white/78 transition hover:text-white" aria-label={copied ? reelLabels.copied : reelLabels.copyLink}>
                    <span className="grid h-12 w-12 place-items-center rounded-full bg-black text-white shadow-[0_16px_30px_-20px_rgba(0,0,0,0.95)] transition group-hover:bg-neutral-900">
                      {copied ? <Share2 className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                    </span>
                    <span>{copied ? reelLabels.copied : reelLabels.copyLink}</span>
                  </button>
                </aside>

                <div className="fixed right-5 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-3 md:flex">
                  {previousVideo ? (
                    <Link href={detailHref(previousVideo)} className="grid h-12 w-12 place-items-center rounded-full border border-white/12 bg-white/8 text-white shadow-xl backdrop-blur transition hover:bg-white/14" aria-label="Previous video">
                      <ArrowUp className="h-5 w-5" />
                    </Link>
                  ) : (
                    <button type="button" disabled className="grid h-12 w-12 place-items-center rounded-full border border-white/8 bg-white/4 text-white/28" aria-label="Previous video">
                      <ArrowUp className="h-5 w-5" />
                    </button>
                  )}
                  {nextVideo ? (
                    <Link href={detailHref(nextVideo)} className="grid h-12 w-12 place-items-center rounded-full border border-white/12 bg-white/8 text-white shadow-xl backdrop-blur transition hover:bg-white/14" aria-label="Next video">
                      <ArrowDown className="h-5 w-5" />
                    </Link>
                  ) : (
                    <button type="button" disabled className="grid h-12 w-12 place-items-center rounded-full border border-white/8 bg-white/4 text-white/28" aria-label="Next video">
                      <ArrowDown className="h-5 w-5" />
                    </button>
                  )}
                </div>
              </div>
            </section>
          )}
        </div>
      </main>
    </>
  );
}