export type RouteLocale = 'en' | 'hi' | 'gu';

export type LocalizedArticleFields = {
  requestedLocale: RouteLocale;
  sourceLocale: RouteLocale | null;
  status: 'published' | 'unpublished' | 'deleted' | 'unknown';
  /** True when this article should be allowed to render on the requested locale route. */
  isVisible: boolean;
  /** The locale we actually used for text fields (always equals requestedLocale under current policy). */
  selectedLocale: RouteLocale;
  /** True when we intentionally showed source/original for a different locale (currently always false). */
  isFallback: boolean;
  title: string;
  summary: string;
  bodyHtml: string;
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

function stripInlineHtmlToText(value: string): string {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function containsGujaratiScript(value: string): boolean {
  return /[\u0A80-\u0AFF]/.test(String(value || ''));
}

function isSafeEnglishSlug(value: string): boolean {
  const s = String(value || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');
  if (!s) return false;
  if (containsGujaratiScript(s)) return false;
  if (!/^[\x20-\x7E]+$/.test(s)) return false;
  return /^[a-z0-9][a-z0-9-_]*$/i.test(s);
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

  const explicitlyUnpublished =
    article?.isDraft === true ||
    article?.draft === true ||
    article?.isPublished === false ||
    article?.published === false ||
    statusRaw === 'unpublished' ||
    statusRaw === 'draft' ||
    statusRaw === 'pending' ||
    statusRaw === 'rejected';

  const publishedFlag =
    article?.isPublished === true ||
    article?.published === true ||
    statusRaw === 'published' ||
    !!String(article?.publishedAt || '').trim();

  // IMPORTANT: draft/pending/rejected must never be treated as public even if a timestamp exists.
  if (explicitlyUnpublished) return 'unpublished';
  if (publishedFlag) return 'published';

  // If it's missing both a publish marker and an explicit state, treat as not safe for public listings.
  return 'unknown';
}

function getTranslationContainer(article: any): any {
  return article?.translations || article?.i18n || article?.localized || article?.locales || null;
}

function hasApprovedTranslation(article: any, locale: RouteLocale): boolean {
  const direct = normTranslationStatus(article?.translationStatus);
  if (direct) return direct === 'APPROVED';

  const byLang = normTranslationStatus(article?.translationStatus?.[locale]);
  if (byLang) return byLang === 'APPROVED';

  const container = getRecord(getTranslationContainer(article));
  if (!container) return false;

  const candidate = getNested(container, [locale]);
  const status = normTranslationStatus(candidate?.status || candidate?.translationStatus);
  if (status) return status === 'APPROVED';

  return false;
}

function getTranslatedField(article: any, locale: RouteLocale, field: 'title' | 'summary' | 'excerpt' | 'content' | 'html' | 'body' | 'slug'): string {
  // Prefer explicit locale-specific top-level fields when present.
  // This prevents leaking the generic/base fields when backend stores per-locale values (e.g. title_en, titleEn).
  const suffix = locale.toUpperCase();
  const camel = `${locale[0].toUpperCase()}${locale.slice(1)}`;

  const directCandidates: any[] = [
    article?.[`${field}_${locale}`],
    article?.[`${field}_${suffix}`],
    article?.[`${field}${suffix}`],
    article?.[`${field}${camel}`],
    getNested(article, [field, locale]),
    getNested(article, [locale, field]),
  ];

  for (const c of directCandidates) {
    if (typeof c === 'string' && c.trim()) return c.trim();
    if (c && typeof c === 'object') {
      const t = pickNonEmpty(c.text, c.value, c.html, c.content, c.body);
      if (t) return t;
    }
    const s = String(c ?? '').trim();
    if (s) return s;
  }

  const container = getRecord(getTranslationContainer(article));
  if (!container) return '';

  const fromLang = getNested(container, [locale, field]);
  if (typeof fromLang === 'string' && fromLang.trim()) return fromLang.trim();
  if (fromLang && typeof fromLang === 'object') {
    const t = pickNonEmpty(fromLang.text, fromLang.value, fromLang.html, fromLang.content, fromLang.body);
    if (t) return t;
  }

  const byField = getNested(container, [field, locale]);
  if (typeof byField === 'string' && byField.trim()) return byField.trim();
  if (byField && typeof byField === 'object') {
    const t = pickNonEmpty(byField.text, byField.value, byField.html, byField.content, byField.body);
    if (t) return t;
  }

  return '';
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

function getSlugForLocale(article: any, locale: RouteLocale, sourceLocale: RouteLocale | null): string {
  // Strict: only accept cross-locale slug when this locale is the source locale.
  const explicit = pickNonEmpty(
    getTranslatedField(article, locale, 'slug'),
    getNested(article, ['slugs', locale]),
    getNested(article, ['slug', locale]),
    article?.[`slug_${locale}`],
    article?.[`slug${locale.toUpperCase()}`]
  );

  if (explicit) return String(explicit).replace(/^\/+/, '').replace(/\/+$/, '');

  if (sourceLocale && sourceLocale === locale) {
    const fallback = pickNonEmpty(article?.slug, article?.seoSlug);
    const cleaned = String(fallback || '').replace(/^\/+/, '').replace(/\/+$/, '');
    if (locale === 'en' && cleaned && !isSafeEnglishSlug(cleaned)) return '';
    return cleaned;
  }

  return '';
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
      title: '',
      summary: '',
      bodyHtml: '',
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
      title: '',
      summary: '',
      bodyHtml: '',
      slug: '',
    };
  }

  // If we don't know the source language, we still refuse cross-locale leakage.
  // We only allow rendering when the article explicitly claims to be in this locale OR has approved translations.
  const isSameAsSource = !!sourceLocale && sourceLocale === requestedLocale;

  // For English routes, we must avoid rendering Gujarati (or other) base fields.
  // If the backend provides a translation container (or explicit localized fields) but English is missing,
  // exclude the item rather than showing wrong-locale base text.
  if (requestedLocale === 'en') {
    const containerPresent = !!getRecord(getTranslationContainer(item));
    const enHasAny = !!pickNonEmpty(
      getTranslatedField(item, 'en', 'title'),
      getTranslatedField(item, 'en', 'summary'),
      getTranslatedField(item, 'en', 'excerpt'),
      getTranslatedField(item, 'en', 'html'),
      getTranslatedField(item, 'en', 'content'),
      getTranslatedField(item, 'en', 'body')
    );
    const otherHasAny = !!pickNonEmpty(
      getTranslatedField(item, 'hi', 'title'),
      getTranslatedField(item, 'gu', 'title'),
      getTranslatedField(item, 'hi', 'summary'),
      getTranslatedField(item, 'gu', 'summary'),
      getTranslatedField(item, 'hi', 'excerpt'),
      getTranslatedField(item, 'gu', 'excerpt'),
      getTranslatedField(item, 'hi', 'html'),
      getTranslatedField(item, 'gu', 'html'),
      getTranslatedField(item, 'hi', 'content'),
      getTranslatedField(item, 'gu', 'content'),
      getTranslatedField(item, 'hi', 'body'),
      getTranslatedField(item, 'gu', 'body')
    );

    if (containerPresent && otherHasAny && !enHasAny) {
      return {
        requestedLocale,
        sourceLocale,
        status,
        isVisible: false,
        selectedLocale: requestedLocale,
        isFallback: false,
        title: '',
        summary: '',
        bodyHtml: '',
        slug: '',
      };
    }
  }

  if (isSameAsSource) {
    // Prefer explicit localized fields for this locale when present.
    const explicitTitle = stripInlineHtmlToText(getTranslatedField(item, requestedLocale, 'title'));
    const explicitSummary = stripInlineHtmlToText(
      pickNonEmpty(
        getTranslatedField(item, requestedLocale, 'summary'),
        getTranslatedField(item, requestedLocale, 'excerpt')
      )
    );
    const explicitBodyHtml = pickNonEmpty(
      getTranslatedField(item, requestedLocale, 'html'),
      getTranslatedField(item, requestedLocale, 'content'),
      getTranslatedField(item, requestedLocale, 'body')
    );

    const baseTitle = stripInlineHtmlToText(getSourceField(item, 'title'));
    const title = explicitTitle || baseTitle;
    const summary =
      explicitSummary ||
      stripInlineHtmlToText(pickNonEmpty(getSourceField(item, 'summary'), getSourceField(item, 'excerpt')));

    // English routes must not render Gujarati base content when English fields are expected.
    if (requestedLocale === 'en' && !explicitTitle && containsGujaratiScript(baseTitle)) {
      return {
        requestedLocale,
        sourceLocale,
        status,
        isVisible: false,
        selectedLocale: requestedLocale,
        isFallback: false,
        title: '',
        summary: '',
        bodyHtml: '',
        slug: '',
      };
    }

    if (requestedLocale === 'en' && !explicitBodyHtml && containsGujaratiScript(String(getSourceBodyHtml(item) || '').slice(0, 800))) {
      return {
        requestedLocale,
        sourceLocale,
        status,
        isVisible: false,
        selectedLocale: requestedLocale,
        isFallback: false,
        title: '',
        summary: '',
        bodyHtml: '',
        slug: '',
      };
    }

    return {
      requestedLocale,
      sourceLocale,
      status,
      isVisible: true,
      selectedLocale: requestedLocale,
      isFallback: false,
      title,
      summary,
      bodyHtml: explicitBodyHtml || getSourceBodyHtml(item),
      slug: getSlugForLocale(item, requestedLocale, sourceLocale),
    };
  }

  // Cross-locale route: only allow APPROVED translations.
  const approved = hasApprovedTranslation(item, requestedLocale);
  if (!approved) {
    if (policy.allowCrossLocaleOriginal) {
      const title = stripInlineHtmlToText(getSourceField(item, 'title'));
      const summary = stripInlineHtmlToText(pickNonEmpty(getSourceField(item, 'summary'), getSourceField(item, 'excerpt')));
      // Controlled fallback (not enabled by default).
      return {
        requestedLocale,
        sourceLocale,
        status,
        isVisible: true,
        selectedLocale: sourceLocale || requestedLocale,
        isFallback: true,
        title,
        summary,
        bodyHtml: getSourceBodyHtml(item),
        slug: getSlugForLocale(item, sourceLocale || requestedLocale, sourceLocale),
      };
    }

    return {
      requestedLocale,
      sourceLocale,
      status,
      isVisible: false,
      selectedLocale: requestedLocale,
      isFallback: false,
      title: '',
      summary: '',
      bodyHtml: '',
      slug: '',
    };
  }

  const title = stripInlineHtmlToText(getTranslatedField(item, requestedLocale, 'title'));
  const summary = stripInlineHtmlToText(
    pickNonEmpty(
      getTranslatedField(item, requestedLocale, 'summary'),
      getTranslatedField(item, requestedLocale, 'excerpt')
    )
  );
  const bodyHtml = pickNonEmpty(
    getTranslatedField(item, requestedLocale, 'html'),
    getTranslatedField(item, requestedLocale, 'content'),
    getTranslatedField(item, requestedLocale, 'body')
  );

  // If translation is marked approved but fields are blank, still treat as invisible.
  if (!title && !summary && !bodyHtml) {
    return {
      requestedLocale,
      sourceLocale,
      status,
      isVisible: false,
      selectedLocale: requestedLocale,
      isFallback: false,
      title: '',
      summary: '',
      bodyHtml: '',
      slug: '',
    };
  }

  return {
    requestedLocale,
    sourceLocale,
    status,
    isVisible: true,
    selectedLocale: requestedLocale,
    isFallback: false,
    title,
    summary,
    bodyHtml,
    slug: getSlugForLocale(item, requestedLocale, sourceLocale),
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
