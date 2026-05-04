import { getPublicApiBaseUrl } from './publicApiBase';

export type PublicViralVideoKind = 'youtube' | 'video' | 'external' | 'unsupported';

export type PublicViralVideo = {
  id: string;
  title: string;
  summary: string;
  posterImageUrl: string;
  thumbnailUrl: string;
  videoFileUrl: string;
  videoUrl: string;
  sourceUrl: string;
  videoType: string;
  playbackMode: string;
  category: string;
  publishedAt: string;
  language: string;
  showOnHomepage: boolean;
  status: string;
  slug: string;
  kind: PublicViralVideoKind;
  youtubeEmbedUrl: string;
  raw: Record<string, any>;
};

export type PublicViralVideosPayload = {
  ok: boolean;
  settings: { frontendEnabled: boolean };
  items: PublicViralVideo[];
};

export type PublicViralVideoPlayback = {
  mode: 'youtube' | 'direct' | 'external' | 'unavailable';
  embedUrl: string;
  directUrl: string;
  externalUrl: string;
  reason: string;
};

type PublicViralVideoPlaybackInput = Partial<PublicViralVideo> & {
  assetUrl?: string;
  url?: string;
  mediaUrl?: string;
  cloudinaryUrl?: string;
};

export function getPublicViralVideoXStatusUrl(rawUrl: string): string {
  const url = String(rawUrl || '').trim();
  if (!url) return '';

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    if (host !== 'x.com' && host !== 'twitter.com') return '';

    const parts = parsed.pathname.split('/').filter(Boolean);
    const statusIndex = parts.findIndex((part) => part.toLowerCase() === 'status');
    if (statusIndex < 0) return '';

    const id = parts[statusIndex + 1] || '';
    if (!/^\d{5,}$/.test(id)) return '';
    return `https://${host}/${parts.slice(0, statusIndex + 2).join('/')}`;
  } catch {
    return '';
  }
}

export function getPublicViralVideoXEmbedUrl(video: Partial<PublicViralVideo> | null | undefined): string {
  if (!video) return '';
  const videoType = String(video.videoType || '').trim().toLowerCase();
  const playbackMode = String(video.playbackMode || '').trim().toLowerCase();
  const candidate = getPublicViralVideoXStatusUrl(video.videoUrl || '') || getPublicViralVideoXStatusUrl(video.sourceUrl || '');

  if (videoType === 'x' || videoType === 'twitter' || playbackMode === 'x_embed') return candidate;
  return candidate;
}

function isRecord(value: unknown): value is Record<string, any> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function pickFirstString(...values: unknown[]): string {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) return text;
  }
  return '';
}

function pickFirstBoolean(...values: unknown[]): boolean | undefined {
  for (const value of values) {
    if (typeof value === 'boolean') return value;
    if (value === 1) return true;
    if (value === 0) return false;
    const text = String(value ?? '').trim().toLowerCase();
    if (!text) continue;
    if (['true', '1', 'yes', 'on', 'published'].includes(text)) return true;
    if (['false', '0', 'no', 'off', 'draft', 'disabled'].includes(text)) return false;
  }
  return undefined;
}

function normalizeBase(raw: string): string {
  return String(raw || '').trim().replace(/\/+$/, '').replace(/\/api\/?$/, '');
}

function getUploadBaseUrl(): string {
  const serverBase = normalizeBase(getPublicApiBaseUrl());
  if (serverBase) return serverBase;

  return normalizeBase(
    String(
      process.env.NEXT_PUBLIC_API_BASE ||
        process.env.NEXT_PUBLIC_API_URL ||
        process.env.NEXT_PUBLIC_BACKEND_URL ||
        process.env.NEXT_PUBLIC_API_BASE_URL ||
        process.env.NEXT_PUBLIC_BACKEND_API_BASE_URL ||
        ''
    )
  );
}

export function resolvePublicViralVideoMediaUrl(value: string): string {
  const url = String(value || '').trim();
  if (!url) return '';
  if (url.startsWith('//')) return `https:${url}`;

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : '';
  } catch {
    const path = url.startsWith('/') ? url : `/${url}`;
    if (!path.startsWith('/uploads')) return url;
    const base = getUploadBaseUrl();
    return base ? `${base}${path}` : path;
  }
}

function extractItems(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (!isRecord(raw)) return [];

  const candidates = [
    raw.items,
    raw.videos,
    raw.viralVideos,
    raw.results,
    raw.docs,
    raw.data,
    isRecord(raw.data) ? raw.data.items : null,
    isRecord(raw.data) ? raw.data.videos : null,
    isRecord(raw.data) ? raw.data.viralVideos : null,
    isRecord(raw.data) ? raw.data.results : null,
    isRecord(raw.data) ? raw.data.docs : null,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  const single = raw.item || raw.video || raw.featured;
  return single ? [single] : [];
}

function normalizeStatus(item: Record<string, any>): string {
  const explicitInactive = pickFirstBoolean(item.active, item.isActive, item.enabled) === false;
  if (explicitInactive) return 'draft';

  const publishStatus = pickFirstString(item.publishStatus, item.publicationStatus, item.publishedStatus).toLowerCase();
  if (publishStatus) return publishStatus;

  const status = pickFirstString(item.status, item.state, item.visibility).toLowerCase();
  if (status) {
    if (['active', 'enabled', 'live', 'running', 'on'].includes(status)) return 'published';
    return status;
  }

  const published = pickFirstBoolean(item.published, item.isPublished);
  if (published === true) return 'published';
  if (published === false) return 'draft';
  return 'published';
}

export function getYouTubeEmbedUrl(rawUrl: string): string {
  const url = String(rawUrl || '').trim();
  if (!url) return '';

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    let id = '';

    if (host === 'youtu.be') {
      id = parsed.pathname.split('/').filter(Boolean)[0] || '';
    } else if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
      if (parsed.pathname.startsWith('/embed/')) id = parsed.pathname.split('/').filter(Boolean)[1] || '';
      if (!id && parsed.pathname.startsWith('/shorts/')) id = parsed.pathname.split('/').filter(Boolean)[1] || '';
      if (!id) id = parsed.searchParams.get('v') || '';
    }

    if (!id) return '';
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?rel=0&modestbranding=1&playsinline=1`;
  } catch {
    return '';
  }
}

function isDirectHtml5VideoUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (lower.startsWith('data:video/')) return true;

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    const path = parsed.pathname.toLowerCase();
    if (/\.(mp4|webm|mov|ogg|ogv|m4v)(?:$|[?#])/.test(lower)) return true;
    if (host.includes('cloudinary.com') && path.includes('/video/upload/')) return true;
  } catch {
    return false;
  }

  return false;
}

function getAbsoluteHttpUrl(value: string): string {
  const url = String(value || '').trim();
  if (!url) return '';

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? url : '';
  } catch {
    return '';
  }
}

export function getPublicViralVideoKind(videoUrl: string): PublicViralVideoKind {
  const url = String(videoUrl || '').trim();
  if (!url) return 'unsupported';
  if (getYouTubeEmbedUrl(url)) return 'youtube';
  if (isDirectHtml5VideoUrl(url)) return 'video';

  try {
    const host = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
    if (
      host.includes('instagram.com') ||
      host.includes('facebook.com') ||
      host === 'fb.watch' ||
      host.includes('twitter.com') ||
      host.includes('x.com')
    ) {
      return 'external';
    }
  } catch {
    return 'unsupported';
  }

  return 'external';
}

function getPlaybackInput(input: string | PublicViralVideoPlaybackInput | null | undefined) {
  if (!input || typeof input === 'string') {
    return {
      playbackMode: '',
      videoType: '',
      videoFileUrl: '',
      videoUrl: String(input || ''),
      sourceUrl: '',
    };
  }

  return {
    playbackMode: String(input.playbackMode || '').trim().toLowerCase(),
    videoType: String(input.videoType || input.kind || '').trim().toLowerCase(),
    videoFileUrl: pickFirstString(input.videoFileUrl, input.assetUrl, input.mediaUrl, input.cloudinaryUrl),
    videoUrl: pickFirstString(input.videoUrl, input.url, input.assetUrl, input.mediaUrl, input.cloudinaryUrl),
    sourceUrl: input.sourceUrl || '',
  };
}

export function resolvePublicViralVideoPlayback(input: string | PublicViralVideoPlaybackInput | null | undefined): PublicViralVideoPlayback {
  const playbackInput = getPlaybackInput(input);
  const mode = playbackInput.playbackMode;

  if (mode === 'internal' && playbackInput.videoFileUrl) {
    const directUrl = resolvePublicViralVideoMediaUrl(playbackInput.videoFileUrl);
    if (directUrl) return { mode: 'direct', embedUrl: '', directUrl, externalUrl: '', reason: '' };
  }

  if (mode === 'embed' && playbackInput.videoType === 'youtube') {
    const embedUrl = getYouTubeEmbedUrl(playbackInput.videoUrl || playbackInput.sourceUrl);
    if (embedUrl) return { mode: 'youtube', embedUrl, directUrl: '', externalUrl: '', reason: '' };
  }

  if (mode === 'external') {
    const externalUrl = getAbsoluteHttpUrl(playbackInput.sourceUrl || playbackInput.videoUrl);
    if (externalUrl) return { mode: 'external', embedUrl: '', directUrl: '', externalUrl, reason: '' };
    return { mode: 'unavailable', embedUrl: '', directUrl: '', externalUrl: '', reason: 'Video source unavailable' };
  }

  const directCandidate = resolvePublicViralVideoMediaUrl(playbackInput.videoFileUrl || '');
  if (directCandidate && isDirectHtml5VideoUrl(directCandidate)) {
    return { mode: 'direct', embedUrl: '', directUrl: directCandidate, externalUrl: '', reason: '' };
  }

  const url = getAbsoluteHttpUrl(playbackInput.videoUrl || playbackInput.sourceUrl);
  if (!url) {
    return { mode: 'unavailable', embedUrl: '', directUrl: '', externalUrl: '', reason: 'Video source unavailable' };
  }

  const embedUrl = getYouTubeEmbedUrl(url);
  if (embedUrl) {
    return { mode: 'youtube', embedUrl, directUrl: '', externalUrl: '', reason: '' };
  }

  if (isDirectHtml5VideoUrl(url)) {
    return { mode: 'direct', embedUrl: '', directUrl: url, externalUrl: '', reason: '' };
  }

  return { mode: 'external', embedUrl: '', directUrl: '', externalUrl: url, reason: '' };
}

export function getPublicViralVideoPosterUrl(video: Partial<PublicViralVideo> | null | undefined): string {
  if (!video) return '';
  return resolvePublicViralVideoMediaUrl(video.posterImageUrl || '') || resolvePublicViralVideoMediaUrl(video.thumbnailUrl || '');
}

export function normalizePublicViralVideo(raw: unknown): PublicViralVideo | null {
  if (!isRecord(raw)) return null;

  const video = isRecord(raw.video) ? raw.video : null;
  const media = Array.isArray(raw.media) ? raw.media.find(isRecord) || null : isRecord(raw.media) ? raw.media : null;
  const id = pickFirstString(raw._id, raw.id, raw.uuid, raw.slug);
  const title = pickFirstString(raw.title, raw.headline, raw.name, video?.title);
  const posterImageUrl = resolvePublicViralVideoMediaUrl(pickFirstString(
    raw.posterImageUrl,
    raw.posterImage,
    raw.posterUrl,
    raw.poster,
    video?.posterImageUrl,
    video?.posterImage,
    video?.posterUrl,
    media?.posterImageUrl,
    media?.posterImage,
    media?.posterUrl
  ));
  const thumbnailUrl = resolvePublicViralVideoMediaUrl(pickFirstString(
    raw.thumbnailUrl,
    raw.thumbnail,
    raw.imageUrl,
    raw.image,
    video?.thumbnailUrl,
    media?.thumbnailUrl,
    media?.thumbnail,
    media?.imageUrl,
    media?.image
  ));
  const videoFileUrl = resolvePublicViralVideoMediaUrl(pickFirstString(
    raw.videoFileUrl,
    raw.videoFile,
    raw.fileUrl,
    raw.uploadedVideoUrl,
    raw.assetUrl,
    raw.mediaUrl,
    raw.cloudinaryUrl,
    video?.videoFileUrl,
    video?.videoFile,
    video?.fileUrl,
    video?.assetUrl,
    video?.mediaUrl,
    video?.cloudinaryUrl,
    media?.videoFileUrl,
    media?.videoFile,
    media?.fileUrl,
    media?.assetUrl,
    media?.mediaUrl,
    media?.cloudinaryUrl
  ));
  const sourceUrl = pickFirstString(raw.sourceUrl, raw.source, raw.newsUrl, raw.articleUrl, video?.sourceUrl, video?.source, media?.sourceUrl, media?.source);
  const videoUrl = pickFirstString(
    raw.videoUrl,
    raw.url,
    raw.embedUrl,
    raw.assetUrl,
    raw.mediaUrl,
    raw.cloudinaryUrl,
    video?.videoUrl,
    video?.url,
    video?.embedUrl,
    video?.assetUrl,
    video?.mediaUrl,
    video?.cloudinaryUrl,
    media?.videoUrl,
    media?.url,
    media?.assetUrl,
    media?.mediaUrl,
    media?.cloudinaryUrl,
    sourceUrl,
    videoFileUrl
  );
  if (!id || !title || !(videoFileUrl || videoUrl || sourceUrl)) return null;

  const status = normalizeStatus(raw);
  const showOnHomepage = pickFirstBoolean(raw.showOnHomepage, raw.homepageFeature, raw.homepageFeatured, raw.isHomepageFeatured, raw.featured, raw.showHome, raw.homepage) === true;
  const categoryValue = raw.category;
  const category = pickFirstString(
    isRecord(categoryValue) ? categoryValue.name : categoryValue,
    isRecord(categoryValue) ? categoryValue.title : '',
    raw.categoryName,
    raw.section,
    'Viral Videos'
  );
  const publishedAt = pickFirstString(raw.publishedAt, raw.publishDate, raw.createdAt, raw.updatedAt);
  const language = pickFirstString(raw.language, raw.lang, raw.locale);
  const videoType = pickFirstString(raw.videoType, raw.type, video?.videoType, media?.videoType).toLowerCase();
  const playbackMode = pickFirstString(raw.playbackMode, raw.mode, video?.playbackMode, media?.playbackMode).toLowerCase();
  const playback = resolvePublicViralVideoPlayback({ videoFileUrl, videoUrl, sourceUrl, videoType, playbackMode });
  const kind = playback.mode === 'youtube' ? 'youtube' : playback.mode === 'direct' ? 'video' : getPublicViralVideoKind(videoUrl || sourceUrl);

  return {
    id,
    title,
    summary: pickFirstString(raw.summary, raw.caption, raw.shortCaption, raw.description, raw.excerpt, raw.shortSummary),
    posterImageUrl,
    thumbnailUrl,
    videoFileUrl,
    videoUrl,
    sourceUrl,
    videoType,
    playbackMode,
    category,
    publishedAt,
    language,
    showOnHomepage,
    status,
    slug: pickFirstString(raw.slug, id),
    kind: playback.mode === 'youtube' ? 'youtube' : playback.mode === 'direct' ? 'video' : kind,
    youtubeEmbedUrl: playback.embedUrl,
    raw,
  };
}

export function normalizePublicViralVideosPayload(raw: unknown): PublicViralVideosPayload {
  const root = isRecord(raw) ? raw : null;
  const settings = isRecord(root?.settings)
    ? root?.settings
    : isRecord(root?.data) && isRecord(root.data.settings)
      ? root.data.settings
      : null;
  const frontendEnabled = pickFirstBoolean(settings?.frontendEnabled, settings?.enabled, root?.frontendEnabled, root?.enabled) !== false;
  const ok = root?.ok === false || root?.success === false ? false : true;

  const items = extractItems(raw)
    .map(normalizePublicViralVideo)
    .filter((item): item is PublicViralVideo => Boolean(item))
    .filter((item) => item.status === 'published')
    .sort((a, b) => String(b.publishedAt || '').localeCompare(String(a.publishedAt || '')));

  return {
    ok,
    settings: { frontendEnabled },
    items: frontendEnabled ? items : [],
  };
}
