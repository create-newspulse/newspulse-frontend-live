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
    console.debug('[ViralVideosPage] poster failed to load:', event.currentTarget.src);
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

function XEmbedPlayer({ tweetUrl, posterSrc, title }: { tweetUrl: string; posterSrc: string; title: string }) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [embedFailed, setEmbedFailed] = React.useState(false);

  React.useEffect(() => {
    setEmbedFailed(false);
    if (!tweetUrl || typeof window === 'undefined') return;
    let cancelled = false;
    let timerId: number | undefined;
    const scriptId = 'news-pulse-x-widgets';
    const markFailed = () => {
      if (!cancelled) setEmbedFailed(true);
    };
    const loadTweet = () => {
      if (timerId) window.clearTimeout(timerId);
      const twttr = (window as any).twttr;
      if (!containerRef.current || !twttr?.widgets?.load) {
        markFailed();
        return;
      }
      try {
        Promise.resolve(twttr.widgets.load(containerRef.current)).catch(markFailed);
        timerId = window.setTimeout(() => {
          if (!cancelled && containerRef.current && !containerRef.current.querySelector('iframe')) markFailed();
        }, 7000);
      } catch {
        markFailed();
      }
    };

    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existingScript) {
      if ((window as any).twttr?.widgets?.load) loadTweet();
      else existingScript.addEventListener('load', loadTweet, { once: true });
    } else {
      const script = document.createElement('script');
      script.id = scriptId;
      script.src = 'https://platform.twitter.com/widgets.js';
      script.async = true;
      script.charset = 'utf-8';
      script.addEventListener('load', loadTweet, { once: true });
      script.addEventListener('error', markFailed, { once: true });
      document.body.appendChild(script);
    }
    timerId = window.setTimeout(() => {
      if (!(window as any).twttr?.widgets?.load) markFailed();
    }, 7000);

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
  const routeLocale = String(router.asPath || '').toLowerCase().startsWith('/gu') ? 'gu' : String(router.asPath || '').toLowerCase().startsWith('/hi') ? 'hi' : router.locale;
  const reelLabels = getViralVideoUiLabels(routeLocale);
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
  const activeXEmbedUrl = React.useMemo(() => getPublicViralVideoXEmbedUrl(activeVideo), [activeVideo]);
  const relatedNewsHref = activeVideo?.relatedNewsUrl || '';
  const externalSourceHref = !activeXEmbedUrl && activePlayback.mode === 'external' ? activePlayback.externalUrl : '';
  const newsLine = React.useMemo(() => pickViralVideoNewsLine(activeVideo), [activeVideo]);
  const styledNewsLine = React.useMemo(() => splitViralVideoNewsLine(newsLine), [newsLine]);
  const showNewsLine = Boolean(newsLine && newsLine.toLowerCase() !== String(activeVideo?.title || '').trim().toLowerCase());
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

      <main className="relative min-h-screen overflow-hidden bg-[#111214] text-white">
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.035)_0%,rgba(255,255,255,0)_22%,rgba(0,0,0,0.28)_100%)]" />
        <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-8 pt-4 sm:px-6 sm:pt-5 lg:px-8">

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
            <section className="relative flex flex-1 flex-col items-center justify-start pt-0 sm:pt-2">
              <div className="relative flex w-full justify-center lg:min-h-[calc(100vh-5.5rem)]">
                <div className="mx-auto min-w-0" style={{ width: 'min(100%, clamp(360px, calc(82vh * 9 / 16), 460px))' }}>
                  <div className="relative overflow-hidden rounded-[22px] border border-white/14 bg-black shadow-[0_42px_96px_-48px_rgba(0,0,0,0.98)]">
                    <div className="relative aspect-[9/16] w-full overflow-hidden bg-slate-950" style={{ aspectRatio: '9 / 16' }}>
                      {activePlayback.mode === 'direct' ? (
                        <NewsPulseVideoPlayer
                          key={activeVideo.id}
                          src={activePlayback.directUrl}
                          posterSrc={posterSrc}
                          title={activeVideo.title}
                          summary={activeVideo.summary}
                          readNewsHref={relatedNewsHref}
                          labels={reelLabels}
                          autoPlay={isPlayingActive}
                          showBottomTitle={false}
                          compactReelControls
                          minHeightClassName="min-h-full"
                        />
                      ) : activePlayback.mode === 'youtube' ? (
                        <>
                          <iframe
                            title={activeVideo.title}
                            src={activePlayback.embedUrl}
                            className="h-full w-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                          />
                          <PlayerTopOverlay />
                        </>
                      ) : activeXEmbedUrl ? (
                        <>
                          <XEmbedPlayer key={activeXEmbedUrl} tweetUrl={activeXEmbedUrl} posterSrc={posterSrc} title={activeVideo.title} />
                          <PlayerTopOverlay />
                        </>
                      ) : (
                        <>
                          <img src={posterSrc} alt={activeVideo.title} className="h-full w-full object-cover" loading="eager" decoding="async" onError={handlePosterError} />
                          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.46)_0%,rgba(2,6,23,0.05)_42%,rgba(2,6,23,0.78)_100%)]" />
                          <PlayerTopOverlay />
                          {activePlayback.mode === 'unavailable' ? (
                            <div className="absolute inset-x-5 top-1/2 -translate-y-1/2 rounded-lg bg-black/54 p-4 text-center text-sm font-bold text-white shadow-xl ring-1 ring-white/15 backdrop-blur">Video source unavailable</div>
                          ) : activePlayback.mode === 'external' ? (
                            externalSourceHref ? (
                              <a href={externalSourceHref} target="_blank" rel="noopener noreferrer" className="absolute inset-x-6 bottom-6 z-30 inline-flex justify-center rounded-full border border-white/14 bg-white/10 px-4 py-2 text-sm font-bold text-white backdrop-blur transition hover:bg-white/16">
                                Open Source
                              </a>
                            ) : null
                          ) : (
                            <button
                              type="button"
                              onClick={playActiveVideo}
                              className="absolute left-1/2 top-1/2 grid h-16 w-16 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white/18 text-white shadow-[0_22px_42px_-20px_rgba(0,0,0,0.9)] ring-1 ring-white/35 backdrop-blur-md transition hover:scale-105 hover:bg-white/24"
                              aria-label={`Play ${activeVideo.title}`}
                            >
                              <Play className="ml-0.5 h-7 w-7 fill-current" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 rounded-full border border-white/10 bg-white/6 px-2 py-2 text-white shadow-[0_18px_38px_-30px_rgba(0,0,0,0.9)] backdrop-blur md:hidden">
                    <button
                      type="button"
                      onClick={goPrevious}
                      disabled={!canGoPrevious}
                      className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-bold transition hover:bg-white/10 disabled:opacity-35"
                      aria-label="Previous video"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Previous
                    </button>
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-white/58">{activeIndex + 1} / {items.length}</div>
                    <button
                      type="button"
                      onClick={goNext}
                      disabled={!canGoNext}
                      className="inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-bold transition hover:bg-white/10 disabled:opacity-35"
                      aria-label="Next video"
                    >
                      Next
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-5 text-center">
                    <h1 className="text-balance text-2xl font-black leading-tight tracking-tight text-white sm:text-3xl">
                      {activeVideo.title}
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
                  <button type="button" onClick={goPrevious} disabled={!canGoPrevious} className="grid h-12 w-12 place-items-center rounded-full border border-white/12 bg-white/8 text-white shadow-xl backdrop-blur transition hover:bg-white/14 disabled:border-white/8 disabled:bg-white/4 disabled:text-white/28" aria-label="Previous video">
                    <ArrowUp className="h-5 w-5" />
                  </button>
                  <button type="button" onClick={goNext} disabled={!canGoNext} className="grid h-12 w-12 place-items-center rounded-full border border-white/12 bg-white/8 text-white shadow-xl backdrop-blur transition hover:bg-white/14 disabled:border-white/8 disabled:bg-white/4 disabled:text-white/28" aria-label="Next video">
                    <ArrowDown className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </section>
          ) : (
            <div className="grid flex-1 place-items-center py-16 text-sm font-semibold text-white/60">Loading short videos...</div>
          )}
        </div>
      </main>
    </>
  );
}
