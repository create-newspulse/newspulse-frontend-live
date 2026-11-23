import { resolveCoverImageUrl } from './coverImages';
import { getLocalizedArticleFields, STRICT_LOCALE_POLICY, type RouteLocale } from './localizedArticleFields';
import { buildNewsUrl } from './newsRoutes';
import type { Article } from './publicNewsApi';
import { getStoryId, getStoryReactKey } from './storyIdentity';

export function packDetailArticle(article: Article): { article: Article; bodyIsContent?: true } {
  if (typeof article.content !== 'string' || article.body !== article.content) return { article };
  const { body, ...rest } = article;
  return { article: rest, bodyIsContent: true };
}

type RelatedStory = Pick<Article, '_id' | 'slug' | 'slugs' | 'translationKey' | 'translationGroupId'> & {
  card?: { key: string; href: string; title: string; summary: string; imageUrl: string };
};

export function projectArticleRelatedStories(stories: Article[], lang: RouteLocale): RelatedStory[] {
  return stories.slice(0, 12).flatMap((story, index) => {
    const localized = getLocalizedArticleFields(story, lang, STRICT_LOCALE_POLICY);
    if (localized.status !== 'published') return [];
    // Related Contributions excludes all 12 by ID, group and slug; only the first six render cards.
    const identity: RelatedStory = { _id: getStoryId(story) };
    if (story.slug) identity.slug = story.slug;
    if (story.slugs) identity.slugs = story.slugs;
    if (story.translationKey) identity.translationKey = story.translationKey;
    if (story.translationGroupId) identity.translationGroupId = story.translationGroupId;
    if (index < 6 && localized.isVisible) {
      const href = buildNewsUrl({ id: identity._id, slug: localized.slug || identity._id, lang });
      identity.card = {
        key: getStoryReactKey(story, href), href, title: localized.title, summary: localized.summary,
        imageUrl: resolveCoverImageUrl(story, { lang }) || '',
      };
    }
    return [identity];
  });
}
