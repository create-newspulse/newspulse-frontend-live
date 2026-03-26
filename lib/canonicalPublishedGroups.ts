import { getLocalizedArticleFields, type RouteLocale } from './localizedArticleFields';

export type CanonicalizeGroupsOptions = {
  // Reserved for future use.
};

function safeString(value: unknown): string {
  return String(value ?? '').trim();
}

function parseIsoMs(value: unknown): number {
  const raw = safeString(value);
  if (!raw) return 0;
  const ms = Date.parse(raw);
  return Number.isFinite(ms) ? ms : 0;
}

export function getArticleGroupKey(article: any): string {
  const tg = safeString(article?.translationGroupId);
  if (tg) return `tg:${tg}`;

  const tk = safeString(article?.translationKey);
  if (tk) return `tk:${tk}`;

  const id = safeString(article?._id);
  if (id) return `id:${id}`;

  const slug = safeString(article?.slug);
  if (slug) return `slug:${slug}`;

  return 'unknown';
}

export function getArticlePublishedMs(article: any): number {
  return (
    parseIsoMs(article?.publishedAt) ||
    parseIsoMs(article?.createdAt) ||
    parseIsoMs(article?.updatedAt) ||
    0
  );
}

function pickBestRepresentative(
  candidates: any[],
  requestedLocale: RouteLocale,
  options: CanonicalizeGroupsOptions
): any | null {
  const sorted = [...candidates].sort((a, b) => getArticlePublishedMs(b) - getArticlePublishedMs(a));

  for (const it of sorted) {
    const localized = getLocalizedArticleFields(it, requestedLocale);
    if (localized.isVisible) return it;
  }

  return null;
}

/**
 * Canonicalizes a list response so every story group contributes at most one item,
 * preferring the requested-locale variant, and (optionally) falling back to source/original.
 */
export function canonicalizePublishedStoryGroups<T = any>(
  items: T[],
  requestedLocale: RouteLocale,
  options: CanonicalizeGroupsOptions = {}
): T[] {
  const input = Array.isArray(items) ? items : [];
  const groups: Record<string, any[]> = Object.create(null);

  for (const raw of input) {
    const it = raw as any;
    if (!it || typeof it !== 'object') continue;
    const k = getArticleGroupKey(it);
    const bucket = groups[k];
    if (bucket) bucket.push(it);
    else groups[k] = [it];
  }

  const picked: any[] = [];
  for (const k of Object.keys(groups)) {
    const bucket = groups[k] || [];
    const rep = pickBestRepresentative(bucket, requestedLocale, options);
    if (rep) picked.push(rep);
  }

  picked.sort((a, b) => getArticlePublishedMs(b) - getArticlePublishedMs(a));
  return picked as T[];
}
