export const COVER_PLACEHOLDER_SRC = '/images/placeholder.jpg';

function isBadCoverUrl(url: string): boolean {
  const u = String(url || '').trim();
  if (!u) return true;

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

// Standard source of truth: ONLY article.coverImage?.url
export function resolveCoverImageUrl(article: any): string {
  const raw = typeof article?.coverImage?.url === 'string' ? article.coverImage.url : '';
  const url = String(raw || '').trim();
  return isBadCoverUrl(url) ? '' : url;
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
