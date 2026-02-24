export const COVER_PLACEHOLDER_SRC = '/fallback.jpg';

export function resolveCoverImageUrl(article: any): string {
  const url =
    (typeof article?.coverImage?.url === 'string' ? article.coverImage.url : '') ||
    (typeof article?.coverImageUrl === 'string' ? article.coverImageUrl : '');

  return String(url || '').trim();
}
