import type { RouteLocale } from '../../lib/localizedArticleFields';
import type { Article } from '../../lib/publicNewsApi';

export type FaithStory = Article & {
  title: string;
  slug: string;
  language: RouteLocale;
  category: string;
  status: string;
  publishedAt: string;
};

export function faithStories(language: RouteLocale, total = 100): FaithStory[] {
  const prefix = language === 'hi' ? '\u0938\u092e\u093e\u091a\u093e\u0930'
    : language === 'gu' ? '\u0ab8\u0aae\u0abe\u0a9a\u0abe\u0ab0' : 'Story';
  return Array.from({ length: total }, (_, index) => ({
    _id: `${language}-faith-${String(index).padStart(3, '0')}`,
    slug: `${language}-faith-${String(index).padStart(3, '0')}`,
    category: 'faith-culture', language, status: 'published',
    title: `${prefix} ${language}-faith-${index}`, summary: `Summary ${index}`, content: 'Full article body',
    publishedAt: new Date(Date.parse('2026-09-30T12:00:00.000Z') - index * 86400000).toISOString(),
    updatedAt: index ? '2026-10-06T12:00:00.000Z' : '2026-09-30T12:00:00.000Z',
  }));
}

export function faithPage(stories: FaithStory[], page: number) {
  return {
    items: stories.slice((page - 1) * 30, page * 30),
    page, limit: 30, total: stories.length,
    totalPages: Math.max(1, Math.ceil(stories.length / 30)),
    hasMore: page * 30 < stories.length,
  };
}
