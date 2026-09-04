import React from 'react';
import Link from 'next/link';
import { Play } from 'lucide-react';

import LiveTvOfflineSequence from '../LiveTvOfflineSequence';
import { fetchCurrentWeather } from '../../lib/fetchWeather';
import { getLiveTvDisplayBadgeLabel, resolveLiveTvPresentation } from '../../src/lib/liveTv';
import type { PublicLiveTvSettings } from '../../src/lib/publicSettings';
import type { HomeRightRailTheme } from './HomeRightRail';
import { DEFAULT_HOME_RIGHT_RAIL_THEME } from './HomeRightRail';
import { useI18n } from '../../src/i18n/LanguageProvider';

function RailSurface({ theme, className = '', children }: { theme: HomeRightRailTheme; className?: string; children: React.ReactNode }) {
  return (
    <div
      className={`rounded-[28px] border shadow-[0_18px_42px_-34px_rgba(15,23,42,0.30)] ${className}`}
      style={{ background: theme.surface, borderColor: theme.border }}
    >
      {children}
    </div>
  );
}

export function HomeLeftRailLiveTvCard({
  theme = DEFAULT_HOME_RIGHT_RAIL_THEME,
  liveTvSettings,
}: {
  theme?: HomeRightRailTheme;
  liveTvSettings: PublicLiveTvSettings;
}) {
  const presentation = resolveLiveTvPresentation(liveTvSettings);
  const shouldShowFallbackMedia = !liveTvSettings?.enabled || !presentation.playerUrl;
  const offlineLoopVideoUrl = shouldShowFallbackMedia ? presentation.offlineLoopVideoUrl : '';
  const offlinePosterImageUrl = shouldShowFallbackMedia ? presentation.offlinePosterImageUrl : '';
  const fallbackVideoUrl = shouldShowFallbackMedia ? presentation.fallbackVideoUrl : '';
  const displayBadgeLabel = getLiveTvDisplayBadgeLabel(presentation, { offlineLoopVideoUrl, offlinePosterImageUrl, fallbackVideoUrl });

  const comingSoonNode = (
    <div className="absolute inset-0 flex items-center justify-center px-3 py-3 text-center sm:px-4 sm:py-4">
      <div className="w-full bg-transparent">
        <div className="text-[12px] font-extrabold uppercase tracking-[0.22em] text-white/88">
          {presentation.modeLabel}
        </div>
        <div className="mt-3 text-[15px] font-semibold leading-[1.45] text-white/86">
          {presentation.message}
        </div>
      </div>
    </div>
  );

  const fallbackReplayNode = fallbackVideoUrl && presentation.fallbackVideoKind === 'iframe' ? (
    <iframe
      title={presentation.title}
      src={fallbackVideoUrl}
      className="absolute inset-0 block h-full w-full rounded-none border-0"
      allow="autoplay; encrypted-media; picture-in-picture"
      allowFullScreen
    />
  ) : fallbackVideoUrl && presentation.fallbackVideoKind === 'video' ? (
    <video
      className="absolute inset-0 block h-full w-full rounded-none object-cover"
      controls
      playsInline
      preload="metadata"
      src={fallbackVideoUrl}
    />
  ) : comingSoonNode;

  const accentBackground = presentation.highlightBreaking
    ? 'linear-gradient(135deg, rgba(220,38,38,0.18), rgba(249,115,22,0.12) 58%, rgba(37,99,235,0.08) 100%)'
    : 'linear-gradient(135deg, rgba(220,38,38,0.10), rgba(37,99,235,0.07) 68%, rgba(255,255,255,0.74) 100%)';

  return (
    <RailSurface theme={theme} className="overflow-hidden">
      <div className="border-b px-4 py-4" style={{ borderColor: theme.border, background: accentBackground }}>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-extrabold uppercase tracking-[0.16em]" style={{ color: theme.sub }}>
              Broadcast module
            </div>
            <div className="mt-1 text-sm font-black leading-[1.25] tracking-tight" style={{ color: theme.text }}>
              {presentation.title}
            </div>
            <div className="mt-1 overflow-hidden text-xs leading-[1.35] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]" style={{ color: theme.sub }}>
              {presentation.subtitle || presentation.modeLabel}
            </div>
          </div>
          <span className="rounded-full border px-2.5 py-1 text-xs font-extrabold text-white" style={{ background: presentation.highlightBreaking ? 'rgba(185,28,28,0.96)' : '#dc2626', borderColor: 'rgba(255,255,255,0.18)' }}>
            {displayBadgeLabel}
          </span>
        </div>
      </div>

      <div className="pt-1 sm:pt-2">
        <div className="overflow-hidden rounded-none bg-transparent">
          <div className="relative w-full min-h-[205px] overflow-hidden rounded-none bg-black sm:min-h-[235px]" style={{ aspectRatio: '16 / 9' }}>
            {presentation.playerKind === 'iframe' ? (
              <iframe
                title={presentation.title}
                src={presentation.playerUrl}
                className="absolute inset-0 block h-full w-full rounded-none border-0"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            ) : presentation.playerKind === 'video' ? (
              <video className="absolute inset-0 block h-full w-full rounded-none object-cover" controls playsInline preload="metadata" src={presentation.playerUrl} />
            ) : offlineLoopVideoUrl || offlinePosterImageUrl ? (
              <LiveTvOfflineSequence
                posterUrl={offlinePosterImageUrl}
                videoUrl={offlineLoopVideoUrl}
                title={presentation.title}
                mediaClassName="absolute inset-0 block h-full w-full rounded-none object-cover"
                posterClassName="offlinePosterImage absolute inset-0 block h-full w-full rounded-none bg-black object-contain object-center"
                surface="broadcast-module"
                fallbackNode={fallbackReplayNode}
              />
            ) : fallbackVideoUrl && presentation.fallbackVideoKind === 'iframe' ? (
              <iframe
                title={presentation.title}
                src={fallbackVideoUrl}
                className="absolute inset-0 block h-full w-full rounded-none border-0"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            ) : fallbackVideoUrl && presentation.fallbackVideoKind === 'video' ? (
              <video className="absolute inset-0 block h-full w-full rounded-none object-cover" controls playsInline preload="metadata" src={fallbackVideoUrl} />
            ) : comingSoonNode}
          </div>
        </div>

        <div className="mt-4 px-4 pb-4">
          <Link href="/live-tv" className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition hover:-translate-y-0.5" style={{ borderColor: theme.border, color: theme.text, background: 'rgba(248,250,252,0.98)' }} aria-label="Open Live TV page">
            <Play className="h-4 w-4" /> Open Live TV
          </Link>
        </div>
      </div>
    </RailSurface>
  );
}

export function HomeLeftRailSnapshotsCard({ theme = DEFAULT_HOME_RIGHT_RAIL_THEME }: { theme?: HomeRightRailTheme }) {
  const { t } = useI18n();
  const [weatherValue, setWeatherValue] = React.useState<string>('');

  React.useEffect(() => {
    const controller = new AbortController();
    let mounted = true;

    const load = async () => {
      try {
        const wx = await fetchCurrentWeather({ city: 'Ahmedabad', signal: controller.signal });
        if (!mounted) return;
        setWeatherValue(`${Math.round(wx.tempC)}°C • ${wx.condition}`);
      } catch {
        if (!mounted) return;
        setWeatherValue('Weather unavailable');
      }
    };

    void load();
    const id = window.setInterval(load, 10 * 60 * 1000);
    return () => {
      mounted = false;
      controller.abort();
      window.clearInterval(id);
    };
  }, []);

  return (
    <RailSurface theme={theme} className="overflow-hidden">
      <div className="border-b px-4 py-4" style={{ borderColor: theme.border, background: 'linear-gradient(135deg, rgba(16,185,129,0.10), rgba(37,99,235,0.05) 72%, rgba(255,255,255,0.72) 100%)' }}>
        <div className="text-[12px] font-extrabold uppercase tracking-[0.16em]" style={{ color: theme.sub }}>
          Daily briefing
        </div>
        <div className="mt-1 text-sm font-black tracking-tight" style={{ color: theme.text }}>
          {t('home.snapshotsTitle')}
        </div>
        <div className="mt-1 text-xs" style={{ color: theme.sub }}>
          {t('home.snapshotsSubtitle')}
        </div>
      </div>

      <div className="grid gap-3 p-4">
        {[
          { k: t('home.snapshotWeather'), v: weatherValue || '—' },
          { k: t('home.snapshotMarkets'), v: 'Stable' },
          { k: t('home.snapshotGold'), v: '₹ — (api)' },
        ].map((item) => (
          <div key={item.k} className="rounded-[22px] border px-3 py-3 shadow-[0_14px_28px_-26px_rgba(15,23,42,0.24)]" style={{ background: theme.surface2, borderColor: theme.border }}>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: theme.sub }}>
              {item.k}
            </div>
            <div className="mt-1 text-sm font-extrabold" style={{ color: theme.text }}>
              {item.v}
            </div>
          </div>
        ))}
      </div>
    </RailSurface>
  );
}
