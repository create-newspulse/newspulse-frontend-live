import { getLocalizedArticleFields, normalizeRouteLocale, type RouteLocale } from './localizedArticleFields';

function normalizeArticleLocale(article: any): RouteLocale | null {
  const raw = String(article?.sourceLang || article?.sourceLanguage || article?.language || article?.lang || '').trim();
  if (!raw) return null;
  return normalizeRouteLocale(raw);
}

function toTimestamp(value: unknown): number {
  const raw = String(value || '').trim();
  if (!raw) return 0;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getArticleSyncVersion(article: any): string {
  return String(
    article?.syncVersion ||
    article?.translationSyncVersion ||
    article?.version ||
    article?.updatedAt ||
    article?.publishedAt ||
    article?.createdAt ||
    ''
  ).trim();
}

function getArticleRank(article: any, locale: RouteLocale): number {
  const localized = getLocalizedArticleFields(article, locale);
  if (!localized.isVisible) return -1;

  const articleLocale = normalizeArticleLocale(article);
  if (articleLocale === locale) return localized.translationFound ? 5 : 4;
  if (localized.translationFound) return 3;
  return 1;
}

function dedupeById<T>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const id = String((item as any)?._id || (item as any)?.id || '').trim();
    const key = id || JSON.stringify(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export function pickFreshestArticleForLocale<T>(options: {
  currentArticle: T | null | undefined;
  groupArticles?: T[] | null | undefined;
  locale: RouteLocale;
}): T | null {
  const locale = normalizeRouteLocale(options.locale);
  const groupArticles = Array.isArray(options.groupArticles) ? options.groupArticles : [];
  const currentArticle = options.currentArticle || null;
  const candidates = dedupeById([
    ...(currentArticle ? [currentArticle] : []),
    ...groupArticles,
  ]).filter((item) => !!String((item as any)?._id || (item as any)?.id || '').trim());

  if (!candidates.length) return currentArticle as T | null;

  const sorted = [...candidates].sort((left, right) => {
    const rankDiff = getArticleRank(right, locale) - getArticleRank(left, locale);
    if (rankDiff !== 0) return rankDiff;

    const versionDiff = toTimestamp(getArticleSyncVersion(right)) - toTimestamp(getArticleSyncVersion(left));
    if (versionDiff !== 0) return versionDiff;

    const updatedDiff =
      toTimestamp((right as any)?.updatedAt || (right as any)?.publishedAt || (right as any)?.createdAt) -
      toTimestamp((left as any)?.updatedAt || (left as any)?.publishedAt || (left as any)?.createdAt);
    if (updatedDiff !== 0) return updatedDiff;

    return String((right as any)?._id || '').localeCompare(String((left as any)?._id || ''));
  });

  const picked = sorted.find((item) => getArticleRank(item, locale) >= 0) || null;
  return picked || (currentArticle as T | null);
}

export function shouldReplaceArticleWithFreshCandidate(currentArticle: any, nextArticle: any, locale: RouteLocale): boolean {
  if (!nextArticle?._id) return false;
  if (!currentArticle?._id) return true;

  const currentLocalized = getLocalizedArticleFields(currentArticle, locale);
  const nextLocalized = getLocalizedArticleFields(nextArticle, locale);

  return (
    String(currentArticle?._id || '').trim() !== String(nextArticle?._id || '').trim() ||
    getArticleSyncVersion(currentArticle) !== getArticleSyncVersion(nextArticle) ||
    String(currentLocalized.bodyHtml || '').trim() !== String(nextLocalized.bodyHtml || '').trim() ||
    String(currentLocalized.title || '').trim() !== String(nextLocalized.title || '').trim() ||
    String(currentLocalized.slug || '').trim() !== String(nextLocalized.slug || '').trim()
  );
}