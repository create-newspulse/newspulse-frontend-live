import { getLocalizedArticleFields } from './localizedArticleFields';

export type UiLang = 'en' | 'hi' | 'gu';

export type LocalizedArticle = {
  title: string;
  content: string;
};

function normalizeLang(raw: unknown): UiLang {
  const v = String(raw || '').toLowerCase().trim();
  if (v === 'hi' || v === 'hindi' || v === 'in') return 'hi';
  if (v === 'gu' || v === 'gujarati') return 'gu';
  return 'en';
}

export function localizeArticle(article: any, langInput: unknown): LocalizedArticle {
  try {
    const lang = normalizeLang(langInput);
    const localized = getLocalizedArticleFields(article || {}, lang);
    // `getLocalizedArticleFields` already enforces:
    // - published-only
    // - locale-only
    // - sanitized title/summary (no HTML tag leakage)
    return {
      title: String(localized.title || '').trim(),
      content: String(localized.bodyHtml || localized.summary || '').trim(),
    };
  } catch {
    return { title: '', content: '' };
  }
}
