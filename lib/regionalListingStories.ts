import { resolveArticleSlug } from './articleSlugs';
import { resolveCoverImageUrl } from './coverImages';
import { getLocalizedArticleFields, getLocaleTranslationStatus, normalizeRouteLocale } from './localizedArticleFields';
import { selectRegionalInitialStories } from './regionalInitialStories';

const LISTING_FIELDS = [
  '_id', 'id', 'slug', 'title', 'headline', 'shortTitle', 'summary', 'excerpt', 'time', 'titleIsOriginal',
  'category', 'categoryName', 'section', 'topic', 'tags',
  'language', 'lang', 'sourceLang', 'sourceLanguage',
  'status', 'state', 'published', 'isPublished', 'deleted', 'isDeleted', 'deletedAt',
  'archived', 'isArchived', 'archivedAt', 'publishedAt', 'publishAt', 'createdAt', 'updatedAt',
  'district', 'districtName', 'districtSlug', 'district_slug', 'districtCode', 'district_code', 'districtId', 'district_id',
] as const;

export type RegionalListingStory = Record<string, unknown> & {
  imageUrl: string;
  regionalReadMinutes: number;
};

export function getRegionalReadMinutes(story: Record<string, unknown>): number {
  const cached = story.regionalReadMinutes;
  if (typeof cached === 'number' && Number.isInteger(cached) && cached >= 1) return cached;
  const title = typeof story.title === 'string' ? story.title.trim() : '';
  const summary = typeof story.summary === 'string' ? story.summary.trim() : '';
  const text = `${title} ${summary} ${String(story.content || '').trim()}`;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

export function compactRegionalInitialStories(payload: unknown, locale: string): RegionalListingStory[] {
  const requestedLocale = normalizeRouteLocale(locale);
  return selectRegionalInitialStories(payload, locale).map((story: Record<string, unknown>) => {
    const localized = getLocalizedArticleFields(story, requestedLocale);
    const translationStatus = getLocaleTranslationStatus(story, requestedLocale);
    const result: RegionalListingStory = {
      imageUrl: resolveCoverImageUrl(story),
      regionalReadMinutes: getRegionalReadMinutes(story),
      translations: {
        [requestedLocale]: {
          title: localized.title,
          slug: resolveArticleSlug(story, requestedLocale),
          // READY checks still require real localized body evidence after hydration.
          ...(translationStatus === 'READY' ? { content: localized.bodyHtml.slice(0, 256) } : {}),
        },
      },
    };
    if (translationStatus) result.translationStatus = { [requestedLocale]: translationStatus };
    for (const field of LISTING_FIELDS) {
      if (story[field] !== undefined) result[field] = story[field];
    }
    for (const field of ['location', 'geo', 'region']) {
      const value = story[field];
      if (value && typeof value === 'object' && 'district' in value && value.district !== undefined) {
        result[field] = { district: value.district };
      }
    }
    return result;
  });
}
