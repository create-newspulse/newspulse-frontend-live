import {
  DEFAULT_FALLBACK_POLICY,
  getLocalizedArticleFields,
  normalizeRouteLocale,
  STRICT_LOCALE_POLICY,
  type LocaleFallbackPolicy,
  type RouteLocale,
} from './localizedArticleFields';
import { projectPublicNewsArticle } from './publicNewsApi';

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

export function compareArticleFreshness(left: unknown, right: unknown): number | null {
  const leftVersion = getArticleSyncVersion(left);
  const rightVersion = getArticleSyncVersion(right);
  const leftNumeric = /^\d+$/.test(leftVersion);
  const rightNumeric = /^\d+$/.test(rightVersion);
  if (leftNumeric && rightNumeric) {
    const leftNumber = Number(leftVersion);
    const rightNumber = Number(rightVersion);
    if (Number.isSafeInteger(leftNumber) && Number.isSafeInteger(rightNumber)) {
      if (leftNumber !== rightNumber) return leftNumber - rightNumber;
    }
  } else if (!leftNumeric && !rightNumeric) {
    const leftTime = toTimestamp(leftVersion);
    const rightTime = toTimestamp(rightVersion);
    if (leftTime && rightTime && leftTime !== rightTime) return leftTime - rightTime;
  }

  const updatedAt = (article: unknown) => {
    const fields = article && typeof article === 'object' ? article as Record<string, unknown> : {};
    return toTimestamp(fields.updatedAt || fields.publishedAt || fields.createdAt);
  };
  const leftUpdated = updatedAt(left);
  const rightUpdated = updatedAt(right);
  if (leftUpdated && rightUpdated) return leftUpdated - rightUpdated;
  return leftVersion && leftVersion === rightVersion ? 0 : null;
}

function dedupeById<T>(items: T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of items) {
    const id = getArticleId(item);
    const key = id || JSON.stringify(item);
    const previous = byId.get(key);
    // The later read wins ties, including lifecycle edits with unchanged timestamps.
    if (previous === undefined || (compareArticleFreshness(item, previous) ?? 0) >= 0) {
      byId.set(key, item);
    }
  }
  return Array.from(byId.values());
}

export function findFreshestArticleById<T>(articles: T[], id: string): T | undefined {
  return dedupeById(articles.filter((article) => getArticleId(article) === id))[0];
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

  if (!candidates.length) return null;

  const sorted = [...candidates].sort((left, right) => {
    const rankDiff = getArticleRank(right, locale, policy) - getArticleRank(left, locale, policy);
    if (rankDiff !== 0) return rankDiff;

    const freshnessDiff = compareArticleFreshness(right, left) ?? 0;
    if (freshnessDiff !== 0) return freshnessDiff;

    return String((right as any)?._id || '').localeCompare(String((left as any)?._id || ''));
  });

  const picked = sorted.find((item) => getArticleRank(item, locale, policy) >= 0) || null;
  return picked;
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

function hasMaterialValue(value: unknown): boolean {
  if (value == null || value === '') return false;
  if (typeof value !== 'object') return true;
  return Object.values(value).some(hasMaterialValue);
}

function samePublicFields(left: unknown, right: unknown): boolean {
  if (left === right) return true;
  if (!hasMaterialValue(left) && !hasMaterialValue(right)) return true;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length &&
      left.every((value, index) => samePublicFields(value, right[index]));
  }
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const keys = Object.keys(leftRecord).filter((key) => hasMaterialValue(leftRecord[key]));
  return keys.length === Object.keys(rightRecord).filter((key) => hasMaterialValue(rightRecord[key])).length &&
    keys.every((key) => Object.prototype.hasOwnProperty.call(rightRecord, key) && samePublicFields(leftRecord[key], rightRecord[key]));
}

export function shouldReplaceArticleWithFreshCandidate(
  currentArticle: unknown,
  nextArticle: unknown,
  locale: RouteLocale,
  project = projectPublicNewsArticle
): boolean {
  if (!getArticleId(nextArticle)) return false;
  if (!getArticleId(currentArticle)) return true;
  if (getArticleId(currentArticle) !== getArticleId(nextArticle)) return true;
  const freshness = compareArticleFreshness(nextArticle, currentArticle);
  if (freshness !== null && freshness < 0) return false;

  return (
    getArticleSyncVersion(currentArticle) !== getArticleSyncVersion(nextArticle) ||
    // Empty legacy containers can affect alias precedence even without material fields.
    [locale, ...(['en', 'hi', 'gu'] as const).filter((lang) => lang !== locale)].some((lang) => !samePublicFields(
      getLocalizedArticleFields(currentArticle, lang, STRICT_LOCALE_POLICY),
      getLocalizedArticleFields(nextArticle, lang, STRICT_LOCALE_POLICY)
    )) ||
    !samePublicFields(project(currentArticle), project(nextArticle))
  );
}