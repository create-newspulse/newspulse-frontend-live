import type { GetStaticPropsContext, GetStaticPropsResult } from 'next';
import { CATEGORY_FEED_BATCH_SIZE, CATEGORY_FEED_REFRESH_MS, fetchCategoryFeed, selectCategoryFeedArticles } from './categoryFeed';
import { getArticleReadingTime } from './editorialDisplay';
import type { Article } from './publicNewsApi';

export type CategoryPageProps = {
  messages: any;
  locale: string;
  initialItems: Article[];
};

function withoutArticleBody(article: Record<string, any>): Record<string, any> {
  const { content, html, body, blocks, contentBlocks, ...listing } = article;
  return listing;
}

function compactCategoryArticle(article: Article): Article {
  const listing = withoutArticleBody(article);
  for (const group of ['translations', 'translation', 'i18n', 'localized', 'locales', 'byLang', 'textByLang']) {
    const translations = listing[group];
    if (!translations || typeof translations !== 'object' || Array.isArray(translations)) continue;
    listing[group] = Object.fromEntries(Object.entries(translations).map(([locale, fields]) => [
      locale,
      fields && typeof fields === 'object' && !Array.isArray(fields) ? withoutArticleBody(fields) : fields,
    ]));
  }
  return { ...listing, _id: article._id, readingTime: getArticleReadingTime(article) } as Article;
}

export async function getCategoryStaticProps(ctx: GetStaticPropsContext, category: string): Promise<GetStaticPropsResult<CategoryPageProps>> {
  const locale = ctx.locale === 'hi' || ctx.locale === 'gu' ? ctx.locale : 'en';
  const { getMessages } = await import('./getMessages');
  const messages = await getMessages(locale);
  let initialItems: Article[] = [];
  try {
    const response = await fetchCategoryFeed({
      category,
      language: locale,
      limit: CATEGORY_FEED_BATCH_SIZE,
      extraQuery: { strictLocale: '1' },
    });
    if (response.error) throw new Error(response.error);
    initialItems = selectCategoryFeedArticles(response.items, category, locale)
      .slice(0, CATEGORY_FEED_BATCH_SIZE)
      .map(compactCategoryArticle);
  } catch (error) {
    if (ctx.revalidateReason === 'stale') throw error;
  }
  return {
    props: { messages, locale, initialItems },
    revalidate: CATEGORY_FEED_REFRESH_MS / 1000,
  };
}