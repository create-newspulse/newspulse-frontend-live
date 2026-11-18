export type NewsLang = 'en' | 'hi' | 'gu';

function knownLang(value: unknown): NewsLang | null {
  const v = String(value || '').toLowerCase().trim().split(/[-_]/)[0];
  if (v === 'hi' || v === 'hindi' || v === 'in') return 'hi';
  if (v === 'gu' || v === 'gujarati') return 'gu';
  return v === 'en' || v === 'english' ? 'en' : null;
}

function get(obj: unknown, path: string[]): unknown {
  let cur = obj;
  for (const key of path) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

function slugText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  for (const key of ['text', 'value', 'slug']) {
    const text = get(value, [key]);
    if (typeof text === 'string' && text.trim()) return text.trim();
  }
  return '';
}

export function normalizeArticleSlug(value: unknown): string {
  const raw = slugText(value);
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return '';
  }
}

export function isArticleId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
}

export function isLocalizedArticleSlug(value: unknown, lang: NewsLang): boolean {
  const slug = normalizeArticleSlug(value);
  if (!slug || /^(?:null|undefined)$/i.test(slug) || isArticleId(slug)
    || /[/\\?#%\s\u0000-\u001f\u007f]/u.test(slug) || !/[\p{L}\p{N}]/u.test(slug)) return false;
  const allowed = lang === 'hi' ? /[\p{Script=Latin}\p{Script=Devanagari}]/u
    : lang === 'gu' ? /[\p{Script=Latin}\p{Script=Gujarati}]/u : /\p{Script=Latin}/u;
  return [...slug].every(char => !/\p{L}/u.test(char) || allowed.test(char));
}

export function getArticleEditionLocale(article: unknown): NewsLang | null {
  for (const key of ['language', 'lang', 'resolvedLanguage', 'resolvedLang', 'sourceLang', 'sourceLanguage']) {
    const locale = knownLang(get(article, [key]));
    if (locale) return locale;
  }
  return null;
}

function localizedSlug(article: unknown, lang: NewsLang): string {
  const candidates: unknown[] = [];
  for (const key of lang === 'hi' ? ['hi', 'in'] : [lang]) {
    candidates.push(get(article, ['slugs', key]), get(article, ['slug', key]));
    for (const group of ['translations', 'translation', 'i18n', 'localized', 'locales', 'byLang', 'textByLang']) {
      candidates.push(get(article, [group, key, 'slug']), get(article, [group, 'slug', key]));
    }
    for (const field of [`slug_${key}`, `slug${key.toUpperCase()}`, `slug${key[0].toUpperCase()}${key.slice(1)}`, `${key}_slug`, `${key}Slug`]) {
      candidates.push(get(article, [field]));
    }
  }
  const match = candidates.find(value => isLocalizedArticleSlug(value, lang));
  return normalizeArticleSlug(match);
}

export function resolveArticleSlugs(article: unknown): Record<NewsLang, string> {
  return { en: localizedSlug(article, 'en'), hi: localizedSlug(article, 'hi'), gu: localizedSlug(article, 'gu') };
}

export function resolveArticleSlug(article: unknown, langInput: unknown): string {
  const lang = knownLang(langInput) || 'en';
  const slugs = resolveArticleSlugs(article);
  const rawId = get(article, ['_id']) || get(article, ['id']);
  const id = isArticleId(rawId) ? rawId.toLowerCase() : '';
  const edition = getArticleEditionLocale(article);
  const original = knownLang(get(article, ['originalLang']) || get(article, ['sourceLang'])) || edition;
  const ownsBaseSlug = original === lang && get(article, ['isTranslated']) !== true;

  // Detail responses can deliberately choose the ID when an otherwise valid alias collides.
  if (edition === lang) {
    for (const field of ['canonicalSlug', 'localizedSlug']) {
      const canonical = normalizeArticleSlug(get(article, [field]));
      if (id && canonical.toLowerCase() === id) return id;
      const foreignOwner = Object.entries(slugs).some(([locale, value]) => locale !== lang && value === canonical);
      const localizedCanonical = get(article, ['isTranslated']) === true
        && canonical !== normalizeArticleSlug(get(article, ['slug']));
      if (isLocalizedArticleSlug(canonical, lang)
        && (slugs[lang] === canonical || !foreignOwner && (ownsBaseSlug || localizedCanonical))) return canonical;
    }
  }
  if (slugs[lang]) return slugs[lang];
  if (ownsBaseSlug) {
    for (const field of ['slug', 'seoSlug']) {
      const legacy = normalizeArticleSlug(get(article, [field]));
      const foreignOwner = Object.entries(slugs).some(([locale, value]) => locale !== lang && value === legacy);
      if (!foreignOwner && isLocalizedArticleSlug(legacy, lang)) return legacy;
    }
  }
  return id;
}
