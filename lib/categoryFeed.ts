import { getCategoryQueryKey } from './categoryKeys';
import { filterPubliclyPublishedArticles, getLocalizedArticleFields, STRICT_LOCALE_POLICY } from './localizedArticleFields';
import { fetchPublicNews, type Article } from './publicNewsApi';
import { getStoryId } from './storyIdentity';

export const CATEGORY_FEED_BATCH_SIZE = 30;
export const CATEGORY_FEED_TIMEOUT_MS = 4000;
export const CATEGORY_FEED_REFRESH_MS = 60_000;

function getArticleStableKey(article: Article): string {
  return String(getStoryId(article) || (article as any)?.translationGroupId || article?.slug || '').trim().toLowerCase();
}

function dedupeArticles(articles: Article[]): Article[] {
  const seen = new Set<string>();
  const output: Article[] = [];
  for (const article of articles) {
    const key = getArticleStableKey(article);
    if (key) {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    output.push(article);
  }
  return output;
}

function getCategoryPublishTimeValue(article: Article): number {
  for (const value of [(article as any)?.publishedAt, (article as any)?.publishAt, (article as any)?.createdAt]) {
    const raw = String(value || '').trim();
    if (!raw) continue;
    const parsed = Date.parse(raw);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function pushCategoryKeys(output: Set<string>, value: unknown) {
  if (!value) return;
  if (Array.isArray(value)) {
    value.forEach((item) => pushCategoryKeys(output, item));
    return;
  }
  if (typeof value === 'object') {
    pushCategoryKeys(output, (value as any).key);
    pushCategoryKeys(output, (value as any).slug);
    pushCategoryKeys(output, (value as any).value);
    pushCategoryKeys(output, (value as any).name);
    pushCategoryKeys(output, (value as any).label);
    return;
  }
  const key = getCategoryQueryKey(value);
  if (key) output.add(key);
}

function articleMatchesCategory(article: Article, categoryKey: string): boolean {
  const targetKey = getCategoryQueryKey(categoryKey);
  if (!targetKey) return true;
  const keys = new Set<string>();
  for (const field of ['category', 'categoryKey', 'primaryCategory', 'section', 'desk', 'topic', 'categories']) {
    pushCategoryKeys(keys, (article as any)?.[field]);
  }
  return keys.has(targetKey);
}

export function selectCategoryFeedArticles(articles: Article[] | null | undefined, categoryKey: string, language?: string): Article[] {
  const publicArticles = filterPubliclyPublishedArticles(articles);
  const categoryArticles = publicArticles.filter((article) => articleMatchesCategory(article, categoryKey));
  const localeArticles = language ? categoryArticles.filter((article) => {
    const localized = getLocalizedArticleFields(article, language, STRICT_LOCALE_POLICY);
    return localized.isVisible && Boolean(localized.title);
  }) : categoryArticles;
  return dedupeArticles(localeArticles.slice().sort((left, right) => {
    const leftTime = getCategoryPublishTimeValue(left);
    const rightTime = getCategoryPublishTimeValue(right);
    if (leftTime !== rightTime) return rightTime - leftTime;
    return String((left as any)?._id || (left as any)?.id || left?.slug || '')
      .localeCompare(String((right as any)?._id || (right as any)?.id || right?.slug || ''));
  }));
}

export async function fetchCategoryFeed(options: Parameters<typeof fetchPublicNews>[0]): ReturnType<typeof fetchPublicNews> {
  const controller = new AbortController();
  let timer!: ReturnType<typeof setTimeout>;
  let cancel!: () => void;
  const deadline = new Promise<never>((_resolve, reject) => {
    cancel = () => {
      reject(new Error('Category fetch cancelled'));
      controller.abort();
    };
    timer = setTimeout(() => {
      reject(new Error('Category fetch timed out'));
      controller.abort();
    }, CATEGORY_FEED_TIMEOUT_MS);
    options.signal?.addEventListener('abort', cancel, { once: true });
    if (options.signal?.aborted) cancel();
  });
  try {
    return await Promise.race([fetchPublicNews({ ...options, signal: controller.signal }), deadline]);
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
  }
}