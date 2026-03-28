import {
  DEFAULT_FALLBACK_POLICY,
  getLocalizedArticleFields,
  normalizeRouteLocale,
  type LocaleFallbackPolicy,
  type RouteLocale,
} from './localizedArticleFields';

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

function getArticleRank(article: any, locale: RouteLocale, policy: LocaleFallbackPolicy = DEFAULT_FALLBACK_POLICY): number {
  const localized = getLocalizedArticleFields(article, locale, policy);
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
  policy?: LocaleFallbackPolicy;
}): T | null {
  const locale = normalizeRouteLocale(options.locale);
  const policy = options.policy || DEFAULT_FALLBACK_POLICY;
  const groupArticles = Array.isArray(options.groupArticles) ? options.groupArticles : [];
  const currentArticle = options.currentArticle || null;
  const candidates = dedupeById([
    ...(currentArticle ? [currentArticle] : []),
    ...groupArticles,
  ]).filter((item) => !!String((item as any)?._id || (item as any)?.id || '').trim());

  if (!candidates.length) return currentArticle as T | null;

  const sorted = [...candidates].sort((left, right) => {
    const rankDiff = getArticleRank(right, locale, policy) - getArticleRank(left, locale, policy);
    if (rankDiff !== 0) return rankDiff;

    const versionDiff = toTimestamp(getArticleSyncVersion(right)) - toTimestamp(getArticleSyncVersion(left));
    if (versionDiff !== 0) return versionDiff;

    const updatedDiff =
      toTimestamp((right as any)?.updatedAt || (right as any)?.publishedAt || (right as any)?.createdAt) -
      toTimestamp((left as any)?.updatedAt || (left as any)?.publishedAt || (left as any)?.createdAt);
    if (updatedDiff !== 0) return updatedDiff;

    return String((right as any)?._id || '').localeCompare(String((left as any)?._id || ''));
  });

  const picked = sorted.find((item) => getArticleRank(item, locale, policy) >= 0) || null;
  return picked || (currentArticle as T | null);
}

function getArticleId(article: any): string {
  return String(article?._id || article?.id || '').trim();
}

function getTranslationGroupId(article: any): string {
  return String(article?.translationGroupId || '').trim();
}

export function pickFreshestArticlesForLocale<T>(options: {
  articles?: T[] | null | undefined;
  locale: RouteLocale;
  policy?: LocaleFallbackPolicy;
}): T[] {
  const locale = normalizeRouteLocale(options.locale);
  const policy = options.policy || DEFAULT_FALLBACK_POLICY;
  const articles = Array.isArray(options.articles) ? options.articles : [];
  const buckets = new Map<string, { order: number; items: T[] }>();

  articles.forEach((article, index) => {
    const groupId = getTranslationGroupId(article as any);
    const articleId = getArticleId(article as any);
    const key = groupId ? `group:${groupId}` : `article:${articleId || index}`;
    const bucket = buckets.get(key);

    if (bucket) {
      bucket.items.push(article);
      return;
    }

    buckets.set(key, {
      order: index,
      items: [article],
    });
  });

  const resolved = Array.from(buckets.values())
    .sort((left, right) => left.order - right.order)
    .map((bucket) => {
      const [currentArticle, ...groupArticles] = bucket.items;
      return pickFreshestArticleForLocale({
        currentArticle,
        groupArticles,
        locale,
        policy,
      });
    })
    .filter((article): article is T => Boolean(article))
    .filter((article) => getLocalizedArticleFields(article as any, locale, policy).isVisible);

  return dedupeById(resolved);
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