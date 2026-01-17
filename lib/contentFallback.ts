export type UiLang = 'en' | 'hi' | 'gu';
export type TranslationStatus = 'APPROVED' | 'BLOCKED' | 'PENDING' | 'REJECTED' | 'DRAFT' | 'UNKNOWN';

export type ResolvedContent = {
  text: string;
  /** True when we intentionally showed source/original text for safety. */
  isOriginal: boolean;
};

function normLang(raw: unknown): UiLang | null {
  const v = String(raw || '').toLowerCase().trim();
  if (v === 'en' || v === 'hi' || v === 'gu') return v;
  return null;
}

function normStatus(raw: unknown): TranslationStatus | null {
  const v = String(raw || '').toUpperCase().trim();
  if (!v) return null;
  if (v === 'APPROVED') return 'APPROVED';
  if (v === 'BLOCKED') return 'BLOCKED';
  if (v === 'PENDING') return 'PENDING';
  if (v === 'REJECTED') return 'REJECTED';
  if (v === 'DRAFT') return 'DRAFT';
  return 'UNKNOWN';
}

function pickNonEmpty(...candidates: unknown[]): string {
  for (const c of candidates) {
    const s = String(c ?? '').trim();
    if (s) return s;
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

function getFieldSource(item: any, field: 'title' | 'summary' | 'excerpt'): string {
  // Prefer explicit original/source fields if present.
  if (field === 'title') {
    return pickNonEmpty(item?.originalTitle, item?.sourceTitle, item?.titleOriginal, item?.source?.title, item?.title);
  }
  if (field === 'summary') {
    return pickNonEmpty(item?.originalSummary, item?.sourceSummary, item?.summaryOriginal, item?.source?.summary, item?.summary, item?.excerpt);
  }
  return pickNonEmpty(item?.originalExcerpt, item?.sourceExcerpt, item?.excerptOriginal, item?.source?.excerpt, item?.excerpt, item?.summary);
}

function getTranslationContainer(item: any): any {
  // Common backend shapes.
  return (
    item?.translations ||
    item?.i18n ||
    item?.localized ||
    item?.locales ||
    item?.textByLang ||
    item?.byLang ||
    null
  );
}

function getTranslatedField(item: any, field: 'title' | 'summary' | 'excerpt', lang: UiLang): string {
  const container = getTranslationContainer(item);
  const rec = getRecord(container);
  if (!rec) return '';

  // Try translations[lang][field]
  const v1 = getNested(rec, [lang, field]);
  const t1 = pickNonEmpty(v1?.text, v1);
  if (t1) return t1;

  // Try translations[field][lang]
  const v2 = getNested(rec, [field, lang]);
  const t2 = pickNonEmpty(v2?.text, v2);
  if (t2) return t2;

  return '';
}

function getStatusField(item: any, field: 'title' | 'summary' | 'excerpt', lang: UiLang): TranslationStatus | null {
  // Common backend shapes:
  // - translationStatus: { [lang]: 'APPROVED' }
  // - translationStatus: 'APPROVED'
  // - translations[lang][field].status
  // - translations[field][lang].status
  const direct = normStatus(item?.translationStatus);
  if (direct) return direct;

  const byLang = normStatus(item?.translationStatus?.[lang]);
  if (byLang) return byLang;

  const container = getTranslationContainer(item);
  const rec = getRecord(container);
  if (!rec) return null;

  const a = getNested(rec, [lang, field]);
  const s1 = normStatus(a?.status || a?.translationStatus);
  if (s1) return s1;

  const b = getNested(rec, [field, lang]);
  const s2 = normStatus(b?.status || b?.translationStatus);
  if (s2) return s2;

  return null;
}

function getSourceLang(item: any): UiLang | null {
  return normLang(item?.sourceLang) || normLang(item?.sourceLanguage) || normLang(item?.language) || normLang(item?.lang);
}

/**
 * Resolves a content field using APPROVED translations only.
 * - If translationStatus is present and not APPROVED, we fall back to the source/original text.
 * - Never shows BLOCKED translations.
 * - If no translation status exists, returns the best available field (keeps current behavior).
 */
export function resolveArticleField(
  article: unknown,
  field: 'title' | 'summary' | 'excerpt',
  requestedLang: UiLang
): ResolvedContent {
  const item = (article && typeof article === 'object') ? (article as any) : null;
  if (!item) return { text: '', isOriginal: false };

  const lang = normLang(requestedLang) || 'en';
  const sourceLang = getSourceLang(item);

  const source = getFieldSource(item, field);
  const translated = getTranslatedField(item, field, lang);
  const status = getStatusField(item, field, lang);

  // If backend exposes a status, enforce safety rules.
  if (status) {
    if (status === 'APPROVED') {
      const text = translated || pickNonEmpty(item?.[field]);
      return { text, isOriginal: false };
    }

    // BLOCKED/PENDING/REJECTED/etc => show source/original (never blank)
    const text = source || translated || pickNonEmpty(item?.[field]);
    const isOriginal = Boolean(sourceLang && sourceLang !== lang);
    return { text, isOriginal };
  }

  // No status => preserve existing behavior (API already language-filtered in most deployments)
  const best = pickNonEmpty(item?.[field], translated, source);
  return { text: best, isOriginal: false };
}

export function resolveArticleTitle(article: unknown, requestedLang: UiLang): ResolvedContent {
  return resolveArticleField(article, 'title', requestedLang);
}

export function resolveArticleSummaryOrExcerpt(article: unknown, requestedLang: UiLang): ResolvedContent {
  const s = resolveArticleField(article, 'summary', requestedLang);
  if (s.text) return s;
  return resolveArticleField(article, 'excerpt', requestedLang);
}
