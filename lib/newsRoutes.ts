export type NewsLang = 'en' | 'hi' | 'gu';

function normalizeLang(value: unknown): NewsLang {
  const v = String(value || '').toLowerCase().trim();
  if (v === 'hi' || v === 'hindi') return 'hi';
  if (v === 'gu' || v === 'gujarati') return 'gu';
  return 'en';
}

export function buildNewsUrl(options: { id: string; slug?: string; lang?: unknown }): string {
  const id = encodeURIComponent(String(options.id || '').trim());
  const slugRaw = String(options.slug || '').trim();
  const slug = encodeURIComponent(slugRaw || String(options.id || '').trim());
  const lang = normalizeLang(options.lang);

  if (!id) return '#';

  // Default locale should NOT be prefixed.
  const prefix = lang !== 'en' ? `/${lang}` : '';
  return `${prefix}/news/${id}/${slug}`;
}

export function splitNewsParams(value: unknown): { id: string; slug: string } | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const id = raw;
  const slug = raw;
  return { id, slug };
}
