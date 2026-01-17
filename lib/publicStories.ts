import { getPublicApiBaseUrl } from './publicApiBase';

export type PublicStory = {
  _id: string;
  slug?: string;
  title?: string;
  summary?: string;
  category?: string | { name?: string; title?: string; slug?: string };
  language?: string;
  status?: string;
  createdAt?: string;
  publishedAt?: string;
  content?: string;
};

export function getApiBaseUrl(): string {
  return getPublicApiBaseUrl();
}

function unwrapStories(payload: any): PublicStory[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;

  const candidates = [payload.stories, payload.data, payload.items, payload.result];
  for (const c of candidates) {
    if (Array.isArray(c)) return c;
  }

  return [];
}

function unwrapStory(payload: any): PublicStory | null {
  if (!payload) return null;
  if (payload.story && typeof payload.story === 'object') return payload.story as PublicStory;
  if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) return payload.data as PublicStory;
  if (typeof payload === 'object' && !Array.isArray(payload) && payload._id) return payload as PublicStory;
  return null;
}

export async function fetchPublicStories(baseUrl?: string): Promise<PublicStory[]> {
  const base = (baseUrl || getApiBaseUrl()).replace(/\/+$/, '');
  const url = `${base}/api/public/stories`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch stories (${res.status})`);

  const json = await res.json().catch(() => null);
  return unwrapStories(json);
}

export async function fetchPublicStoryByIdOrSlug(idOrSlug: string, baseUrl?: string): Promise<PublicStory | null> {
  const base = (baseUrl || getApiBaseUrl()).replace(/\/+$/, '');

  // Preferred endpoint
  try {
    const res = await fetch(`${base}/api/public/stories/${encodeURIComponent(idOrSlug)}`);
    if (res.ok) {
      const json = await res.json().catch(() => null);
      const story = unwrapStory(json);
      if (story && story._id) return story;
    }

    // If 404 (or any non-OK), fall through to list fallback
  } catch {
    // fall through
  }

  // Fallback: fetch list and match by _id or slug
  try {
    const stories = await fetchPublicStories(base);
    const match = stories.find((s) => s?._id === idOrSlug || (s?.slug && s.slug === idOrSlug));
    return match || null;
  } catch {
    return null;
  }
}

export function getStoryCategoryLabel(category: PublicStory['category']): string {
  if (!category) return '';
  if (typeof category === 'string') return category;
  return category.title || category.name || category.slug || '';
}

export function getStoryDateIso(story: PublicStory): string {
  return story.publishedAt || story.createdAt || '';
}
