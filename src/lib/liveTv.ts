import type { LiveTvMode, PublicLiveTvSettings } from './publicSettings';

export const LIVE_TV_COMING_SOON_MESSAGE = 'News Pulse Live TV is coming soon.';

export type LiveTvPresentation = {
  mode: LiveTvMode;
  modeLabel: string;
  badgeLabel: string;
  title: string;
  subtitle: string;
  message: string;
  playerUrl: string;
  playerKind: 'iframe' | 'video' | null;
  highlightBreaking: boolean;
  showScheduleCard: boolean;
};

function isDirectVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg|m3u8)(?:$|[?#])/i.test(url);
}

export function getLiveTvModeLabel(mode: LiveTvMode): string {
  switch (mode) {
    case 'aira-bulletin':
      return 'AIRA Bulletin';
    case 'offline-replay':
      return 'Offline Replay';
    case 'scheduled-show':
      return 'Scheduled Show';
    case 'breaking-mode':
      return 'Breaking Mode';
    case 'maintenance-coming-soon':
      return 'Maintenance / Coming Soon';
    case 'news-pulse-live':
    default:
      return 'News Pulse Live';
  }
}

function getLiveTvBadgeLabel(mode: LiveTvMode): string {
  switch (mode) {
    case 'offline-replay':
      return 'REPLAY';
    case 'scheduled-show':
      return 'NEXT SHOW';
    case 'maintenance-coming-soon':
      return 'SOON';
    case 'breaking-mode':
      return 'BREAKING';
    case 'aira-bulletin':
    case 'news-pulse-live':
    default:
      return 'LIVE';
  }
}

export function getLiveTvPlayerKind(url: string): 'iframe' | 'video' | null {
  const safeUrl = String(url || '').trim();
  if (!safeUrl) return null;
  return isDirectVideoUrl(safeUrl) ? 'video' : 'iframe';
}

export function resolveLiveTvPresentation(liveTv: PublicLiveTvSettings | null | undefined): LiveTvPresentation {
  const mode = liveTv?.mode ?? 'news-pulse-live';
  const embedUrl = String(liveTv?.embedUrl || '').trim();
  const fallbackVideoUrl = String(liveTv?.fallbackVideoUrl || '').trim();

  let playerUrl = '';
  if (mode === 'offline-replay' && fallbackVideoUrl) {
    playerUrl = fallbackVideoUrl;
  } else if (embedUrl) {
    playerUrl = embedUrl;
  }

  const title = String(liveTv?.title || '').trim() || 'News Pulse Live TV';
  const subtitle = String(liveTv?.subtitle || '').trim();

  return {
    mode,
    modeLabel: getLiveTvModeLabel(mode),
    badgeLabel: getLiveTvBadgeLabel(mode),
    title,
    subtitle,
    message: LIVE_TV_COMING_SOON_MESSAGE,
    playerUrl,
    playerKind: getLiveTvPlayerKind(playerUrl),
    highlightBreaking: mode === 'breaking-mode',
    showScheduleCard: mode === 'scheduled-show' && !playerUrl,
  };
}