import { getPublicApiBaseUrl } from './publicApiBase';
import { getCategoryQueryKey } from './categoryKeys';
import { filterPubliclyPublishedArticles, getPublicArticleStatus } from './localizedArticleFields';
import type { AuthorBylinePayload } from './authorByline';
import { getOrdinaryCategoryPagination, ORDINARY_PAGINATION_HEADER, validateOrdinaryPageRequest, type OrdinaryCategoryPagination } from './ordinaryCategoryPagination';
import { FAITH_CULTURE_NEWS_UNAVAILABLE, FAITH_CULTURE_PAGINATION_HEADER, getFaithCulturePagination, validateFaithCulturePageRequest } from './faithCulturePagination';
import { getFaithCultureTopic } from './faithCultureTopics';
import { getSafeRetryAfter } from './retryAfter';

export type ArticleBase = {
  _id: string;
  title?: string;
  slug?: string;
  translationGroupId?: string;
  translationKey?: string;
  updatedAt?: string;
  version?: string;
  syncVersion?: string;
  translationSyncVersion?: string;
  summary?: string;
  excerpt?: string;
  content?: string;
  html?: string;
  body?: string;
  image?: string;
  imageUrl?: string;
  coverImageUrl?: string;
  coverImage?: {
    url?: string;
    publicId?: string;
  };
  createdAt?: string;
  publishedAt?: string;
  category?: string;
  language?: string;
  authorByline?: AuthorBylinePayload | null;
  pulseDialogue?: {
    contributorId?: string | null;
    dialogueFormat?: string | null;
    series?: string | null;
    bylineDesignationOverride?: string | null;
    bylineSnapshot?: {
      name?: string | null;
      designation?: string | null;
      affiliation?: string | null;
      photo?: {
        url?: string | null;
        publicId?: string | null;
        alt?: string | null;
      } | null;
      photoUrl?: string | null;
      contributorPhotoUrl?: string | null;
      photoAlt?: string | null;
      contributorPhotoAlt?: string | null;
    } | null;
    contributorPhotoUrl?: string | null;
    contributorPhotoAlt?: string | null;
    contributorDisclosure?: string | null;
    editorNote?: string | null;
    contributorDisclaimer?: string | null;
    showAboutContributor?: boolean | null;
    contributor?: {
      id?: string | null;
      name?: string | null;
      canonicalName?: string | null;
      photo?: {
        url?: string | null;
        publicId?: string | null;
        alt?: string | null;
      } | null;
      photoUrl?: string | null;
      contributorPhotoUrl?: string | null;
      photoAlt?: string | null;
      contributorPhotoAlt?: string | null;
      publicDesignation?: string | null;
      affiliation?: string | null;
      shortBio?: string | null;
      slug?: string | null;
      website?: string | null;
      socialLinks?: Record<string, string> | null;
    } | null;
  } | null;
};

export type Article = ArticleBase & {
  translations?: Record<string, Partial<ArticleBase> | boolean | undefined>;
};

export function getApiOrigin() {
  // Keep name for back-compat, but source is now NEXT_PUBLIC_API_BASE.
  return getPublicApiBaseUrl();
}

export function unwrapArticles(payload: any): Article[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload as Article[];

  const candidates = [payload.articles, payload.items, payload.data, payload.result];
  for (const c of candidates) {
    if (Array.isArray(c)) return c as Article[];
  }

  return [];
}

export function unwrapArticle(payload: any): Article | null {
  if (!payload) return null;
  if (payload.article && typeof payload.article === 'object') return payload.article as Article;
  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) return payload.data as Article;
  if (typeof payload === 'object' && !Array.isArray(payload) && payload._id) return payload as Article;
  return null;
}

function responseRecord(payload: unknown): Record<string, unknown> | null {
  return payload && typeof payload === 'object' && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : null;
}

function failedPublicNewsPayload(payload: Record<string, unknown> | null): boolean {
  return Boolean(payload && (
    payload.ok === false || payload.success === false || payload.error ||
    (Array.isArray(payload.errors) ? payload.errors.length : payload.errors) ||
    payload.stack || payload.stackTrace
  ));
}

type PublicFields = { [field: string]: true | PublicFields };

function publicScalars(names: string): PublicFields {
  return Object.fromEntries(names.split(/\s+/).filter(Boolean).map((name) => [name, true]));
}

function publicLocales(fields: true | PublicFields): PublicFields {
  return { en: fields, hi: fields, gu: fields, in: fields };
}

const publicText = publicScalars('text value html content body label name displayName fullName designation role slug key title status translationStatus');
const publicLocalizedText: PublicFields = {
  ...publicText, ...publicLocales(publicText), value: { ...publicText, ...publicLocales(publicText) },
};
const localizedFieldNames = 'title headline name summary excerpt description dek html content body bodyHtml slug categoryLabel categoryName category section'.split(' ');
const publicTextFields: PublicFields = Object.fromEntries(localizedFieldNames.map((field) => [field, publicLocalizedText]));
for (const locale of ['en', 'hi', 'gu', 'in']) {
  for (const field of localizedFieldNames) {
    for (const alias of [
      `${field}_${locale}`, `${field}${locale[0].toUpperCase()}${locale.slice(1)}`,
      `${locale}_${field}`, `${locale}${field[0].toUpperCase()}${field.slice(1)}`,
      ...(field === 'slug' ? [`slug${locale.toUpperCase()}`] : []),
    ]) publicTextFields[alias] = publicLocalizedText;
  }
}

const mediaScalars = publicScalars(
  'url src assetUrl mediaUrl secureUrl secure_url cloudinaryUrl publicId alt altText caption credit ' +
  'width height fitMode coverFitMode objectFit status mediaStatus state'
);
let publicMedia: PublicFields = mediaScalars;
for (let depth = 0; depth < 4; depth += 1) {
  publicMedia = {
    ...mediaScalars, ...publicLocales(publicMedia),
    ...Object.fromEntries('asset image media file photo cover thumbnail'.split(' ').map((field) => [field, publicMedia])),
  };
}
const publicImages: PublicFields = {
  ...Object.fromEntries(
    ('image images coverImage coverImages heroImage featuredImage thumbnail media imageUrl imageURL coverImageUrl featuredImageUrl thumbnailUrl')
      .split(' ').map((field) => [field, publicMedia])
  ),
  ...publicScalars(
    'coverFitMode fitMode imageFit objectFit ' +
    'coverWidth coverHeight imageWidth imageHeight imageCaption caption featuredImageCaption imageCredit credit ' +
    'photoCredit featuredImageCredit imageAlt imageAltText altText alt'
  ),
};
const publicSeo = publicScalars(
  'pageTitle seoTitle metaTitle title metaDescription seoDescription description summary excerpt ogTitle openGraphTitle ' +
  'ogDescription openGraphDescription socialDescription ogImage openGraphImage image twitterTitle twitterDescription twitterImage ' +
  'canonicalUrl canonical url robots'
);
const publicSeoFields: PublicFields = Object.fromEntries(
  ['seo', 'meta', 'openGraph', 'og'].map((field) => [field, { ...publicSeo, ...publicLocales(publicSeo) }])
);
const publicByline = publicScalars('name publicDesignation photoUrl shortBio designation affiliation photoAlt contributorPhotoUrl contributorPhotoAlt');
const publicSponsorScalars = publicScalars(
  'sponsorName brandName brand advertiserName partnerName sponsoredBy sponsorDisclosure disclosure disclaimer sponsoredDisclosure ' +
  'sponsorshipDisclosure partnerDisclosure advertiserDisclosure isSponsored sponsored isSponsoredContent isPartnerContent isBrandedContent ' +
  'isSponsoredFeature sponsoredFeatureActive featureActive isSponsoredArticle isPartnerArticle partnerArticle sponsoredStatus ' +
  'sponsoredFeatureStatus sponsoredArticleStatus campaignStatus sponsoredStartAt campaignStartAt startAt startsAt startDate goLiveAt ' +
  'sponsoredEndAt campaignEndAt endAt endsAt endDate expiresAt linkedArticleSlug sponsoredArticleSlug targetArticleSlug destinationArticleSlug ' +
  'articleSlug linkedArticleId sponsoredArticleId targetArticleId destinationArticleId linkedSponsoredArticleId linkedSponsoredArticleSlug ' +
  'destinationUrl targetUrl linkUrl ctaUrl href url permalink canonicalUrl sponsorFeatureLinkedId linkedSponsoredFeatureId linkedFeatureId ' +
  'sponsoredFeatureId featureId campaignId featureStatus active enabled _id id published isPublished status ' +
  'ctaText ctaLabel buttonText buttonLabel actionLabel actionText linkText sponsorCtaText sponsorCtaLabel sponsorDestinationUrl sponsorDestinationHref sponsorTargetUrl sponsorCtaUrl ' +
  'tag label badge featureType featureLabel type storyType articleType contentType format placement slot position topic'
);
const publicSponsor: PublicFields = {
  ...publicSponsorScalars,
  ...Object.fromEntries('tags labels badges keywords topics'.split(' ').map((field) => [field, publicText])),
  ...Object.fromEntries(
    'callToAction cta ctaButton action sponsorCallToAction sponsorCta sponsorButton'.split(' ')
      .map((field) => [field, publicScalars('label text title name buttonText url href link targetUrl destinationUrl linkUrl ctaUrl')])
  ),
};
const publicSponsorFields: PublicFields = {
  ...publicSponsor,
  ...Object.fromEntries(
    ('sponsoredContent sponsorship sponsor sponsorDetails sponsorMeta sponsoredArticle brandedContent partnerContent advertiser ' +
    'linkedSponsoredFeature linkedFeature homepageSponsoredFeature sponsoredFeature sponsoredCampaign campaign promotion promo')
      .split(' ').map((field) => [field, publicSponsor])
  ),
};
const publicArticleFields: PublicFields = {
  ...publicSeo, ...publicSeoFields, ...publicSponsorFields, ...publicTextFields, ...publicImages,
  ...publicScalars(
    '_id id translationGroupId translationKey updatedAt modifiedAt createdAt publishedAt publishAt publishDate ' +
    'syncVersion translationSyncVersion version status state deleted isDeleted deletedAt archived isArchived archivedAt isPublished published ' +
    'language lang sourceLang sourceLanguage provider generatedAt sourceNewsId categoryKey region district desk type editorialType editorial_type ' +
    'storyType story_type authorName writerName reporterName createdByName userName authorDesignation authorRole authorTitle designation bylineDesignation ' +
    'readingTime readTime readingTimeText estimatedReadingTime readingMinutes readTimeMinutes estimatedReadMinutes ' +
    'originalTitle sourceTitle titleOriginal originalSummary sourceSummary summaryOriginal originalExcerpt sourceExcerpt excerptOriginal ' +
    'originalContent sourceContent contentOriginal originalHtml sourceHtml htmlOriginal originalBody sourceBody bodyOriginal ' +
    'seoSlug originalSlug sourceSlug baseSlug canonicalSlug'
  ),
  source: publicScalars('title summary excerpt content html body'),
  slugs: publicLocales(publicText),
  translationStatus: publicLocales(true),
  author: publicScalars('name displayName fullName title label designation role'),
  byline: publicScalars('name displayName fullName title label designation role'),
  authorByline: { enabled: true, snapshot: publicByline },
  pulseDialogue: {
    ...publicScalars(
      'contributorId contributorSlug profileAvailable dialogueFormat series bylineDesignationOverride contributorPhotoUrl ' +
      'contributorPhotoAlt contributorDisclosure editorNote contributorDisclaimer showAboutContributor'
    ),
    bylineSnapshot: { ...publicByline, photo: publicMedia },
    contributor: {
      ...publicByline, ...publicScalars('id canonicalName slug website'), photo: publicMedia,
      socialLinks: publicScalars('website facebook instagram twitter x linkedin youtube'),
    },
  },
};
for (const field of (
  'authorName writerName reporterName createdByName userName authorDesignation authorRole authorTitle designation bylineDesignation ' +
  'readingTime readTime readingTimeText estimatedReadingTime imageCaption caption featuredImageCaption imageCredit credit photoCredit ' +
  'featuredImageCredit imageAlt imageAltText altText alt'
).split(' ')) publicArticleFields[field] = publicText;
publicArticleFields.meta = { ...publicSeo, ...publicLocales(publicSeo), ...publicSponsorFields };
for (const field of ['metadata', 'attributes', 'flags', 'settings']) publicArticleFields[field] = publicSponsorFields;
const publicTranslationFields: PublicFields = {
  ...publicArticleFields,
  ...Object.fromEntries(localizedFieldNames.map((field) => [field, publicLocalizedText])),
};
for (const field of ['translations', 'translation', 'i18n', 'localized', 'locales', 'byLang', 'textByLang']) {
  publicArticleFields[field] = {
    ...publicLocales(publicTranslationFields),
    ...Object.fromEntries(localizedFieldNames.map((name) => [name, publicLocales(publicText)])),
  };
}

function projectPublicFields(record: Record<string, unknown>, fields: PublicFields): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, selection] of Object.entries(fields)) {
    const value = record[key];
    if (value === undefined) continue;
    const project = (entry: unknown): unknown => {
      if (entry === null || ['string', 'number', 'boolean'].includes(typeof entry)) return entry;
      const nested = responseRecord(entry);
      return nested && selection !== true ? projectPublicFields(nested, selection) : undefined;
    };
    const projected = Array.isArray(value) ? value.map(project).filter((entry) => entry !== undefined) : project(value);
    if (projected !== undefined) result[key] = projected;
  }
  return result;
}

/** The same bounded public field selection is used by the read boundary and refresh comparison. */
export function projectPublicNewsArticle(article: unknown): Record<string, unknown> {
  return projectPublicFields(responseRecord(article) || {}, publicArticleFields);
}

function hasPublicRecordDiagnostics(record: Record<string, unknown>, fields: PublicFields): boolean {
  if (failedPublicNewsPayload(record)) return true;
  return Object.entries(fields).some(([key, selection]) => {
    if (selection === true) return false;
    const value = record[key];
    const values = Array.isArray(value) ? value : [value];
    return values.some((value) => {
      const nested = responseRecord(value);
      return Boolean(nested && hasPublicRecordDiagnostics(nested, selection));
    });
  });
}

function validTranslationStatus(value: unknown, allowFailedTranslation = false): boolean {
  if (value == null || value === '') return true;
  return typeof value === 'string' && (
    ['APPROVED', 'READY', 'BLOCKED', 'PENDING', 'REJECTED', 'DRAFT', 'UNKNOWN'].includes(value.trim().toUpperCase())
    || (allowFailedTranslation && value.trim().toUpperCase() === 'FAILED')
  );
}

function validLifecycleFields(record: Record<string, unknown>, allowFailedTranslation = false): boolean {
  for (const key of ['status', 'state', 'language', 'lang', 'sourceLang', 'sourceLanguage', 'translationGroupId']) {
    if (record[key] != null && typeof record[key] !== 'string') return false;
  }
  for (const key of ['deleted', 'isDeleted', 'archived', 'isArchived', 'isPublished', 'published']) {
    if (record[key] != null && typeof record[key] !== 'boolean') return false;
  }
  for (const key of ['deletedAt', 'archivedAt', 'publishedAt', 'publishAt', 'updatedAt', 'createdAt']) {
    const value = record[key];
    if (value != null && value !== '' && (typeof value !== 'string' || !Number.isFinite(Date.parse(value)))) return false;
  }
  for (const key of ['version', 'syncVersion', 'translationSyncVersion']) {
    const value = record[key];
    if (value != null && typeof value !== 'string' && !(typeof value === 'number' && Number.isSafeInteger(value))) return false;
  }
  const translationStatus = responseRecord(record.translationStatus);
  if (translationStatus) {
    if (!['en', 'hi', 'gu', 'in'].every((lang) => validTranslationStatus(translationStatus[lang], allowFailedTranslation))) return false;
  } else if (!validTranslationStatus(record.translationStatus, allowFailedTranslation)) return false;
  for (const key of ['translations', 'translation', 'i18n', 'localized', 'locales', 'byLang', 'textByLang']) {
    const container = responseRecord(record[key]);
    if (record[key] != null && !container) return false;
    for (const lang of ['en', 'hi', 'gu', 'in']) {
      // Public News uses this field for locale availability as well as legacy translated content.
      if (key === 'translations' && typeof container?.[lang] === 'boolean') continue;
      const variant = responseRecord(container?.[lang]);
      if (container?.[lang] != null && !variant) return false;
      if (variant && (!validTranslationStatus(variant.status, allowFailedTranslation) || !validTranslationStatus(variant.translationStatus, allowFailedTranslation))) return false;
      for (const field of localizedFieldNames) {
        for (const value of [variant?.[field], responseRecord(container?.[field])?.[lang]]) {
          const translated = responseRecord(value);
          if (translated && (!validTranslationStatus(translated.status, allowFailedTranslation) || !validTranslationStatus(translated.translationStatus, allowFailedTranslation))) return false;
        }
      }
    }
  }
  return getPublicArticleStatus(record) !== 'unknown';
}

function parsePublicNewsRecord(payload: unknown, listRecord = false): Article | null {
  const record = responseRecord(payload);
  const fields = listRecord ? publicListingFields : publicArticleFields;
  if (!record || typeof record._id !== 'string' || !record._id.trim() ||
    !validLifecycleFields(record, listRecord) || hasPublicRecordDiagnostics(record, fields)) return null;
  return { ...projectPublicFields(record, fields), _id: record._id };
}

export function parsePublicNewsArticle(payload: unknown): Article | null {
  if (failedPublicNewsPayload(responseRecord(payload))) return null;
  return parsePublicNewsRecord(unwrapArticle(payload));
}

/** Null is an invalid read; an empty array is an authoritative empty group. */
export function parsePublicNewsGroupItems(payload: unknown): Article[] | null {
  const record = responseRecord(payload);
  const nested = responseRecord(record?.data);
  if (failedPublicNewsPayload(record) || failedPublicNewsPayload(nested)) return null;
  const items = [payload, record?.items, record?.articles, record?.data, record?.result, nested?.items, nested?.articles]
    .find(Array.isArray);
  if (!items) return null;
  const articles = items.map((item) => parsePublicNewsRecord(item));
  return articles.every((article): article is Article => article !== null) ? articles : null;
}

const publicLocationFields = publicScalars('city district state region country citySlug districtSlug stateSlug');
const publicListingFields: PublicFields = {
  ...publicArticleFields,
  ...publicScalars(
    'city country locationLabel locationText citySlug stateSlug districtName districtSlug district_slug ' +
    'districtCode district_code districtId district_id time titleIsOriginal regionalReadMinutes'
  ),
  location: publicLocationFields,
  geo: publicLocationFields,
  region: publicLocationFields,
  source: publicScalars('name title summary excerpt content html body'),
};

export function projectPublicNewsListArticle(article: unknown): Record<string, unknown> {
  return projectPublicFields(responseRecord(article) || {}, publicListingFields);
}

const publicPaginationFields = publicScalars('page limit total totalPages hasMore');
const publicListMetadataFields: PublicFields = {
  ...publicPaginationFields, meta: publicPaginationFields, pagination: publicPaginationFields,
};
const publicListCollectionKeys = ['items', 'articles', 'stories', 'news', 'result', 'data'] as const;

export type PublicNewsListRead = {
  items: Article[];
  payload: Article[] | Record<string, unknown>;
};

/** Validate every record before filtering/deduplication, preserving supported public envelope shapes. */
export function parsePublicNewsList(payload: unknown): PublicNewsListRead | null {
  if (Array.isArray(payload)) {
    const items = payload.map((item) => {
      const record = responseRecord(item);
      const candidate = record?._id == null && typeof record?.id === 'string' ? { ...record, _id: record.id } : record;
      return parsePublicNewsRecord(candidate, true);
    });
    return items.every((item): item is Article => item !== null) ? { items, payload: items } : null;
  }
  const record = responseRecord(payload);
  const data = responseRecord(record?.data);
  if (!record || failedPublicNewsPayload(record) || failedPublicNewsPayload(data)) return null;
  for (const container of [record, data]) {
    for (const key of ['meta', 'pagination']) {
      if (container?.[key] != null && !responseRecord(container[key])) return null;
    }
  }
  for (const metadata of [record, data, responseRecord(record.meta), responseRecord(data?.meta), responseRecord(record.pagination), responseRecord(data?.pagination)]) {
    if (!metadata) continue;
    if (failedPublicNewsPayload(metadata)) return null;
    for (const key of ['page', 'limit', 'total', 'totalPages']) {
      const value = metadata[key];
      if (value != null && !(typeof value === 'number' && Number.isSafeInteger(value))
        && !(typeof value === 'string' && /^\d+$/.test(value.trim()))) return null;
    }
    if (metadata.hasMore != null && typeof metadata.hasMore !== 'boolean') return null;
  }
  let selected: { key: string; read: PublicNewsListRead } | null = null;
  for (const key of publicListCollectionKeys) {
    const collection = record[key];
    if (collection == null) continue;
    if (key === 'data' && data && selected && !publicListCollectionKeys.some((key) => data[key] != null)) continue;
    if (!Array.isArray(collection) && !(key === 'data' && data)) return null;
    const parsed = parsePublicNewsList(collection);
    if (!parsed) return null;
    if (!selected) selected = { key, read: parsed };
  }
  if (!selected) return null;
  const metadata = projectPublicFields(record, publicListMetadataFields);
  if (data) metadata.data = projectPublicFields(data, publicListMetadataFields);
  return { items: selected.read.items, payload: { ...metadata, [selected.key]: selected.read.payload } };
}

export type PublicNewsMeta = {
  total?: number;
  page?: number;
  totalPages?: number;
  limit?: number;
  pagination?: OrdinaryCategoryPagination;
};

function logPublicNewsError(event: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'production') return;
  // eslint-disable-next-line no-console
  console.error('[publicNewsApi]', event, details);
}

export async function fetchPublicNews(options: {
  category?: string;
  language?: string;
  q?: string;
  page?: number;
  limit?: number;
  extraQuery?: Record<string, string | number | undefined>;
  signal?: AbortSignal;
  homepageRecovery?: boolean;
  ordinaryPagination?: boolean;
  faithPagination?: boolean;
}): Promise<{
  items: Article[];
  meta: PublicNewsMeta;
  endpoint: string;
  error?: string;
  status?: number;
  retryAfter?: string | null;
}> {
  const isBrowser = typeof window !== 'undefined';
  const base = getApiOrigin();
  if (!isBrowser && !base) {
    logPublicNewsError('missing_api_base', {
      category: options.category || null,
      language: options.language || null,
      q: options.q || null,
      page: options.page ?? null,
      limit: options.limit ?? null,
    });
    return {
      items: [],
      meta: { limit: options.limit },
      endpoint: '',
      error: 'NEXT_PUBLIC_API_BASE not set',
    };
  }
  const params = new URLSearchParams();

  if (options.category) params.set('category', getCategoryQueryKey(String(options.category)) || String(options.category));
  if (options.language) {
    // Backend compatibility: some deployments use `lang`, others use `language`.
    // Send both so every page stays language-filtered.
    params.set('lang', String(options.language));
    params.set('language', String(options.language));
  }
  if (options.q) params.set('q', String(options.q));
  if (typeof options.page === 'number') params.set('page', String(options.page));
  if (typeof options.limit === 'number') params.set('limit', String(options.limit));

  if (options.extraQuery) {
    for (const [k, v] of Object.entries(options.extraQuery)) {
      if (v === undefined || v === null) continue;
      const sv = String(v);
      if (!sv) continue;
      params.set(k, sv);
    }
  }

  if (options.faithPagination && params.has('topic') && !getFaithCultureTopic(params.get('topic'))) {
    logPublicNewsError('invalid_faith_topic', { topic: params.get('topic') });
    params.delete('topic');
  }

  // In the browser, `base` may be "" which yields a same-origin request.
  const endpoint = `${base}/api/public/news?${params.toString()}`;

  try {
    const pageRequest = options.faithPagination
      ? validateFaithCulturePageRequest(options.category, options.page, options.limit, options.language)
      : options.ordinaryPagination
      ? validateOrdinaryPageRequest(options.category, options.page, options.limit)
      : null;
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(isBrowser && options.homepageRecovery ? { 'X-NewsPulse-Homepage-Recovery': '1' } : {}),
        ...(isBrowser && pageRequest ? { [options.faithPagination ? FAITH_CULTURE_PAGINATION_HEADER : ORDINARY_PAGINATION_HEADER]: '1' } : {}),
      },
      cache: 'no-store',
      signal: options.signal,
    });

    if (!res.ok) {
      void res.body?.cancel().catch(() => {});
      logPublicNewsError('http_error', {
        endpoint,
        status: res.status,
        category: options.category || null,
        language: options.language || null,
      });
      return {
        items: [],
        meta: { limit: options.limit },
        endpoint,
        status: res.status,
        retryAfter: getSafeRetryAfter(res.headers?.get('Retry-After')),
        error: options.faithPagination ? FAITH_CULTURE_NEWS_UNAVAILABLE : `API ${res.status}`,
      };
    }

    const data = await res.json();
    const parsed = parsePublicNewsList(data);
    if (!parsed) throw new Error('Invalid news list response');
    const rawItems = parsed.items;
    const pagination = pageRequest
      ? (options.faithPagination ? getFaithCulturePagination : getOrdinaryCategoryPagination)(data, pageRequest, rawItems.length)
      : undefined;
    const items = filterPubliclyPublishedArticles(rawItems);
    const meta: PublicNewsMeta = {
      total: data && typeof data === 'object' ? (data.total as number | undefined) : undefined,
      page: data && typeof data === 'object' ? (data.page as number | undefined) : undefined,
      totalPages: data && typeof data === 'object' ? (data.totalPages as number | undefined) : undefined,
      limit: data && typeof data === 'object' ? (data.limit as number | undefined) : options.limit,
      ...(pagination ? { pagination } : {}),
    };

    return { items, meta, endpoint };
  } catch (error) {
    logPublicNewsError('fetch_failed', {
      endpoint,
      category: options.category || null,
      language: options.language || null,
      message: error instanceof Error ? error.message : String(error),
    });
    return { items: [], meta: { limit: options.limit }, endpoint, error: options.faithPagination ? FAITH_CULTURE_NEWS_UNAVAILABLE : 'Fetch failed' };
  }
}

export async function fetchPublishedCategoryArticles(options: {
  categoryKey: string;
  limit?: number;
}): Promise<{ articles: Article[]; error?: string; endpoint: string }> {
  const base = getApiOrigin();
  if (!base) {
    return { articles: [], error: 'NEXT_PUBLIC_API_BASE not set', endpoint: '' };
  }
  const limit = options.limit ?? 30;
  const categoryKey = getCategoryQueryKey(options.categoryKey);
  const endpoint = `${base}/api/news?category=${encodeURIComponent(categoryKey)}&limit=${encodeURIComponent(String(limit))}`;

  try {
    const res = await fetch(endpoint);
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const msg =
        (data && typeof data === 'object' && (data.message || data.error || data.code))
          ? String(data.message || data.error || data.code)
          : '';
      return { articles: [], error: msg ? `API ${res.status} (${msg})` : `API ${res.status}`, endpoint };
    }

    return { articles: unwrapArticles(data), endpoint };
  } catch {
    return { articles: [], error: 'Fetch failed', endpoint };
  }
}

export async function fetchArticleBySlugOrId(options: {
  slugOrId: string;
  language?: string;
}): Promise<{ article: Article | null; error?: string; status?: number; endpointTried: string[] }> {
  const base = getApiOrigin();
  if (!base) {
    return { article: null, error: 'NEXT_PUBLIC_API_BASE not set', endpointTried: [] };
  }
  const slug = options.slugOrId;

  const lang = options.language ? String(options.language).toLowerCase().trim() : '';
  const langQuery = lang ? `?lang=${encodeURIComponent(lang)}&language=${encodeURIComponent(lang)}` : '';

  const endpoints = [
    // Current backend: article detail is served under /api/articles/:id
    `${base}/api/articles/${encodeURIComponent(slug)}${langQuery}`,
    `${base}/api/news/${encodeURIComponent(slug)}${langQuery}`,
    `${base}/api/news/by-slug/${encodeURIComponent(slug)}${langQuery}`,
  ];

  for (let i = 0; i < endpoints.length; i++) {
    const url = endpoints[i];
    try {
      const res = await fetch(url);
      if (res.status === 404) {
        continue;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg =
          (data && typeof data === 'object' && (data.message || data.error || data.code))
            ? String(data.message || data.error || data.code)
            : '';
        return {
          article: null,
          error: msg ? `API ${res.status} (${msg})` : `API ${res.status}`,
          status: res.status,
          endpointTried: endpoints.slice(0, i + 1),
        };
      }
      const data = await res.json().catch(() => null);
      const article = unwrapArticle(data);
      if (!article?._id) {
        return { article: null, error: 'Article not found', endpointTried: endpoints.slice(0, i + 1) };
      }
      return { article, endpointTried: endpoints.slice(0, i + 1) };
    } catch {
      return { article: null, error: 'Fetch failed', endpointTried: endpoints.slice(0, i + 1) };
    }
  }

  return { article: null, status: 404, endpointTried: endpoints };
}

export async function fetchPublicNewsById(options: {
  id: string;
  language?: string;
  signal?: AbortSignal;
}): Promise<{ article: Article | null; error?: string; status?: number; endpoint: string }> {
  const base = getApiOrigin();
  if (!base && typeof window === 'undefined') {
    return { article: null, error: 'NEXT_PUBLIC_API_BASE not set', endpoint: '' };
  }

  const id = String(options.id || '').trim();
  if (!id) return { article: null, error: 'Missing id', endpoint: '' };

  const lang = options.language ? String(options.language).toLowerCase().trim() : '';
  const langQuery = lang ? `?lang=${encodeURIComponent(lang)}&language=${encodeURIComponent(lang)}` : '';

  const endpoint = `${base}/api/public/news/${encodeURIComponent(id)}${langQuery}`;

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: options.signal,
    });

    if (!res.ok) {
      logPublicNewsError('article_read_failed', { status: res.status });
      return { article: null, status: res.status, endpoint, error: `API ${res.status}` };
    }

    const article = parsePublicNewsArticle(await res.json());
    if (!article) {
      logPublicNewsError('invalid_article_response', { status: res.status });
      return { article: null, endpoint, error: 'Invalid article response' };
    }
    return { article, endpoint };
  } catch {
    if (!options.signal?.aborted) logPublicNewsError('article_read_failed', {});
    return { article: null, endpoint, error: 'Fetch failed' };
  }
}

export async function fetchPublicNewsGroup(options: {
  translationGroupId: string;
  language?: string;
  signal?: AbortSignal;
}): Promise<{ items: Article[]; error?: string; status?: number; endpoint: string }> {
  const base = getApiOrigin();
  if (!base && typeof window === 'undefined') {
    return { items: [], error: 'NEXT_PUBLIC_API_BASE not set', endpoint: '' };
  }

  const groupId = String(options.translationGroupId || '').trim();
  if (!groupId) return { items: [], error: 'Missing translationGroupId', endpoint: '' };

  const lang = options.language ? String(options.language).toLowerCase().trim() : '';
  const langQuery = lang ? `?lang=${encodeURIComponent(lang)}&language=${encodeURIComponent(lang)}` : '';
  const endpoint = `${base}/api/public/news/group/${encodeURIComponent(groupId)}${langQuery}`;

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: options.signal,
    });

    if (!res.ok) {
      logPublicNewsError('group_read_failed', { status: res.status });
      return { items: [], status: res.status, endpoint, error: `API ${res.status}` };
    }

    const items = parsePublicNewsGroupItems(await res.json());
    if (!items) {
      logPublicNewsError('invalid_group_response', { status: res.status });
      return { items: [], endpoint, error: 'Invalid translation group response' };
    }
    return { items, endpoint };
  } catch {
    if (!options.signal?.aborted) logPublicNewsError('group_read_failed', {});
    return { items: [], endpoint, error: 'Fetch failed' };
  }
}

export async function fetchPublicNewsTranslation(options: {
  translationKey: string;
  language: string;
  signal?: AbortSignal;
}): Promise<{ article: Article | null; error?: string; status?: number; endpoint: string }> {
  const base = getApiOrigin();
  if (!base && typeof window === 'undefined') {
    return { article: null, error: 'NEXT_PUBLIC_API_BASE not set', endpoint: '' };
  }

  const translationKey = String(options.translationKey || '').trim();
  const language = String(options.language || '').toLowerCase().trim();
  if (!translationKey || !language) return { article: null, error: 'Missing translationKey/lang', endpoint: '' };

  const params = new URLSearchParams();
  params.set('translationKey', translationKey);
  params.set('lang', language);
  params.set('language', language);

  const endpoint = `${base}/api/public/news/translation?${params.toString()}`;

  try {
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: 'application/json' },
      signal: options.signal,
    });

    const data = await res.json().catch(() => null);

    if (!res.ok) {
      const msg =
        (data && typeof data === 'object' && (data.message || data.error || data.code))
          ? String(data.message || data.error || data.code)
          : '';
      return { article: null, status: res.status, endpoint, error: msg ? `API ${res.status} (${msg})` : `API ${res.status}` };
    }

    const article = unwrapArticle(data);
    if (!article?._id) return { article: null, endpoint, status: 404, error: 'Article not found' };
    return { article, endpoint };
  } catch {
    return { article: null, endpoint, error: 'Fetch failed' };
  }
}
