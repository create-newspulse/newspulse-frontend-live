export type NewsLang = 'en' | 'hi' | 'gu';

function normalizeLang(value: unknown): NewsLang {
  const v = String(value || '').toLowerCase().trim();
  if (v === 'hi' || v === 'hindi' || v === 'in') return 'hi';
  if (v === 'gu' || v === 'gujarati') return 'gu';
  return 'en';
}

export function buildNewsUrl(options: { id: string; slug?: string; lang?: unknown }): string {
  const rawSlug = String(options.slug || '').trim();
  const rawId = String(options.id || '').trim();
  const slug = encodeURIComponent(rawSlug || rawId);
  const lang = normalizeLang(options.lang);

  if (!slug) return '#';

  // Default locale should NOT be prefixed.
  const prefix = lang !== 'en' ? `/${lang}` : '';

  // Canonical single-segment news URLs: /news/<slug>
  return `${prefix}/news/${slug}`;
}

export function splitNewsParams(value: unknown): { id: string; slug: string } | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const id = raw;
  const slug = raw;
  return { id, slug };
}
