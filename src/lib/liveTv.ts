import { sanitizeEmbedUrl, sanitizeMediaUrl, toSafeYouTubeEmbedUrl, type LiveTvMode, type PublicLiveTvSettings } from './publicSettings';

export const LIVE_TV_COMING_SOON_MESSAGE = 'News Pulse Live TV is coming soon.';
export const LIVE_TV_OFFLINE_MESSAGE = 'News Pulse Live TV is currently offline.';
export const LIVE_TV_VIDEO_UNAVAILABLE_MESSAGE = 'Live TV video is not available right now.';

export type LiveTvSourceType =
  | 'youtube_live'
  | 'custom_embed'
  | 'aira_bulletin'
  | 'offline_replay'
  | 'scheduled_program'
  | 'breaking_bulletin'
  | 'sponsored_program'
  | 'maintenance';

export type LiveTvCurrentSource = {
  enabled: boolean;
  sourceType: LiveTvSourceType;
  title: string;
  subtitle: string;
  label: string;
  status: string;
  provider: string;
  embedUrl: string;
  fallbackVideoUrl: string;
  offlineLoopVideoUrl: string;
  offlinePosterImageUrl: string;
  currentVideoUrl: string;
  currentProgramTitle: string;
  currentProgramLabel: string;
  startTime: string;
  endTime: string;
  showOnHomepage?: boolean;
  message?: string;
  maintenanceMessage?: string;
};

export type LiveTvScheduleItem = {
  time: string;
  title: string;
  label: string;
  type: LiveTvSourceType;
  startTime: string;
  endTime: string;
};

export type LiveTvPresentation = {
  mode: LiveTvMode;
  sourceType?: LiveTvSourceType;
  modeLabel: string;
  badgeLabel: string;
  title: string;
  subtitle: string;
  message: string;
  playerUrl: string;
  playerKind: 'iframe' | 'video' | null;
  offlineLoopVideoUrl: string;
  offlinePosterImageUrl: string;
  fallbackVideoUrl: string;
  fallbackVideoKind: 'iframe' | 'video' | null;
  highlightBreaking: boolean;
  showScheduleCard: boolean;
  scheduleLabel: string;
};

function isDirectVideoUrl(url: string): boolean {
  return /\.(mp4|webm|ogg|m3u8)(?:$|[?#])/i.test(url);
}

function isImageUrl(url: string): boolean {
  return /\.(avif|gif|jpe?g|png|svg|webp)(?:$|[?#])/i.test(url);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function cleanString(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function firstString(root: Record<string, unknown> | null, keys: string[]): string {
  if (!root) return '';
  for (const key of keys) {
    const value = cleanString((root as any)[key]);
    if (value) return value;
  }
  return '';
}

function firstBoolean(root: Record<string, unknown> | null, keys: string[]): boolean | undefined {
  if (!root) return undefined;
  for (const key of keys) {
    const value = (root as any)[key];
    if (typeof value === 'boolean') return value;
  }
  return undefined;
}

function normalizeSourceType(raw: unknown, fallback: LiveTvSourceType = 'youtube_live'): LiveTvSourceType {
  const value = String(raw ?? '').toLowerCase().trim().replace(/[\s-]+/g, '_');
  if (!value) return fallback;

  if (value === 'youtube_live' || value === 'youtube' || value === 'live' || value === 'news_pulse_live') return 'youtube_live';
  if (value === 'custom_embed' || value === 'embed' || value === 'custom') return 'custom_embed';
  if (value === 'aira_bulletin' || value === 'aira' || value === 'bulletin') return 'aira_bulletin';
  if (value === 'offline_replay' || value === 'replay' || value === 'offline') return 'offline_replay';
  if (value === 'scheduled_program' || value === 'scheduled_show' || value === 'scheduled') return 'scheduled_program';
  if (value === 'breaking_bulletin' || value === 'breaking_mode' || value === 'breaking') return 'breaking_bulletin';
  if (value === 'sponsored_program' || value === 'sponsored') return 'sponsored_program';
  if (value === 'maintenance' || value === 'coming_soon' || value === 'maintenance_coming_soon') return 'maintenance';

  return fallback;
}

function unwrapCurrentSource(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) return null;

  const candidates = [
    raw,
    isRecord((raw as any).data) ? ((raw as any).data as Record<string, unknown>) : null,
    isRecord((raw as any).source) ? ((raw as any).source as Record<string, unknown>) : null,
    isRecord((raw as any).currentSource) ? ((raw as any).currentSource as Record<string, unknown>) : null,
    isRecord((raw as any).liveTv) ? ((raw as any).liveTv as Record<string, unknown>) : null,
    isRecord((raw as any).settings) && isRecord((raw as any).settings.liveTv) ? ((raw as any).settings.liveTv as Record<string, unknown>) : null,
  ];

  for (const candidate of candidates) {
    if (
      candidate &&
      (candidate.sourceType != null ||
        candidate.enabled != null ||
        candidate.embedUrl != null ||
        candidate.currentVideoUrl != null ||
        candidate.offlineLoopVideoUrl != null ||
        candidate.offlinePosterImageUrl != null)
    ) {
      return candidate;
    }
  }

  return null;
}

function unwrapScheduleItems(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!isRecord(raw)) return [];

  const candidates = [
    (raw as any).items,
    (raw as any).schedule,
    (raw as any).upcoming,
    (raw as any).programs,
    (raw as any).data,
    isRecord((raw as any).data) ? (raw as any).data.items : undefined,
    isRecord((raw as any).data) ? (raw as any).data.schedule : undefined,
    isRecord((raw as any).data) ? (raw as any).data.upcoming : undefined,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

function normalizePlayableUrl(raw: unknown, provider?: string): string {
  const input = cleanString(raw);
  if (!input) return '';
  if (isImageUrl(input)) return '';
  const providerValue = String(provider || '').toLowerCase();
  if (providerValue.includes('mp4') || providerValue.includes('video') || isDirectVideoUrl(input)) {
    return sanitizeMediaUrl(input);
  }
  return toSafeYouTubeEmbedUrl(input) || sanitizeEmbedUrl(input);
}

export function hasLiveTvOfflineMediaFields(raw: unknown): boolean {
  const source = unwrapCurrentSource(raw);
  if (!source) return false;
  return Object.prototype.hasOwnProperty.call(source, 'offlinePosterImageUrl') || Object.prototype.hasOwnProperty.call(source, 'offlineLoopVideoUrl');
}

function isYouTubeUrl(raw: unknown): boolean {
  return !!toSafeYouTubeEmbedUrl(raw);
}

function isWithinScheduleWindow(startTime: string, endTime: string, now = new Date()): boolean {
  if (!startTime && !endTime) return true;
  const start = startTime ? Date.parse(startTime) : Number.NEGATIVE_INFINITY;
  const end = endTime ? Date.parse(endTime) : Number.POSITIVE_INFINITY;
  if (!Number.isFinite(start) && !Number.isFinite(end)) return true;
  const current = now.getTime();
  return current >= start && current <= end;
}

function formatScheduleLabel(startTime: string, endTime: string): string {
  if (!startTime && !endTime) return '';
  const format = (raw: string): string => {
    if (!raw) return '';
    const d = new Date(raw);
    if (Number.isNaN(d.getTime())) return raw;
    return d.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };
  const start = format(startTime);
  const end = format(endTime);
  if (start && end) return `Scheduled: ${start} – ${end}`;
  return `Scheduled: ${start || end}`;
}

function formatScheduleItemTime(time: string, startTime: string, endTime: string): string {
  if (time) return time;
  return formatScheduleLabel(startTime, endTime).replace(/^Scheduled:\s*/i, '');
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

export function getLiveTvPlayerKind(url: string, provider?: string): 'iframe' | 'video' | null {
  const safeUrl = String(url || '').trim();
  if (!safeUrl) return null;
  if (isImageUrl(safeUrl)) return null;
  const providerValue = String(provider || '').toLowerCase();
  return providerValue.includes('mp4') || providerValue.includes('video') || isDirectVideoUrl(safeUrl) ? 'video' : 'iframe';
}

export function getLiveTvDisplayBadgeLabel(
  presentation: Pick<LiveTvPresentation, 'badgeLabel' | 'playerUrl' | 'offlineLoopVideoUrl' | 'offlinePosterImageUrl' | 'fallbackVideoUrl'>,
  media?: { offlineLoopVideoUrl?: string; offlinePosterImageUrl?: string; fallbackVideoUrl?: string }
): string {
  if (presentation.playerUrl) return presentation.badgeLabel;

  const offlineLoopVideoUrl = media?.offlineLoopVideoUrl ?? presentation.offlineLoopVideoUrl;
  const offlinePosterImageUrl = media?.offlinePosterImageUrl ?? presentation.offlinePosterImageUrl;
  const fallbackVideoUrl = media?.fallbackVideoUrl ?? presentation.fallbackVideoUrl;

  if (offlineLoopVideoUrl || offlinePosterImageUrl) return 'OFFLINE';
  if (fallbackVideoUrl) return 'REPLAY';
  return presentation.badgeLabel === 'LIVE' ? 'COMING SOON' : presentation.badgeLabel;
}

export function normalizeLiveTvCurrentSource(raw: unknown): LiveTvCurrentSource | null {
  const source = unwrapCurrentSource(raw);
  if (!source) return null;

  const sourceType = normalizeSourceType(
    (source as any).sourceType ?? (source as any).type ?? (source as any).mode ?? (source as any).status,
    'youtube_live'
  );

  return {
    enabled: firstBoolean(source, ['enabled', 'isEnabled', 'active']) ?? true,
    sourceType,
    title: firstString(source, ['title', 'heading']),
    subtitle: firstString(source, ['subtitle', 'description', 'subheading']),
    label: firstString(source, ['label', 'badgeLabel']),
    status: firstString(source, ['status', 'state']),
    provider: firstString(source, ['provider', 'mimeType', 'contentType']),
    embedUrl: firstString(source, ['embedUrl', 'youtubeEmbedUrl', 'liveEmbedUrl', 'url', 'youtubeUrl']),
    fallbackVideoUrl: firstString(source, ['fallbackVideoUrl', 'fallbackUrl', 'replayUrl', 'offlineReplayUrl', 'videoUrl']),
    offlineLoopVideoUrl: firstString(source, ['offlineLoopVideoUrl', 'offlineLoopUrl', 'loopVideoUrl', 'offlineVideoLoopUrl', 'holdingLoopVideoUrl']),
    offlinePosterImageUrl: firstString(source, ['offlinePosterImageUrl', 'offlinePosterUrl', 'posterImageUrl', 'posterUrl', 'offlineImageUrl', 'holdingImageUrl']),
    currentVideoUrl: firstString(source, ['currentVideoUrl', 'currentUrl', 'currentProgramUrl', 'videoUrl']),
    currentProgramTitle: firstString(source, ['currentProgramTitle', 'programTitle', 'currentTitle']),
    currentProgramLabel: firstString(source, ['currentProgramLabel', 'programLabel']),
    startTime: firstString(source, ['startTime', 'startsAt', 'scheduledStart']),
    endTime: firstString(source, ['endTime', 'endsAt', 'scheduledEnd']),
    showOnHomepage: firstBoolean(source, ['showOnHomepage', 'homepageEnabled', 'showHome']),
    message: firstString(source, ['message', 'offlineMessage']),
    maintenanceMessage: firstString(source, ['maintenanceMessage', 'comingSoonMessage']),
  };
}

function getCurrentSourceBadgeLabel(source: LiveTvCurrentSource): string {
  if (!source.enabled) return 'COMING SOON';

  switch (source.sourceType) {
    case 'youtube_live':
      return 'LIVE';
    case 'custom_embed':
      return source.currentProgramLabel || source.label || 'LIVE';
    case 'aira_bulletin':
      return 'AIRA BULLETIN • ON AIR';
    case 'offline_replay':
      return 'REPLAY';
    case 'scheduled_program':
      return 'SCHEDULED';
    case 'breaking_bulletin':
      return 'BREAKING BULLETIN';
    case 'sponsored_program':
      return 'SPONSORED PROGRAM';
    case 'maintenance':
      return 'COMING SOON';
    default:
      return source.label || 'LIVE';
  }
}

function getScheduleItemLabel(sourceType: LiveTvSourceType, fallbackLabel: string): string {
  switch (sourceType) {
    case 'youtube_live':
      return 'LIVE';
    case 'custom_embed':
      return fallbackLabel || 'LIVE';
    case 'aira_bulletin':
      return 'AIRA BULLETIN • ON AIR';
    case 'offline_replay':
      return 'REPLAY';
    case 'scheduled_program':
      return 'SCHEDULED';
    case 'breaking_bulletin':
      return 'BREAKING BULLETIN';
    case 'sponsored_program':
      return 'SPONSORED PROGRAM';
    case 'maintenance':
      return 'COMING SOON';
    default:
      return fallbackLabel || 'SCHEDULED';
  }
}

function getCurrentSourcePlayerUrl(source: LiveTvCurrentSource): string {
  if (!source.enabled || source.sourceType === 'maintenance') return '';

  const embedUrl = normalizePlayableUrl(source.embedUrl, source.provider);
  const currentVideoUrl = normalizePlayableUrl(source.currentVideoUrl, source.provider);

  switch (source.sourceType) {
    case 'youtube_live':
      return embedUrl || currentVideoUrl;
    case 'custom_embed':
      return embedUrl || currentVideoUrl;
    case 'aira_bulletin':
      return (isYouTubeUrl(source.embedUrl) ? embedUrl : '') || currentVideoUrl || embedUrl;
    case 'offline_replay':
      return '';
    case 'scheduled_program':
      return isWithinScheduleWindow(source.startTime, source.endTime) ? currentVideoUrl || embedUrl : '';
    case 'breaking_bulletin':
      return currentVideoUrl || embedUrl;
    case 'sponsored_program':
      return currentVideoUrl || embedUrl;
    default:
      return embedUrl || currentVideoUrl;
  }
}

export function resolveLiveTvCurrentSourcePresentation(source: LiveTvCurrentSource): LiveTvPresentation {
  const badgeLabel = getCurrentSourceBadgeLabel(source);
  const title = source.currentProgramTitle || source.title || 'News Pulse Live TV';
  const subtitle = source.subtitle;
  const scheduleLabel = formatScheduleLabel(source.startTime, source.endTime);
  const playerUrl = getCurrentSourcePlayerUrl(source);
  const offlineLoopVideoUrl = sanitizeMediaUrl(source.offlineLoopVideoUrl);
  const offlinePosterImageUrl = sanitizeMediaUrl(source.offlinePosterImageUrl);
  const fallbackVideoUrl = normalizePlayableUrl(source.fallbackVideoUrl, source.provider);
  const maintenanceMessage = source.maintenanceMessage || source.message || LIVE_TV_COMING_SOON_MESSAGE;
  const message = !source.enabled
    ? LIVE_TV_OFFLINE_MESSAGE
    : source.sourceType === 'maintenance'
      ? maintenanceMessage
      : playerUrl
        ? ''
        : LIVE_TV_VIDEO_UNAVAILABLE_MESSAGE;

  return {
    mode: source.sourceType === 'breaking_bulletin' ? 'breaking-mode' : source.sourceType === 'maintenance' ? 'maintenance-coming-soon' : 'news-pulse-live',
    sourceType: source.sourceType,
    modeLabel: badgeLabel,
    badgeLabel,
    title,
    subtitle,
    message,
    playerUrl,
    playerKind: getLiveTvPlayerKind(playerUrl, source.provider),
    offlineLoopVideoUrl,
    offlinePosterImageUrl,
    fallbackVideoUrl,
    fallbackVideoKind: getLiveTvPlayerKind(fallbackVideoUrl, source.provider),
    highlightBreaking: source.sourceType === 'breaking_bulletin',
    showScheduleCard: source.sourceType === 'scheduled_program' || !!scheduleLabel,
    scheduleLabel,
  };
}

export function normalizeLiveTvUpcomingSchedule(raw: unknown): LiveTvScheduleItem[] {
  return unwrapScheduleItems(raw)
    .map((item) => {
      if (!isRecord(item)) return null;
      const type = normalizeSourceType((item as any).sourceType ?? (item as any).type ?? (item as any).programType ?? (item as any).status, 'scheduled_program');
      const startTime = firstString(item, ['startTime', 'startsAt', 'scheduledStart', 'from']);
      const endTime = firstString(item, ['endTime', 'endsAt', 'scheduledEnd', 'to']);
      const title = firstString(item, ['title', 'programTitle', 'currentProgramTitle', 'name', 'heading']);
      const fallbackLabel = firstString(item, ['label', 'programLabel', 'currentProgramLabel']);
      const time = formatScheduleItemTime(firstString(item, ['time', 'displayTime', 'slotTime']), startTime, endTime);

      if (!title && !time) return null;

      return {
        time,
        title: title || 'News Pulse Live TV',
        label: getScheduleItemLabel(type, fallbackLabel),
        type,
        startTime,
        endTime,
      };
    })
    .filter((item): item is LiveTvScheduleItem => !!item)
    .slice(0, 12);
}

export function resolveLiveTvPresentation(liveTv: PublicLiveTvSettings | null | undefined): LiveTvPresentation {
  const mode = liveTv?.mode ?? 'news-pulse-live';
  const embedUrl = String(liveTv?.embedUrl || '').trim();
  const fallbackVideoUrl = toSafeYouTubeEmbedUrl(liveTv?.fallbackVideoUrl || '') || sanitizeMediaUrl(liveTv?.fallbackVideoUrl || '');
  const offlineLoopVideoUrl = sanitizeMediaUrl(liveTv?.offlineLoopVideoUrl || '');
  const offlinePosterImageUrl = sanitizeMediaUrl(liveTv?.offlinePosterImageUrl || '');

  const hasActiveEmbed = liveTv?.enabled !== false && mode !== 'offline-replay' && mode !== 'maintenance-coming-soon' && !!embedUrl && !isImageUrl(embedUrl);
  const playerUrl = hasActiveEmbed ? embedUrl : '';

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
    offlineLoopVideoUrl,
    offlinePosterImageUrl,
    fallbackVideoUrl,
    fallbackVideoKind: getLiveTvPlayerKind(fallbackVideoUrl),
    highlightBreaking: mode === 'breaking-mode',
    showScheduleCard: mode === 'scheduled-show' && !playerUrl,
    scheduleLabel: '',
  };
}