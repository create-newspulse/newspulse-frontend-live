export const COVER_PLACEHOLDER_SRC = '/fallback.svg';

export type CoverFitMode = 'photo' | 'graphic';
export type CoverFitModePreference = CoverFitMode | 'auto';

const GRAPHIC_COVER_HINT_RE = /(infographic|graphic|chart|diagram|poster|scorecard|standings|statistics|stat-card|results-card|fixture|schedule|lineup|table|quote-card|explainer|screenshot)/i;

function isBadCoverUrl(url: string): boolean {
  const u = String(url || '').trim();
  if (!u) return true;

  // Allow same-origin absolute paths.
  if (u.startsWith('/')) return false;

  // Guard against file input values accidentally saved by admin UI.
  if (/fakepath/i.test(u)) return true;
  if (/^[a-zA-Z]:\\/.test(u)) return true; // C:\...
  if (u.startsWith('\\\\')) return true; // UNC path

  // Guard against local/object URLs (not persisted / not shareable)
  if (/^(blob:|data:|file:)/i.test(u)) return true;

  try {
    const parsed = new URL(u);
    return parsed.protocol !== 'http:' && parsed.protocol !== 'https:';
  } catch {
    // If it isn't a valid absolute URL, treat as invalid.
    return true;
  }
}

function coercePositiveNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return null;
}

function normalizeCoverFitMode(value: unknown): CoverFitMode | null {
  const normalized = String(value || '').trim().toLowerCase();
  if (!normalized) return null;

  if (['graphic', 'infographic', 'illustration', 'chart', 'diagram', 'poster', 'screenshot', 'contain'].includes(normalized)) {
    return 'graphic';
  }

  if ([
    'photo',
    'photograph',
    'image',
    'hero',
    'cover-photo',
    'coverphoto',
    'cover-image',
    'coverimage',
    'fill',
    'cover-fill',
    'coverfill',
    'object-cover',
  ].includes(normalized)) {
    return 'photo';
  }

  return null;
}

function resolveExplicitCoverFitMode(article: any): CoverFitMode | null {
  const candidates = [
    article?.coverFitMode,
    article?.coverFit,
    article?.imageFit,
    article?.heroImageMode,
    article?.heroImageFit,
    article?.coverType,
    article?.coverKind,
    article?.coverImage?.fit,
    article?.coverImage?.mode,
    article?.coverImage?.type,
    article?.coverImage?.kind,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeCoverFitMode(candidate);
    if (normalized) return normalized;
  }

  return null;
}

function resolveCoverDimensions(article: any): { width: number | null; height: number | null } {
  const width =
    coercePositiveNumber(article?.coverImage?.width) ??
    coercePositiveNumber(article?.imageWidth) ??
    coercePositiveNumber(article?.coverWidth) ??
    null;
  const height =
    coercePositiveNumber(article?.coverImage?.height) ??
    coercePositiveNumber(article?.imageHeight) ??
    coercePositiveNumber(article?.coverHeight) ??
    null;

  return { width, height };
}

export function resolveCoverImageUrl(article: any): string {
  const candidates = [
    typeof article?.coverImage?.url === 'string' ? article.coverImage.url : '',
    typeof article?.coverImageUrl === 'string' ? article.coverImageUrl : '',
    typeof article?.imageUrl === 'string' ? article.imageUrl : '',
    typeof article?.imageURL === 'string' ? article.imageURL : '',
    typeof article?.image?.url === 'string' ? article.image.url : '',
    typeof article?.image === 'string' ? article.image : '',
    typeof article?.urlToImage === 'string' ? article.urlToImage : '',
    typeof article?.thumbnailUrl === 'string' ? article.thumbnailUrl : '',
  ];

  for (const raw of candidates) {
    const url = String(raw || '').trim();
    if (!url) continue;
    if (!isBadCoverUrl(url)) return url;
  }
  return '';
}

export function inferAutoCoverFitMode(options: {
  src?: string | null;
  width?: number | null;
  height?: number | null;
}): CoverFitMode {
  const src = String(options.src || '').trim();
  if (src && GRAPHIC_COVER_HINT_RE.test(src)) return 'graphic';

  const width = coercePositiveNumber(options.width);
  const height = coercePositiveNumber(options.height);
  if (!width || !height) return 'photo';

  const aspectRatio = width / height;
  if (aspectRatio >= 2.1 || aspectRatio <= 0.7) return 'graphic';
  if (aspectRatio >= 0.92 && aspectRatio <= 1.08) return 'graphic';

  return 'photo';
}

export function resolveArticleCoverFitPreference(article: any): CoverFitModePreference {
  const explicit = resolveExplicitCoverFitMode(article);
  if (explicit) return explicit;

  const coverSrc = resolveCoverImageUrl(article);
  if (coverSrc && GRAPHIC_COVER_HINT_RE.test(coverSrc)) return 'graphic';

  const { width, height } = resolveCoverDimensions(article);
  if (width && height) {
    return inferAutoCoverFitMode({ src: coverSrc, width, height });
  }

  return 'auto';
}

export function getCoverImageSrc(article: any): string {
  return resolveCoverImageUrl(article) || COVER_PLACEHOLDER_SRC;
}

export function onCoverImageError(e: any) {
  const img = e?.currentTarget as HTMLImageElement | undefined;
  if (!img) return;
  // Prevent infinite loop if placeholder is missing.
  img.onerror = null;
  img.src = COVER_PLACEHOLDER_SRC;
}
