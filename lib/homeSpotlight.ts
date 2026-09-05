import { resolveArticleSlug } from './articleSlugs';
import { fetchPublicNews, type Article } from './publicNewsApi';
import { resolveSponsoredContentMeta } from './sponsoredContent';
import { getStoryDateTimeValue } from './storyDateTime';

export const HOME_SPOTLIGHT_SECTION_KEYS = ['national', 'regional', 'international', 'business', 'science-technology', 'sports', 'lifestyle', 'glamour', 'web-stories'] as const;
export const HOME_SPOTLIGHT_PRIMARY_SECTION_KEYS = ['regional', 'national', 'international', 'science-technology', 'sports', 'business', 'youth'] as const;
export const HOME_SPOTLIGHT_FALLBACK_SECTION_KEYS = ['glamour'] as const;
export const HOME_SPOTLIGHT_RENDER_FILTER_KEYS = ['regional', 'national', 'international', 'business', 'science-technology', 'sports', 'lifestyle', 'glamour'] as const;
export const HOME_SPOTLIGHT_MAX_ITEMS = 8;
export const HOME_SPOTLIGHT_MAX_PER_CATEGORY = 2;
export const HOME_SPOTLIGHT_MAX_GLAMOUR_ITEMS = 1;
export const HOME_SPOTLIGHT_SOURCE_LIMIT = 18;
export const HOME_FRESH_SOURCE_LIMIT = 40;

export type HomeSpotlightLang = 'en' | 'hi' | 'gu';
export type HomeSpotlightSectionKey = (typeof HOME_SPOTLIGHT_SECTION_KEYS)[number];

export function normalizeHomeSpotlightCategoryKey(raw: unknown): string {
  const value = String(raw || '').trim().toLowerCase();
  if (!value) return '';
  const aliases: Record<string, string> = {
    tech: 'science-technology',
    technology: 'science-technology',
    'science & technology': 'science-technology',
    'science and technology': 'science-technology',
    'science technology': 'science-technology',
    'science-tech': 'science-technology',
    webstory: 'web-stories',
    webstories: 'web-stories',
    'web stories': 'web-stories',
    'viral videos': 'viral-videos',
    'youth pulse': 'youth',
    'inspiration hub': 'inspiration',
    'community reporter': 'community',
  };
  if (aliases[value]) return aliases[value];

  return value
    .replace(/_/g, '-')
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function collectHomeSpotlightIdentifiers(article: any, lang: HomeSpotlightLang): string[] {
  if (!article || typeof article !== 'object') return [];
  return [
    String(article?._id || article?.id || '').trim().toLowerCase(),
    String(resolveArticleSlug(article, lang) || '').trim().toLowerCase(),
    String(article?.slug || '').trim().toLowerCase(),
    String(article?.title || '').trim().toLowerCase(),
  ].filter(Boolean);
}

export function isHomeSpotlightSponsoredContent(article: any, lang: HomeSpotlightLang): boolean {
  if (!article || typeof article !== 'object') return false;
  const sponsoredMeta = resolveSponsoredContentMeta(article, lang);
  return sponsoredMeta.isFeatureActive === true || sponsoredMeta.isArticle === true;
}

export function buildHomepageSponsoredFeatureIdentitySet(feature: any): Set<string> {
  return new Set(
    [
      String(feature?.linkedArticleId || '').trim().toLowerCase(),
      String(feature?.linkedArticleSlug || '').trim().toLowerCase(),
      String(feature?.headline || '').trim().toLowerCase(),
    ].filter(Boolean)
  );
}

function homeSpotlightIdentity(item: any): string {
  const identifiers = [
    String(item?._id || item?.id || '').trim().toLowerCase(),
    String(item?.slug || '').trim().toLowerCase(),
  ].filter(Boolean);

  return identifiers[0] || identifiers[1] || String(item?.title || '').trim().toLowerCase();
}

function homeSpotlightSortTime(item: any): number {
  const explicitIso = String(item?.iso || '').trim();
  if (explicitIso) {
    const parsed = Date.parse(explicitIso);
    if (Number.isFinite(parsed)) return parsed;
  }

  return getStoryDateTimeValue(item);
}

export function selectHomeSpotlightFeedItems(items: any[], excludedIdentitySet: Set<string>): any[] {
  const seen = new Set<string>();
  const candidates = (Array.isArray(items) ? items : [])
    .map((item) => {
      const identity = homeSpotlightIdentity(item);
      if (!identity || seen.has(identity)) return null;
      if (excludedIdentitySet.has(identity)) return null;

      const sortTime = homeSpotlightSortTime(item);
      if (!sortTime) return null;

      seen.add(identity);

      return {
        identity,
        sortTime,
        categoryKey: normalizeHomeSpotlightCategoryKey(item?.category),
        qualityScore:
          (String(item?.imageSrc || '').trim().length > 0 ? 2 : 0) +
          (String(item?.desc || item?.summary || item?.excerpt || '').trim().length >= 30 ? 1 : 0),
        item,
      };
    })
    .filter(Boolean) as Array<{
      identity: string;
      sortTime: number;
      categoryKey: string;
      qualityScore: number;
      item: any;
    }>;

  const sortedCandidates = candidates.sort((left, right) => {
    if (left.sortTime !== right.sortTime) return right.sortTime - left.sortTime;
    if (left.qualityScore !== right.qualityScore) return right.qualityScore - left.qualityScore;
    return left.identity.localeCompare(right.identity);
  });

  const primaryCandidates = sortedCandidates.filter((candidate) =>
    HOME_SPOTLIGHT_PRIMARY_SECTION_KEYS.includes(candidate.categoryKey as (typeof HOME_SPOTLIGHT_PRIMARY_SECTION_KEYS)[number])
  );
  const glamourCandidates = sortedCandidates.filter((candidate) =>
    HOME_SPOTLIGHT_FALLBACK_SECTION_KEYS.includes(candidate.categoryKey as (typeof HOME_SPOTLIGHT_FALLBACK_SECTION_KEYS)[number])
  );
  const filled: typeof candidates = [];
  const categoryCounts = new Map<string, number>();

  for (let pass = 1; pass <= HOME_SPOTLIGHT_MAX_PER_CATEGORY; pass += 1) {
    for (const candidate of primaryCandidates) {
      if (filled.length >= HOME_SPOTLIGHT_MAX_ITEMS) break;

      const currentCount = categoryCounts.get(candidate.categoryKey) || 0;
      if (currentCount >= pass) continue;

      filled.push(candidate);
      categoryCounts.set(candidate.categoryKey, currentCount + 1);
    }

    if (filled.length >= HOME_SPOTLIGHT_MAX_ITEMS) break;
  }

  for (const candidate of glamourCandidates) {
    if (filled.length >= HOME_SPOTLIGHT_MAX_ITEMS) break;

    const currentCount = categoryCounts.get(candidate.categoryKey) || 0;
    if (currentCount >= HOME_SPOTLIGHT_MAX_GLAMOUR_ITEMS) continue;

    filled.push(candidate);
    categoryCounts.set(candidate.categoryKey, currentCount + 1);
  }

  return filled.slice(0, HOME_SPOTLIGHT_MAX_ITEMS).map((candidate) => candidate.item);
}

export function buildHomeSpotlightItems(options: {
  latestArticles: Article[] | null | undefined;
  sectionArticlesByKey: Partial<Record<HomeSpotlightSectionKey, Article[]>>;
  lang: HomeSpotlightLang;
  articleToFeedItem: (article: Article) => any;
  extraExcludedIdentitySet?: Set<string>;
}): any[] {
  const latestArticles = Array.isArray(options.latestArticles) ? options.latestArticles : [];
  const editorialLatestArticles = latestArticles.filter((article) => !isHomeSpotlightSponsoredContent(article, options.lang));
  const topStory = editorialLatestArticles[0] || null;
  const excludedIdentitySet = new Set<string>(options.extraExcludedIdentitySet || []);
  collectHomeSpotlightIdentifiers(topStory, options.lang).forEach((value) => excludedIdentitySet.add(value));

  const rawHomepageStories = [
    ...editorialLatestArticles,
    ...HOME_SPOTLIGHT_SECTION_KEYS.flatMap((sectionKey) => Array.isArray(options.sectionArticlesByKey[sectionKey]) ? options.sectionArticlesByKey[sectionKey] || [] : []),
  ];

  const feedItems = rawHomepageStories
    .map((article) => {
      const feedItem = options.articleToFeedItem(article as Article);
      const identity = homeSpotlightIdentity({
        _id: (article as any)?._id || (article as any)?.id || feedItem?.id,
        slug: (article as any)?.slug || feedItem?.slug,
        title: feedItem?.title,
      });

      if (!identity || excludedIdentitySet.has(identity)) return null;
      if (isHomeSpotlightSponsoredContent(article, options.lang)) return null;
      if (!getStoryDateTimeValue(article)) return null;

      return feedItem;
    })
    .filter(Boolean);

  return selectHomeSpotlightFeedItems(feedItems, excludedIdentitySet);
}

export async function fetchHomeSpotlightSectionArticles(options: {
  lang: HomeSpotlightLang;
  signal: AbortSignal;
}): Promise<Partial<Record<HomeSpotlightSectionKey, Article[]>>> {
  const sectionEntries = await Promise.all(
    HOME_SPOTLIGHT_SECTION_KEYS.map(async (sectionKey) => {
      const response = await fetchPublicNews({
        category: sectionKey,
        language: options.lang,
        limit: HOME_SPOTLIGHT_SOURCE_LIMIT,
        extraQuery: { strictLocale: '1' },
        signal: options.signal,
      });

      const items = Array.isArray(response?.items)
        ? response.items
            .filter((article) => !isHomeSpotlightSponsoredContent(article, options.lang))
            .slice()
            .sort((left, right) => getStoryDateTimeValue(right) - getStoryDateTimeValue(left))
        : [];

      return [sectionKey, items] as const;
    })
  );

  return Object.fromEntries(sectionEntries);
}