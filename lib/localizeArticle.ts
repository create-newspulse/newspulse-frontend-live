export type UiLang = 'en' | 'hi' | 'gu';

export type LocalizedArticle = {
  title: string;
  content: string;
};

function hasGujaratiScript(s: string): boolean {
  return /[\u0A80-\u0AFF]/.test(s);
}

function hasDevanagariScript(s: string): boolean {
  return /[\u0900-\u097F]/.test(s);
}

function looksLikeEnglish(s: string): boolean {
  const t = String(s || '').trim();
  if (!t) return false;
  // If it contains Gujarati/Devanagari, it's not an English title.
  return !hasGujaratiScript(t) && !hasDevanagariScript(t);
}

function matchesRequestedScript(title: string, lang: UiLang): boolean {
  const t = String(title || '').trim();
  if (!t) return false;
  if (lang === 'gu') return hasGujaratiScript(t);
  if (lang === 'hi') return hasDevanagariScript(t);
  return looksLikeEnglish(t);
}

function deriveTitleFromContent(content: string, lang: UiLang): string {
  const raw = String(content || '').replace(/\s+/g, ' ').trim();
  if (!raw) return '';

  const sentenceSplit = (() => {
    // Prefer language-appropriate sentence boundary.
    if (lang === 'hi' || lang === 'gu') {
      const idx = raw.indexOf('।');
      if (idx > 20) return raw.slice(0, idx);
    }
    for (const sep of ['.', '!', '?']) {
      const idx = raw.indexOf(sep);
      if (idx > 30) return raw.slice(0, idx);
    }
    return raw;
  })();

  const s = sentenceSplit.trim();
  if (!s) return '';
  // Keep it short and UI-safe.
  return s.length > 120 ? `${s.slice(0, 120).trim()}…` : s;
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

function normalizeLang(raw: unknown): UiLang {
  const v = String(raw || '').toLowerCase().trim();
  if (v === 'hi' || v === 'hindi' || v === 'in') return 'hi';
  if (v === 'gu' || v === 'gujarati') return 'gu';
  return 'en';
}

function pickLangField(article: any, lang: UiLang, fieldNames: string[]): string {
  const langKeys = [lang, lang === 'hi' ? 'in' : null].filter(Boolean) as string[];

  const candidates: unknown[] = [];

  // Common nested shapes: translations.{lang}.{field}
  for (const lk of langKeys) {
    for (const f of fieldNames) {
      candidates.push(get(article, ['translations', lk, f]));
      candidates.push(get(article, ['translation', lk, f]));
      candidates.push(get(article, ['i18n', lk, f]));
    }
  }

  // Flat suffix/prefix shapes: title_hi, titleHi, hiTitle, etc.
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

  // Generic nested shapes: { title: { en: '...', hi: '...' } }
  for (const lk of langKeys) {
    for (const f of fieldNames) {
      candidates.push(get(article, [f, lk]));
      candidates.push(get(article, [f, 'value', lk]));
    }
  }

  return pickFirstNonEmpty(...candidates);
}

function pickBaseField(article: any, fieldNames: string[]): string {
  const candidates: unknown[] = [];
  for (const f of fieldNames) {
    candidates.push(article?.[f]);
  }
  return pickFirstNonEmpty(...candidates);
}

export function localizeArticle(article: any, langInput: unknown): LocalizedArticle {
  try {
    const lang = normalizeLang(langInput);

    const titlePicked = pickFirstNonEmpty(
      pickLangField(article, lang, ['title', 'headline', 'name']),
      pickBaseField(article, ['title', 'headline', 'name']),
      ''
    );

    const content = pickFirstNonEmpty(
      pickLangField(article, lang, ['content', 'body', 'html', 'description', 'excerpt', 'summary']),
      pickBaseField(article, ['content', 'body', 'html', 'description', 'excerpt', 'summary']),
      ''
    );

    // If the title is present but clearly in a different script than the requested language,
    // and we have localized content, derive a safe title snippet from the content.
    const title = (() => {
      const t = String(titlePicked || '').trim();
      if (!t) return deriveTitleFromContent(content, lang);
      if (!matchesRequestedScript(t, lang)) {
        const derived = deriveTitleFromContent(content, lang);
        return derived || t;
      }
      return t;
    })();

    return { title, content };
  } catch {
    return { title: '', content: '' };
  }
}
