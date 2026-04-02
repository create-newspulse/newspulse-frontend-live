export const COVER_PLACEHOLDER_SRC = '/fallback.svg';

export type CoverFitMode = 'cover' | 'contain';

function readText(value: unknown): string {
  return String(value || '').trim();
}

export function normalizeCoverFitMode(value: unknown): CoverFitMode | null {
  const raw = readText(value).toLowerCase();
  if (!raw) return null;
  if (raw === 'contain' || raw === 'fit-contain' || raw === 'object-contain' || raw === 'letterbox') return 'contain';
  if (raw === 'cover' || raw === 'fit-cover' || raw === 'object-cover' || raw === 'crop') return 'cover';
  return null;
}

function pickFirstFiniteNumber(values: unknown[]): number | null {
  for (const value of values) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function looksLikeInfographicText(text: string): boolean {
  return /(infographic|info-graphic|graphic|poster|flyer|chart|table|map|diagram|screenshot|scorecard|lineup|schedule|notice|banner|quote-card|quotecard|explainer|results?-card|fixture|price-list|brochure|leaflet|document)/i.test(text);
}

function extractImageMeta(article: any) {
  const media0 = Array.isArray(article?.media) ? article.media?.[0] : undefined;
  const coverImage = article?.coverImage;
  const image = article?.image;
  const thumbnail = article?.thumbnail;

  return {
    explicitFitMode:
      normalizeCoverFitMode(article?.coverFitMode) ||
      normalizeCoverFitMode(article?.fitMode) ||
      normalizeCoverFitMode(article?.imageFit) ||
      normalizeCoverFitMode(article?.objectFit) ||
      normalizeCoverFitMode(coverImage?.fitMode) ||
      normalizeCoverFitMode(coverImage?.coverFitMode) ||
      normalizeCoverFitMode(coverImage?.objectFit) ||
      normalizeCoverFitMode(image?.fitMode) ||
      normalizeCoverFitMode(image?.coverFitMode) ||
      normalizeCoverFitMode(image?.objectFit) ||
      normalizeCoverFitMode(thumbnail?.fitMode) ||
      normalizeCoverFitMode(media0?.fitMode) ||
      null,
    width: pickFirstFiniteNumber([
      article?.coverWidth,
      article?.imageWidth,
      coverImage?.width,
      image?.width,
      thumbnail?.width,
      media0?.width,
    ]),
    height: pickFirstFiniteNumber([
      article?.coverHeight,
      article?.imageHeight,
      coverImage?.height,
      image?.height,
      thumbnail?.height,
      media0?.height,
    ]),
  };
}

export function inferCoverFitMode(options?: {
  src?: unknown;
  altText?: unknown;
  width?: unknown;
  height?: unknown;
}): CoverFitMode {
  const src = readText(options?.src).toLowerCase();
  const altText = readText(options?.altText).toLowerCase();
  const width = pickFirstFiniteNumber([options?.width]);
  const height = pickFirstFiniteNumber([options?.height]);
  const aspectRatio = width && height ? width / height : null;

  if (src.endsWith('.svg') || src.includes('.svg?')) return 'contain';
  if (looksLikeInfographicText(src) || looksLikeInfographicText(altText)) return 'contain';
  if (aspectRatio && (aspectRatio >= 1.95 || aspectRatio <= 0.8)) return 'contain';

  return 'cover';
}

export const inferAutoCoverFitMode = inferCoverFitMode;

export function resolveImageFitMode(options?: {
  fitMode?: unknown;
  src?: unknown;
  altText?: unknown;
  width?: unknown;
  height?: unknown;
}): CoverFitMode {
  return normalizeCoverFitMode(options?.fitMode) || inferCoverFitMode(options);
}

export function resolveCoverFitMode(article: any, options?: { src?: unknown; altText?: unknown }): CoverFitMode {
  const meta = extractImageMeta(article);
  const src = readText(options?.src) || resolveCoverImageUrl(article);

  return resolveImageFitMode({
    fitMode: meta.explicitFitMode,
    src,
    altText: options?.altText,
    width: meta.width,
    height: meta.height,
  });
}

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
