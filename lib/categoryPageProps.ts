import type { GetStaticPropsContext, GetStaticPropsResult } from 'next';
import { CATEGORY_FEED_BATCH_SIZE, CATEGORY_FEED_REFRESH_MS, fetchCategoryFeed, fetchCategoryFeedPage, selectCategoryFeedArticles } from './categoryFeed';
import { getArticleReadingTime } from './editorialDisplay';
import type { Article } from './publicNewsApi';
import { getOrdinaryCategoryBatchSize, isOrdinaryPaginatedCategory, type OrdinaryCategoryPagination } from './ordinaryCategoryPagination';
import { FAITH_CULTURE_PAGE_SIZE, isFaithCultureCategory } from './faithCulturePagination';
import { getLocalizedArticleFields, STRICT_LOCALE_POLICY, type RouteLocale } from './localizedArticleFields';

export type CategoryPageProps = {
  messages: any;
  locale: string;
  initialItems: Article[];
  initialPagination?: OrdinaryCategoryPagination;
};

function withoutArticleBody(article: Record<string, any>, localizedBody?: string): Record<string, any> {
  const { content, html, body, blocks, contentBlocks, ...listing } = article;
  return localizedBody ? { ...listing, content: localizedBody } : listing;
}

function compactCategoryArticle(article: Article, locale: RouteLocale): Article {
  const listing = withoutArticleBody(article);
  const localized = getLocalizedArticleFields(article, locale, STRICT_LOCALE_POLICY);
  const localizedBody = localized.isVisible && localized.sourceLocale !== locale && localized.translationFound
    ? localized.bodyHtml.slice(0, 256) : undefined;
  for (const group of ['translations', 'translation', 'i18n', 'localized', 'locales', 'byLang', 'textByLang']) {
    const translations = listing[group];
    if (!translations || typeof translations !== 'object' || Array.isArray(translations)) continue;
    listing[group] = Object.fromEntries(Object.entries(translations).map(([language, fields]) => [
      language,
      fields && typeof fields === 'object' && !Array.isArray(fields)
        ? withoutArticleBody(fields, language === locale || (locale === 'hi' && language === 'in') ? localizedBody : undefined)
        : fields,
    ]));
  }
  return { ...listing, _id: article._id, readingTime: getArticleReadingTime(article) } as Article;
}

export async function getCategoryStaticProps(ctx: GetStaticPropsContext, category: string): Promise<GetStaticPropsResult<CategoryPageProps>> {
  const locale = ctx.locale === 'hi' || ctx.locale === 'gu' ? ctx.locale : 'en';
  const { getMessages } = await import('./getMessages');
  const messages = await getMessages(locale);
  let initialItems: Article[] = [];
  let initialPagination: OrdinaryCategoryPagination | undefined;
  try {
    if (isFaithCultureCategory(category) || isOrdinaryPaginatedCategory(category)) {
      const response = await fetchCategoryFeedPage({
        category, language: locale, page: 1,
        limit: isFaithCultureCategory(category) ? FAITH_CULTURE_PAGE_SIZE : getOrdinaryCategoryBatchSize(category),
        extraQuery: { strictLocale: '1' },
        selectItems: (items) => selectCategoryFeedArticles(items, category, locale),
      });
      initialItems = response.items.map(article => compactCategoryArticle(article, locale));
      initialPagination = response.pagination;
    } else {
      const response = await fetchCategoryFeed({
        category,
        language: locale,
        limit: CATEGORY_FEED_BATCH_SIZE,
        extraQuery: { strictLocale: '1' },
      });
      if (response.error) throw new Error(response.error);
      initialItems = selectCategoryFeedArticles(response.items, category, locale)
        .slice(0, CATEGORY_FEED_BATCH_SIZE)
        .map(article => compactCategoryArticle(article, locale));
    }
  } catch (error) {
    if (isFaithCultureCategory(category) || ctx.revalidateReason === 'stale') throw error;
  }
  return {
    props: { messages, locale, initialItems, ...(initialPagination ? { initialPagination } : {}) },
    revalidate: CATEGORY_FEED_REFRESH_MS / 1000,
  };
}