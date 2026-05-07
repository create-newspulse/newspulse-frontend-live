import type { GetServerSideProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import React from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Copy, Play, Share2 } from 'lucide-react';

import NewsPulseVideoPlayer, { getViralVideoUiLabels } from '../../components/viral-videos/NewsPulseVideoPlayer';
import { COVER_PLACEHOLDER_SRC } from '../../lib/coverImages';
import { fetchServerPublicFounderToggles } from '../../lib/publicFounderToggles';
import { getPublicViralVideoPosterUrl, getPublicViralVideoXEmbedUrl, normalizePublicViralVideo, normalizePublicViralVideosPayload, resolvePublicViralVideoPlayback, type PublicViralVideo } from '../../lib/publicViralVideos';
import { useI18n } from '../../src/i18n/LanguageProvider';

type Props = {
  messages: any;
  locale: string;
  initialVideo: PublicViralVideo | null;
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
    <div className="pointer-events-none flex min-w-0 flex-1 items-start justify-between gap-3">
      <span className="rounded-full bg-[#2563EB] px-3 py-1 text-xs font-black uppercase tracking-[0.18em] leading-none text-white shadow-[0_10px_24px_rgba(37,99,235,0.35)]">Viral</span>
      <span className="ml-auto truncate pt-1 text-xs font-black uppercase tracking-[0.18em] leading-none text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.55)]">
        News Pulse
      </span>
    </div>
  );
}

function ReadNewsAction({ href, label }: { href: string; label: string }) {
  if (!href) return null;
  if (/^https?:\/\//i.test(href)) {
    return <a href={href} target="_blank" rel="noopener noreferrer" className="rounded-full bg-white/96 px-3 py-1.5 text-[10px] font-black text-slate-950 shadow-lg transition hover:bg-white">{label}</a>;
  }
  return <Link href={href} className="rounded-full bg-white/96 px-3 py-1.5 text-[10px] font-black text-slate-950 shadow-lg transition hover:bg-white">{label}</Link>;
}

function NativeShareButton({ label, onShare }: { label: string; onShare: () => void }) {
  return (
    <button type="button" onClick={onShare} className="group flex w-16 flex-col items-center gap-1.5 text-center text-[10px] font-bold text-white/78 transition hover:text-white md:hidden" aria-label={label}>
      <span className="grid h-12 w-12 place-items-center rounded-full bg-black text-white shadow-[0_16px_30px_-20px_rgba(0,0,0,0.95)] transition group-hover:bg-neutral-900">
        <Share2 className="h-5 w-5" />
      </span>
      <span>{label}</span>
    </button>
  );
}

function pickViralVideoNewsLine(video: PublicViralVideo | null | undefined): string {
  const raw = video?.raw || {};
  const compactValue = [raw.newsLine, raw.caption, raw.video?.newsLine, raw.video?.caption]
    .map((value) => String(value || '').replace(/\s+/g, ' ').trim())
    .find(Boolean);

  if (compactValue) return compactValue;

  const summaryValue = [video?.summary, raw.summary, raw.video?.summary]
    .map((value) => String(value || '').replace(/\s+/g, ' ').trim())
    .find(Boolean);
  const titleValue = String(video?.title || '').replace(/\s+/g, ' ').trim();
  const selected = summaryValue || titleValue;

  if (!selected) return '';
  if (!summaryValue || selected.length <= 160) return selected;

  const cutoff = selected.slice(0, 160);
  const punctuationIndex = Math.max(cutoff.lastIndexOf('. '), cutoff.lastIndexOf('; '), cutoff.lastIndexOf(', '), cutoff.lastIndexOf(': '));
  if (punctuationIndex >= 90) return cutoff.slice(0, punctuationIndex + 1).trim();

  const lastSpace = cutoff.lastIndexOf(' ');
  return `${(lastSpace >= 120 ? cutoff.slice(0, lastSpace) : cutoff).trimEnd()}...`;
}

function splitViralVideoNewsLine(value: string): { accent: string; rest: string } {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  if (!text) return { accent: '', rest: '' };

  const colonIndex = text.indexOf(':');
  if (colonIndex > 0 && colonIndex <= 80) {
    const accent = text.slice(0, colonIndex + 1).trim();
    const rest = text.slice(colonIndex + 1).trim();
    return { accent, rest };
  }

  const words = text.split(' ').filter(Boolean);
  const accentCount = Math.min(7, Math.max(5, Math.min(7, words.length - 1)));
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

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function normalizeSinglePayload(raw: unknown): PublicViralVideo | null {
  if (isRecord(raw)) {
    const candidate = raw.item || raw.video || (isRecord(raw.data) ? raw.data.item || raw.data.video : null);
    const video = normalizePublicViralVideo(candidate || raw);
    if (video) return video;
  }
  return normalizePublicViralVideo(raw);
}

async function fetchServerViralVideoBySlug(slug: string, requestOrigin: string): Promise<PublicViralVideo | null> {
  if (!slug || !requestOrigin) return null;

  try {
    const upstream = await fetch(`${requestOrigin}/api/public/viral-videos/${encodeURIComponent(slug)}`, {
      method: 'GET',
      headers: { Accept: 'application/json', 'Cache-Control': 'no-store', Pragma: 'no-cache' },
      cache: 'no-store',
    });
    const json = await upstream.json().catch(() => null);
    const item = normalizeSinglePayload(json);
    if (upstream.ok && item) return item;
  } catch {
    // Fall back to client-side hydration if the local API cannot be reached during SSR.
  }

  return null;
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
  const rawSlug = Array.isArray(ctx.params?.slug) ? ctx.params?.slug[0] : ctx.params?.slug;
  const forwardedProto = String(ctx.req.headers['x-forwarded-proto'] || '').split(',')[0].trim();
  const protocol = forwardedProto || (ctx.req.socket && 'encrypted' in ctx.req.socket && (ctx.req.socket as any).encrypted ? 'https' : 'http');
  const host = String(ctx.req.headers.host || '').trim();
  const requestOrigin = host ? `${protocol}://${host}` : '';
  const initialVideo = await fetchServerViralVideoBySlug(String(rawSlug || '').trim(), requestOrigin);

  return {
    props: {
      messages,
      locale,
      initialVideo,
    },
  };
};

export default function ViralVideoDetailPage({ initialVideo }: Props) {
  const router = useRouter();
  const { t } = useI18n();
  const [video, setVideo] = React.useState<PublicViralVideo | null>(initialVideo);
  const [related, setRelated] = React.useState<PublicViralVideo[]>([]);
  const [loaded, setLoaded] = React.useState(Boolean(initialVideo));
  const [error, setError] = React.useState<string | null>(initialVideo ? null : null);
  const [playing, setPlaying] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [canNativeShare, setCanNativeShare] = React.useState(false);
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

  React.useEffect(() => {
    if (!copied) return;
    const timerId = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timerId);
  }, [copied]);

  React.useEffect(() => {
    if (typeof window === 'undefined' || typeof navigator === 'undefined') return;
    const coarsePointer = window.matchMedia?.('(pointer: coarse)')?.matches;
    const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
    setCanNativeShare(typeof navigator.share === 'function' && Boolean(coarsePointer || mobileUa));
  }, []);

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
  const showNewsLine = Boolean(newsLine);
  const debugSlug = Array.isArray(router.query.slug) ? router.query.slug[0] : router.query.slug;
  const shareUrl = typeof window === 'undefined' ? '' : window.location.href;
  const facebookShareHref = shareUrl ? `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}` : '#';
  const xShareHref = shareUrl && video ? `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(video.title)}` : '#';
  const metaDescription = String(video?.summary || newsLine || video?.title || title || '').trim();
  const siteUrl = String(process.env.NEXT_PUBLIC_SITE_URL || '').trim().replace(/\/+$/, '');
  const canonicalPath = String((router.asPath || '').split('?')[0] || '');
  const canonicalUrl = siteUrl && canonicalPath ? `${siteUrl}${canonicalPath}` : '';
  const ogImage = React.useMemo(() => {
    const value = getPublicViralVideoPosterUrl(video) || '';
    if (!value) return '';
    if (/^https?:\/\//i.test(value)) return value;
    return siteUrl ? `${siteUrl}${value.startsWith('/') ? value : `/${value}`}` : value;
  }, [siteUrl, video]);

  const copyShareUrl = React.useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }, [shareUrl]);

  const nativeShare = React.useCallback(async () => {
    if (!shareUrl || !video || !canNativeShare || typeof navigator === 'undefined' || typeof navigator.share !== 'function') return;
    try {
      await navigator.share({
        title: video.title,
        text: video.title,
        url: shareUrl,
      });
    } catch {
      // Ignore dismissed native share sheets.
    }
  }, [canNativeShare, shareUrl, video]);

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
        {metaDescription ? <meta name="description" content={metaDescription} /> : null}
        <meta property="og:type" content="video.other" />
        <meta property="og:title" content={`${video?.title || title} | ${t('brand.name')}`} />
        {metaDescription ? <meta property="og:description" content={metaDescription} /> : null}
        {ogImage ? <meta property="og:image" content={ogImage} /> : null}
        {canonicalUrl ? <link rel="canonical" href={canonicalUrl} /> : null}
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
                          hasNextVideo={Boolean(nextVideo)}
                          onAdvanceToNext={nextVideo ? () => { router.push(detailHref(nextVideo)); } : undefined}
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
                          <div className="absolute inset-x-[18px] top-4 z-30 flex items-start justify-between gap-3">
                            <PlayerTopOverlay />
                            {relatedNewsHref ? <div className="pointer-events-auto ml-2 shrink-0"><ReadNewsAction href={relatedNewsHref} label={reelLabels.readNews} /></div> : null}
                          </div>
                        </>
                      ) : xEmbedUrl ? (
                        <>
                          <XEmbedPlayer key={xEmbedUrl} tweetUrl={xEmbedUrl} posterSrc={posterSrc} title={video.title} slug={String(debugSlug || video.slug || video.id || '')} />
                          <div className="absolute inset-x-[18px] top-4 z-30 flex items-start justify-between gap-3">
                            <PlayerTopOverlay />
                            {relatedNewsHref ? <div className="pointer-events-auto ml-2 shrink-0"><ReadNewsAction href={relatedNewsHref} label={reelLabels.readNews} /></div> : null}
                          </div>
                        </>
                      ) : (
                        <>
                          <img src={posterSrc} alt={video.title} className="h-full w-full object-cover" loading="eager" decoding="async" onError={handlePosterError} />
                          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(2,6,23,0.46)_0%,rgba(2,6,23,0.05)_42%,rgba(2,6,23,0.78)_100%)]" />
                          <div className="absolute inset-x-[18px] top-4 z-30 flex items-start justify-between gap-3">
                            <PlayerTopOverlay />
                            {relatedNewsHref ? <div className="pointer-events-auto ml-2 shrink-0"><ReadNewsAction href={relatedNewsHref} label={reelLabels.readNews} /></div> : null}
                          </div>
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

                </div>

                <aside className="mt-5 flex justify-center gap-4 md:absolute md:left-[calc(50%+270px)] md:top-1/2 md:mt-0 md:-translate-y-1/2 md:flex-col md:items-center md:gap-4">
                  {canNativeShare ? <NativeShareButton label="Share" onShare={nativeShare} /> : null}
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

                {copied ? (
                  <div className="pointer-events-none fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-full bg-black/84 px-4 py-2 text-sm font-black text-white shadow-2xl ring-1 ring-white/12 backdrop-blur-md">
                    Link copied
                  </div>
                ) : null}

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

              {showNewsLine ? (
                <div className="mt-4 w-full overflow-hidden text-center">
                  <p className="mx-auto w-[min(92vw,980px)] max-w-[980px] overflow-hidden text-center text-[clamp(16px,1.25vw,19px)] font-extrabold leading-[1.38] text-white [overflow-wrap:normal] [word-break:normal] line-clamp-2">
                    {styledNewsLine.accent && styledNewsLine.rest ? <span className="text-orange-500">{styledNewsLine.accent}</span> : null}
                    {!styledNewsLine.rest && styledNewsLine.accent ? <span className="text-white">{styledNewsLine.accent}</span> : null}
                    {styledNewsLine.rest ? <span> {styledNewsLine.rest}</span> : null}
                  </p>
                </div>
              ) : null}
            </section>
          )}
        </div>
      </main>
    </>
  );
}