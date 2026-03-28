export type RouteLocale = 'en' | 'hi' | 'gu';

export type LocalizedArticleFields = {
  requestedLocale: RouteLocale;
  sourceLocale: RouteLocale | null;
  status: 'published' | 'unpublished' | 'deleted' | 'unknown';
  /** True when this article should be allowed to render on the requested locale route. */
  isVisible: boolean;
  /** The locale we actually used for text fields (always equals requestedLocale under current policy). */
  selectedLocale: RouteLocale;
  /** True when we intentionally fell back to source/original fields for this locale. */
  isFallback: boolean;
  translationFound: boolean;
  title: string;
  summary: string;
  bodyHtml: string;
  categoryLabel: string;
  /** Slug appropriate for the requested locale when available; may be empty. */
  slug: string;
};

export type LocaleFallbackPolicy = {
  /**
   * If true, allow showing source/original content on a different-locale route.
   * NewsPulse policy for this task: false (do not leak other languages).
   */
  allowCrossLocaleOriginal: boolean;
};

export const DEFAULT_FALLBACK_POLICY: LocaleFallbackPolicy = {
  allowCrossLocaleOriginal: false,
};

export function normalizeRouteLocale(value: unknown): RouteLocale {
  const v = String(value || '').toLowerCase().trim();
  const base = v.split(/[-_]/g)[0] || v;
  if (base === 'hi' || base === 'hindi' || base === 'in') return 'hi';
  if (base === 'gu' || base === 'gujarati') return 'gu';
  return 'en';
}

function pickNonEmpty(...candidates: unknown[]): string {
  for (const c of candidates) {
    const s = typeof c === 'string' ? c.trim() : String(c ?? '').trim();
    if (s) return s;
  }
  return '';
}

function extractTextLike(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value).trim();
  if (typeof value === 'object' && !Array.isArray(value)) {
    return pickNonEmpty(
      (value as any).text,
      (value as any).value,
      (value as any).html,
      (value as any).content,
      (value as any).body,
      (value as any).label,
      (value as any).name,
      (value as any).slug
    );
  }
  return '';
}

function getRecord(raw: unknown): Record<string, any> | null {
  if (!raw || typeof raw !== 'object') return null;
  if (Array.isArray(raw)) return null;
  return raw as Record<string, any>;
}

function getNested(obj: any, path: string[]): any {
  let cur = obj;
  for (const p of path) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = cur[p];
  }
  return cur;
}

function normTranslationStatus(raw: unknown): 'APPROVED' | 'BLOCKED' | 'PENDING' | 'REJECTED' | 'DRAFT' | 'UNKNOWN' | null {
  const v = String(raw || '').toUpperCase().trim();
  if (!v) return null;
  if (v === 'APPROVED') return 'APPROVED';
  if (v === 'BLOCKED') return 'BLOCKED';
  if (v === 'PENDING') return 'PENDING';
  if (v === 'REJECTED') return 'REJECTED';
  if (v === 'DRAFT') return 'DRAFT';
  return 'UNKNOWN';
}

function getSourceLocale(article: any): RouteLocale | null {
  const v =
    normalizeRouteLocale(article?.sourceLang || article?.sourceLanguage || article?.language || article?.lang);

  // If the source is absent, we treat it as unknown (null) instead of defaulting to 'en'.
  // This prevents silent cross-locale leakage when backend forgets to send a language field.
  const raw = String(article?.sourceLang || article?.sourceLanguage || article?.language || article?.lang || '').trim();
  if (!raw) return null;

  return v;
}

export function getPublicArticleStatus(article: any): LocalizedArticleFields['status'] {
  const statusRaw = String(article?.status || article?.state || '').toLowerCase().trim();
  const deletedFlag = article?.deleted === true || article?.isDeleted === true || !!article?.deletedAt;

  if (deletedFlag) return 'deleted';
  if (statusRaw === 'deleted' || statusRaw === 'removed' || statusRaw === 'trash') return 'deleted';

  const publishedFlag =
    article?.isPublished === true ||
    article?.published === true ||
    statusRaw === 'published' ||
    !!String(article?.publishedAt || '').trim();

  const explicitlyUnpublished =
    article?.isPublished === false ||
    article?.published === false ||
    statusRaw === 'unpublished' ||
    statusRaw === 'draft' ||
    statusRaw === 'pending' ||
    statusRaw === 'rejected';

  if (publishedFlag) return 'published';
  if (explicitlyUnpublished) return 'unpublished';

  // If it's missing both a publish marker and an explicit state, treat as not safe for public listings.
  return 'unknown';
}

function getTranslationContainer(article: any): any {
  return article?.translations || article?.translation || article?.i18n || article?.localized || article?.locales || article?.byLang || article?.textByLang || null;
}

function getLocaleKeys(locale: RouteLocale): string[] {
  return locale === 'hi' ? ['hi', 'in'] : [locale];
}

function getLocalizedFieldValue(article: any, locale: RouteLocale, fieldNames: string[]): string {
  const container = getRecord(getTranslationContainer(article));
  const localeKeys = getLocaleKeys(locale);

  if (container) {
    for (const localeKey of localeKeys) {
      for (const field of fieldNames) {
        const fromLocaleFirst = extractTextLike(getNested(container, [localeKey, field]));
        if (fromLocaleFirst) return fromLocaleFirst;
      }
    }

    for (const field of fieldNames) {
      for (const localeKey of localeKeys) {
        const fromFieldFirst = extractTextLike(getNested(container, [field, localeKey]));
        if (fromFieldFirst) return fromFieldFirst;
      }
    }
  }

  for (const localeKey of localeKeys) {
    const localeCap = localeKey.charAt(0).toUpperCase() + localeKey.slice(1);
    for (const field of fieldNames) {
      const fieldCap = field.charAt(0).toUpperCase() + field.slice(1);
      const direct = pickNonEmpty(
        extractTextLike(getNested(article, [field, localeKey])),
        extractTextLike(getNested(article, [field, 'value', localeKey])),
        extractTextLike(article?.[`${field}_${localeKey}`]),
        extractTextLike(article?.[`${field}${localeCap}`]),
        extractTextLike(article?.[`${localeKey}_${field}`]),
        extractTextLike(article?.[`${localeKey}${fieldCap}`])
      );
      if (direct) return direct;
    }
  }

  return '';
}

function sanitizeSlug(raw: unknown): string {
  return String(raw || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');
}

function getSourceField(article: any, field: 'title' | 'summary' | 'excerpt'): string {
  if (field === 'title') {
    return pickNonEmpty(article?.originalTitle, article?.sourceTitle, article?.titleOriginal, article?.source?.title, article?.title);
  }
  if (field === 'summary') {
    return pickNonEmpty(
      article?.originalSummary,
      article?.sourceSummary,
      article?.summaryOriginal,
      article?.source?.summary,
      article?.summary,
      article?.excerpt
    );
  }
  return pickNonEmpty(article?.originalExcerpt, article?.sourceExcerpt, article?.excerptOriginal, article?.source?.excerpt, article?.excerpt, article?.summary);
}

function getSourceBodyHtml(article: any): string {
  return pickNonEmpty(
    extractTextLike(article?.bodyHtml),
    article?.originalContent,
    article?.sourceContent,
    article?.contentOriginal,
    article?.originalHtml,
    article?.sourceHtml,
    article?.htmlOriginal,
    article?.originalBody,
    article?.sourceBody,
    article?.bodyOriginal,
    article?.source?.content,
    article?.source?.html,
    article?.source?.body,
    article?.content,
    article?.html,
    article?.body
  );
}

function getBaseSlug(article: any): string {
  return sanitizeSlug(
    pickNonEmpty(
      article?.slug,
      article?.seoSlug,
      article?.originalSlug,
      article?.sourceSlug,
      article?.baseSlug,
      article?.canonicalSlug,
      article?._id,
      article?.id
    )
  );
}

function getLocalizedFieldWithFallback(
  article: any,
  locale: RouteLocale,
  localizedFields: string[],
  baseValue: string
): { value: string; translationFound: boolean } {
  const translated = getLocalizedFieldValue(article, locale, localizedFields);
  if (translated) {
    return { value: translated, translationFound: true };
  }

  return { value: baseValue, translationFound: false };
}

export function getLocalizedTitle(article: unknown, localeInput: unknown): string {
  const locale = normalizeRouteLocale(localeInput);
  const item = article && typeof article === 'object' ? (article as any) : null;
  if (!item) return '';

  return getLocalizedFieldWithFallback(item, locale, ['title', 'headline', 'name'], getSourceField(item, 'title')).value;
}

export function getLocalizedSummary(article: unknown, localeInput: unknown): string {
  const locale = normalizeRouteLocale(localeInput);
  const item = article && typeof article === 'object' ? (article as any) : null;
  if (!item) return '';

  const baseSummary = pickNonEmpty(getSourceField(item, 'summary'), getSourceField(item, 'excerpt'));
  return getLocalizedFieldWithFallback(item, locale, ['summary', 'excerpt', 'description', 'dek'], baseSummary).value;
}

export function getLocalizedContent(article: unknown, localeInput: unknown): string {
  const locale = normalizeRouteLocale(localeInput);
  const item = article && typeof article === 'object' ? (article as any) : null;
  if (!item) return '';

  return getLocalizedFieldWithFallback(item, locale, ['html', 'content', 'body'], getSourceBodyHtml(item)).value;
}

export function getLocalizedSlug(article: unknown, localeInput: unknown): string {
  const locale = normalizeRouteLocale(localeInput);
  const item = article && typeof article === 'object' ? (article as any) : null;
  if (!item) return '';

  const explicit = sanitizeSlug(
    pickNonEmpty(
      getLocalizedFieldValue(item, locale, ['slug']),
      extractTextLike(getNested(item, ['slugs', locale])),
      extractTextLike(getNested(item, ['slug', locale])),
      extractTextLike(item?.[`slug_${locale}`]),
      extractTextLike(item?.[`slug${locale.toUpperCase()}`])
    )
  );

  return explicit || getBaseSlug(item);
}

export function getLocalizedCategoryLabel(article: unknown, localeInput: unknown): string {
  const locale = normalizeRouteLocale(localeInput);
  const item = article && typeof article === 'object' ? (article as any) : null;
  if (!item) return '';

  const baseCategory = pickNonEmpty(
    article && typeof article === 'object' ? (article as any)?.categoryLabel : '',
    article && typeof article === 'object' ? (article as any)?.categoryName : '',
    article && typeof article === 'object' ? (article as any)?.category : ''
  );
  return getLocalizedFieldWithFallback(item, locale, ['categoryLabel', 'categoryName', 'category', 'section'], baseCategory).value;
}

export function getLocalizedArticleFields(
  article: unknown,
  localeInput: unknown,
  policy: LocaleFallbackPolicy = DEFAULT_FALLBACK_POLICY
): LocalizedArticleFields {
  const requestedLocale = normalizeRouteLocale(localeInput);
  const item = article && typeof article === 'object' ? (article as any) : null;

  if (!item) {
    return {
      requestedLocale,
      sourceLocale: null,
      status: 'unknown',
      isVisible: false,
      selectedLocale: requestedLocale,
      isFallback: false,
      translationFound: false,
      title: '',
      summary: '',
      bodyHtml: '',
      categoryLabel: '',
      slug: '',
    };
  }

  const sourceLocale = getSourceLocale(item);
  const status = getPublicArticleStatus(item);

  const publishedOk = status === 'published';
  if (!publishedOk) {
    return {
      requestedLocale,
      sourceLocale,
      status,
      isVisible: false,
      selectedLocale: requestedLocale,
      isFallback: false,
      translationFound: false,
      title: '',
      summary: '',
      bodyHtml: '',
      categoryLabel: '',
      slug: '',
    };
  }

  const titleResolved = getLocalizedFieldWithFallback(item, requestedLocale, ['title', 'headline', 'name'], getSourceField(item, 'title'));
  const summaryResolved = getLocalizedFieldWithFallback(
    item,
    requestedLocale,
    ['summary', 'excerpt', 'description', 'dek'],
    pickNonEmpty(getSourceField(item, 'summary'), getSourceField(item, 'excerpt'))
  );
  const bodyResolved = getLocalizedFieldWithFallback(item, requestedLocale, ['html', 'content', 'body'], getSourceBodyHtml(item));
  const categoryResolved = getLocalizedFieldWithFallback(
    item,
    requestedLocale,
    ['categoryLabel', 'categoryName', 'category', 'section'],
    pickNonEmpty(item?.categoryLabel, item?.categoryName, item?.category)
  );

  const localizedSlug = sanitizeSlug(getLocalizedFieldValue(item, requestedLocale, ['slug']));
  const fallbackSlug = getBaseSlug(item);
  const slug = localizedSlug || fallbackSlug;
  const translationFound = Boolean(
    titleResolved.translationFound ||
    summaryResolved.translationFound ||
    bodyResolved.translationFound ||
    categoryResolved.translationFound ||
    localizedSlug
  );
  const isCrossLocale = Boolean(sourceLocale && sourceLocale !== requestedLocale);
  const shouldFallback = isCrossLocale && !translationFound;

  if (!translationFound && isCrossLocale && !policy.allowCrossLocaleOriginal) {
    // Keep the route usable by falling back to the published base article.
    // This avoids false 404s when a published article exists but locale-specific fields are absent.
  }

  return {
    requestedLocale,
    sourceLocale,
    status,
    isVisible: true,
    selectedLocale: requestedLocale,
    isFallback: shouldFallback,
    translationFound,
    title: titleResolved.value,
    summary: summaryResolved.value,
    bodyHtml: bodyResolved.value,
    categoryLabel: categoryResolved.value,
    slug,
  };
}

export function filterVisibleArticlesForLocale<T>(articles: T[], locale: unknown): T[] {
  const requested = normalizeRouteLocale(locale);
  const input = Array.isArray(articles) ? articles : [];
  return input.filter((a) => getLocalizedArticleFields(a as any, requested).isVisible);
}

export function pickBestLocaleForArticle(article: unknown, preferred: RouteLocale): RouteLocale | null {
  const order: RouteLocale[] = [preferred, 'en', 'hi', 'gu'].filter((v, i, arr) => arr.indexOf(v) === i) as RouteLocale[];
  for (const loc of order) {
    if (getLocalizedArticleFields(article as any, loc).isVisible) return loc;
  }
  return null;
}
