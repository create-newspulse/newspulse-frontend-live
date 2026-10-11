import type { RouteLocale } from '../../lib/localizedArticleFields';

export const topicNames = {
  en: 'Navratri 2026',
  hi: '\u0928\u0935\u0930\u093e\u0924\u094d\u0930\u093f 2026',
  gu: '\u0aa8\u0ab5\u0ab0\u0abe\u0aa4\u0acd\u0ab0\u0abf 2026',
};

export const topicDescriptions = {
  en: 'Festival coverage',
  hi: '\u0924\u094d\u092f\u094b\u0939\u093e\u0930 \u0915\u0940 \u0916\u092c\u0930\u0947\u0902',
  gu: '\u0aa4\u0ab9\u0ac7\u0ab5\u0abe\u0ab0\u0aa8\u0abe \u0ab8\u0aae\u0abe\u0a9a\u0abe\u0ab0',
};

export function topicFixture(lang: RouteLocale = 'en', overrides: Record<string, unknown> = {}) {
  const slug = typeof overrides.slug === 'string' ? overrides.slug : 'navratri-2026';
  return {
    id: '000000000000000000000001', key: slug, slug, label: topicNames[lang],
    href: `/topic/${slug}`, colorKey: 'blue', name: topicNames, description: topicDescriptions,
    order: 1, startsAt: '2020-01-01T00:00:00.000Z', expiresAt: null, ...overrides,
  };
}

export function storyFixture(index: number, lang: RouteLocale = 'en', category = 'regional') {
  const id = index.toString(16).padStart(24, '0');
  return {
    id, _id: id, articleId: id, slug: `story-${index}`, canonicalSlug: `story-${index}`,
    title: `${topicNames[lang]} story ${index}`, summary: `Summary ${index}`, category,
    lang, language: lang, requestedLang: lang, resolvedLang: lang, isTranslated: false, isFallback: false,
    translationKey: `group-${index}`, translationGroupId: null,
    publishedAt: '2026-10-01T10:00:00.000Z', imageUrl: null, coverImageUrl: null, imageAlt: null,
  };
}

export function storyPageFixture(lang: RouteLocale = 'en', page = 1, total = 13) {
  const count = Math.min(12, Math.max(0, total - (page - 1) * 12));
  return {
    ok: true, lang, total, count, page, limit: 12, totalPages: Math.ceil(total / 12),
    hasNextPage: page * 12 < total,
    items: Array.from({ length: count }, (_, index) =>
      storyFixture(total - (page - 1) * 12 - index, lang, ['regional', 'national', 'sports', 'business'][index % 4])),
  };
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}
