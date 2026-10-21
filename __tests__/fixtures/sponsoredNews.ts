import type { RouteLocale } from '../../lib/localizedArticleFields';
import { SPONSORED_NEWS_PAGE_SIZE } from '../../lib/publicSponsoredNews';

export function sponsoredArticleFixture(index = 1, lang: RouteLocale = 'en', overrides: Record<string, unknown> = {}) {
  const titles = { gu: 'પ્રાયોજિત લેખ', hi: 'प्रायोजित लेख', en: 'Sponsored article' };
  return {
    _id: `sponsored-${index}-${lang}`,
    slug: `persisted-story-${index}`,
    canonicalSlug: `unused-locale-alias-${index}`,
    title: `${titles[lang]} ${index}`,
    summary: `${titles[lang]} ${index} - ${lang}`,
    category: ['business', 'tech', 'lifestyle'][(index - 1) % 3],
    language: lang,
    status: 'published',
    publishedAt: '2025-01-01T00:00:00.000Z',
    translationGroupId: `sponsored-group-${index}`,
    translationKey: `sponsored-key-${index}`,
    translations: { en: true, hi: true, gu: true },
    imageUrl: '/fallback.svg',
    isSponsoredArticle: true,
    sponsorName: `Example Sponsor ${index}`,
    sponsorDisclosure: 'Public sponsor disclosure',
    campaignStatus: 'expired',
    campaignEndAt: '2025-02-01T00:00:00.000Z',
    ...overrides,
  };
}

export function sponsoredNewsFixture(lang: RouteLocale = 'en', page = 1, total = 25) {
  const offset = (page - 1) * SPONSORED_NEWS_PAGE_SIZE;
  return {
    items: Array.from({ length: Math.min(SPONSORED_NEWS_PAGE_SIZE, Math.max(0, total - offset)) },
      (_, index) => sponsoredArticleFixture(offset + index + 1, lang)),
    page, limit: SPONSORED_NEWS_PAGE_SIZE, total, totalPages: Math.ceil(total / SPONSORED_NEWS_PAGE_SIZE),
  };
}
