import { resolveCoverImageUrl } from './coverImages';

function readText(value: unknown): string {
  return String(value || '').trim();
}

export function getStoryId(story: any): string {
  return readText(story?._id) || readText(story?.id);
}

export function getStoryLang(story: any): string {
  return readText(story?.lang) || readText(story?.language) || readText(story?.sourceLang) || readText(story?.sourceLanguage);
}

export function getStorySlug(story: any): string {
  return readText(story?.slug);
}

export function getStoryTranslationGroupId(story: any): string {
  return readText(story?.translationGroupId);
}

export function getStoryReactKey(story: any, fallback?: unknown): string {
  const id = getStoryId(story);
  const lang = getStoryLang(story);

  if (id) return lang ? `${id}-${lang}` : id;

  const slug = getStorySlug(story);
  if (slug) return lang ? `${slug}-${lang}` : slug;

  const fallbackKey = readText(fallback);
  return lang && fallbackKey ? `${fallbackKey}-${lang}` : fallbackKey;
}

export function debugStoryCard(scope: string, story: any, coverImageUrl?: unknown) {
  if (process.env.NODE_ENV === 'production' || typeof window === 'undefined') return;

  const id = getStoryId(story) || null;
  const slug = getStorySlug(story) || null;
  const translationGroupId = getStoryTranslationGroupId(story) || null;
  const title = readText(story?.title) || null;
  const coverUrl = readText(coverImageUrl) || resolveCoverImageUrl(story) || null;
  const cacheKey = `${scope}|${id || ''}|${slug || ''}|${translationGroupId || ''}|${title || ''}|${coverUrl || ''}`;
  const globalKey = '__NEWSPULSE_STORY_CARD_DEBUG__';
  const globalStore = window as typeof window & { [key: string]: Set<string> | undefined };
  const seen = globalStore[globalKey] || new Set<string>();

  if (seen.has(cacheKey)) return;

  seen.add(cacheKey);
  globalStore[globalKey] = seen;

  console.debug(`[story-card:${scope}]`, {
    title,
    _id: id,
    slug,
    translationGroupId,
    coverImageUrl: coverUrl,
  });
}