export type PublicViralVideoKind = 'youtube' | 'video' | 'external' | 'unsupported';

export type PublicViralVideo = {
  id: string;
  title: string;
  summary: string;
  thumbnailUrl: string;
  videoUrl: string;
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
  const status = pickFirstString(item.status, item.state, item.publishStatus, item.visibility).toLowerCase();
  if (status) return status;
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

export function normalizePublicViralVideo(raw: unknown): PublicViralVideo | null {
  if (!isRecord(raw)) return null;

  const video = isRecord(raw.video) ? raw.video : null;
  const media = Array.isArray(raw.media) ? raw.media.find(isRecord) || null : isRecord(raw.media) ? raw.media : null;
  const id = pickFirstString(raw._id, raw.id, raw.uuid, raw.slug);
  const title = pickFirstString(raw.title, raw.headline, raw.name, video?.title);
  const thumbnailUrl = pickFirstString(
    raw.thumbnailUrl,
    raw.thumbnail,
    raw.posterImage,
    raw.posterUrl,
    raw.poster,
    raw.imageUrl,
    raw.image,
    video?.thumbnailUrl,
    video?.posterImage,
    video?.posterUrl,
    media?.thumbnailUrl,
    media?.posterImage,
    media?.posterUrl
  );
  const videoUrl = pickFirstString(raw.videoUrl, raw.sourceUrl, raw.url, raw.embedUrl, video?.videoUrl, video?.sourceUrl, video?.url, video?.embedUrl, media?.videoUrl, media?.sourceUrl, media?.url);
  if (!id || !title || !videoUrl) return null;

  const status = normalizeStatus(raw);
  const showOnHomepage = pickFirstBoolean(raw.showOnHomepage, raw.homepageFeatured, raw.isHomepageFeatured, raw.featured, raw.showHome, raw.homepage) === true;
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
  const kind = getPublicViralVideoKind(videoUrl);

  return {
    id,
    title,
    summary: pickFirstString(raw.summary, raw.caption, raw.shortCaption, raw.description, raw.excerpt, raw.shortSummary),
    thumbnailUrl,
    videoUrl,
    category,
    publishedAt,
    language,
    showOnHomepage,
    status,
    slug: pickFirstString(raw.slug, id),
    kind,
    youtubeEmbedUrl: kind === 'youtube' ? getYouTubeEmbedUrl(videoUrl) : '',
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
