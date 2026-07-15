import Head from 'next/head';
import Link from 'next/link';
import React from 'react';
import { ChevronLeft, Play, Radio } from 'lucide-react';

import LiveTvOfflineSequence from '../components/LiveTvOfflineSequence';
import { usePublicSettings } from '../src/context/PublicSettingsContext';
import { DEFAULT_NORMALIZED_PUBLIC_SETTINGS } from '../src/lib/publicSettings';
import {
  normalizeLiveTvCurrentSource,
  normalizeLiveTvUpcomingSchedule,
  hasLiveTvOfflineMediaFields,
  getLiveTvDisplayBadgeLabel,
  resolveLiveTvCurrentSourcePresentation,
  resolveLiveTvPresentation,
  type LiveTvCurrentSource,
  type LiveTvScheduleItem,
} from '../src/lib/liveTv';

let warnedMissingCurrentSourceOfflineMediaFields = false;
let loggedCurrentSourceResponse = false;

async function fetchCurrentLiveTvSource(signal: AbortSignal): Promise<LiveTvCurrentSource | null> {
  const res = await fetch('/api/live-tv/current-source', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
    },
    cache: 'no-store',
    signal,
  });

  if (!res.ok) return null;
  const body = await res.json().catch(() => null);
  if (process.env.NODE_ENV === 'development' && body) {
    const source = normalizeLiveTvCurrentSource(body);
    if (!loggedCurrentSourceResponse) {
      loggedCurrentSourceResponse = true;
      console.debug('[LiveTV] current source response', {
        source,
        offlinePosterImageUrl: source?.offlinePosterImageUrl,
        offlineLoopVideoUrl: source?.offlineLoopVideoUrl,
      });
    }
    if (!warnedMissingCurrentSourceOfflineMediaFields && !hasLiveTvOfflineMediaFields(body)) {
      warnedMissingCurrentSourceOfflineMediaFields = true;
      console.warn('Live TV offline media fields missing from API response.');
    }
    return source;
  }
  return normalizeLiveTvCurrentSource(body);
}

async function fetchUpcomingLiveTvSchedule(signal: AbortSignal): Promise<LiveTvScheduleItem[]> {
  const res = await fetch('/api/live-tv/schedule/upcoming', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
    },
    cache: 'no-store',
    signal,
  });

  if (!res.ok) return [];
  const body = await res.json().catch(() => null);
  return normalizeLiveTvUpcomingSchedule(body);
}

export default function LiveTvPage() {
  const { settings } = usePublicSettings();
  const [currentSource, setCurrentSource] = React.useState<LiveTvCurrentSource | null>(null);
  const [scheduleItems, setScheduleItems] = React.useState<LiveTvScheduleItem[]>([]);

  React.useEffect(() => {
    const controller = new AbortController();

    fetchCurrentLiveTvSource(controller.signal)
      .then((source) => {
        if (!controller.signal.aborted) setCurrentSource(source);
      })
      .catch(() => {
        if (!controller.signal.aborted) setCurrentSource(null);
      });

    return () => controller.abort();
  }, []);

  React.useEffect(() => {
    const controller = new AbortController();

    fetchUpcomingLiveTvSchedule(controller.signal)
      .then((items) => {
        if (!controller.signal.aborted) setScheduleItems(items);
      })
      .catch(() => {
        if (!controller.signal.aborted) setScheduleItems([]);
      });

    return () => controller.abort();
  }, []);

  const liveTv = settings?.liveTv ?? DEFAULT_NORMALIZED_PUBLIC_SETTINGS.liveTv;
  const settingsPresentation = resolveLiveTvPresentation(liveTv);
  const presentation = currentSource ? resolveLiveTvCurrentSourcePresentation(currentSource) : settingsPresentation;
  const isEnabled = currentSource ? currentSource.enabled : liveTv.enabled;
  const shouldShowFallbackMedia = !isEnabled || !presentation.playerUrl;
  const offlineLoopVideoUrl = shouldShowFallbackMedia ? presentation.offlineLoopVideoUrl || settingsPresentation.offlineLoopVideoUrl : '';
  const offlinePosterImageUrl = shouldShowFallbackMedia ? presentation.offlinePosterImageUrl || settingsPresentation.offlinePosterImageUrl : '';
  const fallbackVideoUrl = shouldShowFallbackMedia ? presentation.fallbackVideoUrl || settingsPresentation.fallbackVideoUrl : '';
  const fallbackVideoKind = presentation.fallbackVideoUrl ? presentation.fallbackVideoKind : settingsPresentation.fallbackVideoKind;
  const displayBadgeLabel = getLiveTvDisplayBadgeLabel(presentation, { offlineLoopVideoUrl, offlinePosterImageUrl, fallbackVideoUrl });
  const playbackDebugKeyRef = React.useRef('');
  const comingSoonNode = (
    <div className="absolute inset-0 flex items-center justify-center px-5 py-6 text-center sm:px-8 sm:py-8 lg:px-10 lg:py-10">
      <div className="max-w-2xl">
        <div className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-white/80">{presentation.modeLabel}</div>
        {presentation.showScheduleCard ? (
          <>
            <div className="mt-4 text-2xl font-black tracking-tight text-white sm:text-3xl">{presentation.title}</div>
            {presentation.subtitle ? <div className="mt-2 text-sm text-white/72 sm:text-base">{presentation.subtitle}</div> : null}
            {presentation.scheduleLabel ? <div className="mt-2 text-sm text-white/72 sm:text-base">{presentation.scheduleLabel}</div> : null}
          </>
        ) : null}
        <div className="mt-4 text-sm font-semibold text-white/86 sm:text-base">{presentation.message}</div>
      </div>
    </div>
  );
  const fallbackReplayNode = fallbackVideoUrl && fallbackVideoKind === 'iframe' ? (
    <iframe
      title={presentation.title}
      src={fallbackVideoUrl}
      className="absolute inset-0 h-full w-full rounded-[18px] border-0 bg-transparent sm:rounded-[22px] lg:rounded-[24px]"
      allow="autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
    />
  ) : fallbackVideoUrl && fallbackVideoKind === 'video' ? (
    <video
      className="absolute inset-0 h-full w-full rounded-[18px] bg-transparent object-cover sm:rounded-[22px] lg:rounded-[24px]"
      controls
      playsInline
      preload="metadata"
      src={fallbackVideoUrl}
    />
  ) : comingSoonNode;

  React.useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    const playbackMode = presentation.playerUrl ? 'live' : offlinePosterImageUrl ? 'poster' : offlineLoopVideoUrl ? 'video' : fallbackVideoUrl ? 'fallback' : 'fallback';
    const key = `live-tv-page:${playbackMode}:${presentation.playerUrl}:${offlinePosterImageUrl}:${offlineLoopVideoUrl}:${fallbackVideoUrl}`;
    if (playbackDebugKeyRef.current === key) return;
    playbackDebugKeyRef.current = key;

    console.debug('[LiveTV] playback mode', {
      surface: 'live-tv-page',
      activeLive: !!presentation.playerUrl,
      offlinePosterImageUrl,
      offlineLoopVideoUrl,
      playbackMode,
    });
  }, [fallbackVideoUrl, offlineLoopVideoUrl, offlinePosterImageUrl, presentation.playerUrl]);
  const detailLine = presentation.title && presentation.title !== 'News Pulse Live TV'
    ? presentation.title
    : presentation.modeLabel;

  return (
    <>
      <Head>
        <title>Live TV | News Pulse</title>
        <meta name="description" content="Watch News Pulse Live TV and scheduled public live programming." />
      </Head>

      <main className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(191,219,254,0.32),transparent_36%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)] text-slate-950">
        <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
          <div className="flex items-center justify-start">
            <Link href="/" className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:-translate-y-0.5 hover:text-slate-950">
              <ChevronLeft className="h-4 w-4" /> Back to home
            </Link>
          </div>

          <section className="mt-8 overflow-hidden rounded-[32px] border border-slate-200 bg-white/92 shadow-[0_28px_80px_-42px_rgba(15,23,42,0.28)] backdrop-blur">
            <div className={presentation.highlightBreaking ? 'border-b border-red-200 bg-[linear-gradient(135deg,rgba(220,38,38,0.16),rgba(249,115,22,0.12),rgba(255,255,255,0.92))] px-6 py-6' : 'border-b border-slate-200 bg-[linear-gradient(135deg,rgba(220,38,38,0.10),rgba(59,130,246,0.08),rgba(255,255,255,0.92))] px-6 py-6'}>
              <div className="flex flex-col gap-5">
                <div className="flex flex-col items-start gap-4 rounded-full bg-white px-5 py-5 shadow-[0_8px_24px_rgba(15,23,42,0.08)] sm:flex-row sm:items-center sm:gap-[22px] sm:px-[34px] sm:py-5">
                  <div className="flex min-w-0 items-center gap-4 sm:gap-[22px]">
                    <div className="flex w-[92px] flex-shrink-0 items-center justify-center bg-transparent sm:w-[120px] lg:w-[150px]">
                      <img
                        src="/brand/news-pulse-final-mark.png"
                        alt="News Pulse logo"
                        className="block h-auto w-full bg-transparent object-contain"
                      />
                    </div>
                    <div className="min-w-0">
                      <div className="text-[1.65rem] font-black tracking-tight text-slate-950 sm:text-[2rem]">News Pulse</div>
                      <p className="mt-1 text-sm font-medium text-slate-600 sm:text-base">Your pulse on what matters most.</p>
                    </div>
                  </div>
                </div>

                <div>
                  <div className="text-[11px] font-extrabold uppercase tracking-[0.2em] text-slate-500">Live TV</div>
                  <div className="mt-2 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
                    <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">News Pulse Live</h1>
                    <div className={presentation.highlightBreaking ? 'inline-flex items-center gap-2 rounded-full bg-red-700 px-4 py-2 text-xs font-extrabold tracking-[0.18em] text-white shadow-[0_18px_40px_-24px_rgba(185,28,28,0.9)]' : 'inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2 text-xs font-extrabold tracking-[0.18em] text-white'}>
                      <Radio className="h-4 w-4" /> {displayBadgeLabel}
                    </div>
                  </div>
                  <p className="mt-2 max-w-2xl text-sm font-semibold text-slate-700 sm:text-base">{detailLine}</p>
                  {presentation.subtitle ? <p className="mt-1 max-w-2xl text-sm text-slate-600 sm:text-base">{presentation.subtitle}</p> : null}
                  {presentation.scheduleLabel ? <p className="mt-1 max-w-2xl text-sm text-slate-600 sm:text-base">{presentation.scheduleLabel}</p> : null}
                </div>
              </div>
            </div>

            <div className="p-4 sm:p-6">
              <div className="overflow-hidden rounded-[18px] bg-transparent sm:rounded-[22px] lg:rounded-[24px]">
                <div className="relative w-full min-h-[220px] overflow-hidden rounded-[18px] bg-black sm:rounded-[22px] md:min-h-[360px] lg:rounded-[24px]" style={{ aspectRatio: '16 / 9' }}>
                  {isEnabled && presentation.playerKind === 'iframe' ? (
                    <iframe
                      title={presentation.title}
                      src={presentation.playerUrl}
                      className="absolute inset-0 h-full w-full rounded-[18px] border-0 bg-transparent sm:rounded-[22px] lg:rounded-[24px]"
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
                  ) : isEnabled && presentation.playerKind === 'video' ? (
                    <video
                      className="absolute inset-0 h-full w-full rounded-[18px] bg-transparent object-cover sm:rounded-[22px] lg:rounded-[24px]"
                      controls
                      playsInline
                      preload="metadata"
                      src={presentation.playerUrl}
                    />
                  ) : offlineLoopVideoUrl || offlinePosterImageUrl ? (
                    <LiveTvOfflineSequence
                      posterUrl={offlinePosterImageUrl}
                      videoUrl={offlineLoopVideoUrl}
                      title={presentation.title}
                      mediaClassName="absolute inset-0 block h-full w-full rounded-[18px] bg-transparent object-cover sm:rounded-[22px] lg:rounded-[24px]"
                      posterClassName="offlinePosterImage absolute inset-0 block h-full w-full rounded-[18px] bg-black object-contain object-center sm:rounded-[22px] lg:rounded-[24px]"
                      surface="live-tv-page"
                      fallbackNode={fallbackReplayNode}
                    />
                  ) : fallbackVideoUrl && fallbackVideoKind === 'iframe' ? (
                    <iframe
                      title={presentation.title}
                      src={fallbackVideoUrl}
                      className="absolute inset-0 h-full w-full rounded-[18px] border-0 bg-transparent sm:rounded-[22px] lg:rounded-[24px]"
                      allow="autoplay; encrypted-media; picture-in-picture"
                      allowFullScreen
                    />
                  ) : fallbackVideoUrl && fallbackVideoKind === 'video' ? (
                    <video
                      className="absolute inset-0 h-full w-full rounded-[18px] bg-transparent object-cover sm:rounded-[22px] lg:rounded-[24px]"
                      controls
                      playsInline
                      preload="metadata"
                      src={fallbackVideoUrl}
                    />
                  ) : comingSoonNode}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">
                  <Play className="h-4 w-4" /> {presentation.modeLabel}
                </div>
                {!isEnabled || (!presentation.playerUrl && presentation.message) ? <div className="text-sm text-slate-600">{presentation.message}</div> : null}
              </div>

              {scheduleItems.length ? (
                <div className="mt-6 border-t border-slate-200 pt-5">
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="text-base font-black tracking-tight text-slate-950">Upcoming Schedule</h2>
                    <div className="text-xs font-extrabold uppercase tracking-[0.16em] text-slate-500">Live TV</div>
                  </div>
                  <div className="mt-3 divide-y divide-slate-100 rounded-[18px] bg-slate-50/80">
                    {scheduleItems.map((item, index) => (
                      <div key={`${item.time}-${item.title}-${index}`} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(120px,0.7fr)_minmax(0,1.6fr)_auto] sm:items-center">
                        <div className="text-sm font-bold text-slate-700">{item.time || 'TBA'}</div>
                        <div className="min-w-0">
                          <div className="truncate text-sm font-extrabold text-slate-950">{item.title}</div>
                          <div className="mt-0.5 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{item.type.replace(/_/g, ' ')}</div>
                        </div>
                        <div className={item.type === 'breaking_bulletin' ? 'inline-flex w-fit items-center rounded-full bg-red-700 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white sm:justify-self-end' : 'inline-flex w-fit items-center rounded-full bg-slate-950 px-3 py-1 text-[11px] font-extrabold uppercase tracking-[0.14em] text-white sm:justify-self-end'}>
                          {item.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </main>
    </>
  );
}