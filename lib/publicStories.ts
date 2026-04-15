import { getPublicApiBaseUrl } from './publicApiBase';
import { resolveStoryDateIso } from './storyDateTime';

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
  updatedAt?: string;
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

export async function fetchPublicStories(
  baseUrl?: string,
  options?: {
    language?: string;
    category?: string;
    state?: string;
    district?: string;
    city?: string;
    noStore?: boolean;
  }
): Promise<PublicStory[]> {
  const base = (baseUrl || getApiBaseUrl()).replace(/\/+$/, '');
  const lang = options?.language ? String(options.language).toLowerCase().trim() : '';
  const state = options?.state ? String(options.state).toLowerCase().trim() : '';
  const district = options?.district ? String(options.district).trim() : '';
  const city = options?.city ? String(options.city).trim() : '';

  const params = new URLSearchParams();
  if (lang) {
    params.set('lang', lang);
    params.set('language', lang);
  }
  if (options?.category) params.set('category', String(options.category));
  if (state) params.set('state', state);
  if (state) params.set('stateSlug', state);

  // Backend compatibility: some deployments use `district`, others use `city`.
  // Send both when a location filter is provided.
  const loc = district || city;
  if (loc) {
    params.set('district', loc);
    params.set('districtSlug', loc);
    params.set('city', loc);
    params.set('citySlug', loc);
  }

  const query = params.toString();
  const url = `${base}/api/public/stories${query ? `?${query}` : ''}`;

  const res = await fetch(url, {
    method: 'GET',
    cache: options?.noStore ? 'no-store' : undefined,
    headers: options?.noStore ? { 'Cache-Control': 'no-store' } : undefined,
  });
  if (!res.ok) throw new Error(`Failed to fetch stories (${res.status})`);

  const json = await res.json().catch(() => null);
  return unwrapStories(json);
}

export async function fetchPublicStoryByIdOrSlug(
  idOrSlug: string,
  baseUrl?: string,
  options?: { language?: string }
): Promise<PublicStory | null> {
  const base = (baseUrl || getApiBaseUrl()).replace(/\/+$/, '');
  const lang = options?.language ? String(options.language).toLowerCase().trim() : '';
  const langQuery = lang ? `?lang=${encodeURIComponent(lang)}&language=${encodeURIComponent(lang)}` : '';

  // Preferred endpoint
  try {
    const res = await fetch(`${base}/api/public/stories/${encodeURIComponent(idOrSlug)}${langQuery}`);
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
    const stories = await fetchPublicStories(base, { language: lang });
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
  return resolveStoryDateIso(story);
}
