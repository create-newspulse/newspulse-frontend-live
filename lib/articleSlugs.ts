export type NewsLang = 'en' | 'hi' | 'gu';

function normalizeLang(value: unknown): NewsLang {
  const v = String(value || '').toLowerCase().trim();
  if (v === 'hi' || v === 'hindi' || v === 'in') return 'hi';
  if (v === 'gu' || v === 'gujarati') return 'gu';
  return 'en';
}

function toSafeString(v: unknown): string {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

function pickFirstNonEmpty(...values: unknown[]): string {
  for (const v of values) {
    const s = toSafeString(v).trim();
    if (s) return s;
  }
  return '';
}

function get(obj: any, path: string[]): unknown {
  let cur = obj;
  for (const key of path) {
    if (!cur || typeof cur !== 'object') return undefined;
    cur = cur[key];
  }
  return cur;
}

function pickLangField(article: any, lang: NewsLang, fieldNames: string[]): string {
  const langKeys = [lang, lang === 'hi' ? 'in' : null].filter(Boolean) as string[];

  const candidates: unknown[] = [];

  // Preferred structured shapes: slugs.{lang}, slug.{lang}
  for (const lk of langKeys) {
    for (const f of fieldNames) {
      candidates.push(get(article, [f, lk]));
      candidates.push(get(article, ['slugs', lk]));
      candidates.push(get(article, ['slug', lk]));
    }
  }

  // Common nested translation shapes: translations.{lang}.slug
  for (const lk of langKeys) {
    for (const f of fieldNames) {
      candidates.push(get(article, ['translations', lk, f]));
      candidates.push(get(article, ['translation', lk, f]));
      candidates.push(get(article, ['i18n', lk, f]));
    }
  }

  // Flat suffix/prefix shapes: slug_en, slugEn, en_slug, enSlug
  for (const lk of langKeys) {
    const cap = lk.charAt(0).toUpperCase() + lk.slice(1);
    for (const f of fieldNames) {
      candidates.push(article?.[`${f}_${lk}`]);
      candidates.push(article?.[`${f}${cap}`]);
      candidates.push(article?.[`${lk}_${f}`]);
      candidates.push(article?.[`${lk}${cap}`]);
      candidates.push(article?.[`${lk}${f.charAt(0).toUpperCase()}${f.slice(1)}`]);
    }
  }

  return pickFirstNonEmpty(...candidates);
}

function sanitizeSlug(raw: string): string {
  const s = String(raw || '').trim();
  if (!s) return '';
  // Keep as-is, but strip leading/trailing slashes.
  return s.replace(/^\/+/, '').replace(/\/+$/, '');
}

export function resolveArticleSlugs(article: any): { en: string; hi: string; gu: string } {
  const en = sanitizeSlug(pickFirstNonEmpty(pickLangField(article, 'en', ['slug']), article?.slug_en, article?.slugEn));
  const hi = sanitizeSlug(pickFirstNonEmpty(pickLangField(article, 'hi', ['slug']), article?.slug_hi, article?.slugHi, article?.slug_in, article?.slugIn));
  const gu = sanitizeSlug(pickFirstNonEmpty(pickLangField(article, 'gu', ['slug']), article?.slug_gu, article?.slugGu));

  return { en, hi, gu };
}

export function resolveArticleSlug(article: any, langInput: unknown): string {
  const lang = normalizeLang(langInput);
  const slugs = resolveArticleSlugs(article);

  const picked = lang === 'hi' ? slugs.hi : lang === 'gu' ? slugs.gu : slugs.en;
  return sanitizeSlug(pickFirstNonEmpty(picked, article?.slug, article?.seoSlug, article?._id, article?.id));
}
