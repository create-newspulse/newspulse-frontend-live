export const COVER_PLACEHOLDER_SRC = '/fallback.svg';

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
