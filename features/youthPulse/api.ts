import { youthCategories, youthStories } from "../../utils/youthData";
import type { YouthCategory, YouthStory } from "./types";
import { getApiOrigin } from '../../lib/publicNewsApi';

type FetchOpts = {
  signal?: AbortSignal;
};

function normalizeText(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[_/]+/g, ' ')
    .replace(/[^a-z0-9\s-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function humanizeSlug(value: string): string {
  const s = String(value || '').replace(/[-_]+/g, ' ').trim();
  if (!s) return '';
  return s.replace(/\b\w/g, (m) => m.toUpperCase());
}

function toCategorySlug(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[_\s/]+/g, '-')
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .trim();
}

function asStringList(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => (typeof v === 'string' ? v : '')).filter(Boolean);
  if (typeof value === 'string') return [value];
  return [];
}

function extractTags(raw: any): string[] {
  const tags = [
    ...asStringList(raw?.tags),
    ...asStringList(raw?.tag),
    ...asStringList(raw?.keywords),
    ...asStringList(raw?.categories),
  ];
  return tags.map(normalizeText).filter(Boolean);
}

function formatDateLabel(iso?: string): string {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return '';
  try {
    return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(d);
  } catch {
    return d.toISOString();
  }
}

function extractYears(value: unknown): number[] {
  const matches = String(value || '').match(/\b(19|20)\d{2}\b/g) || [];
  return matches
    .map((item) => Number(item))
    .filter((item) => Number.isFinite(item));
}

function isFreshFallbackStory(story: YouthStory, now: Date = new Date()): boolean {
  const currentYear = now.getFullYear();
  const years = [...extractYears(story.title), ...extractYears(story.summary), ...extractYears(story.date)];
  if (!years.length) return true;
  return years.every((year) => year >= currentYear);
}

function getFallbackYouthStories(category?: string): YouthStory[] {
  const normalizedCategory = toCategorySlug(category);
  return youthStories.filter((story) => {
    const storyCategory = toCategorySlug(story.category);
    if (!isFreshFallbackStory(story)) return false;
    if (!normalizedCategory) return storyCategory !== 'inspiration-hub';
    return storyCategory === normalizedCategory;
  });
}

async function fetchYouthPulseArticles(limit: number, language?: string, opts: FetchOpts = {}): Promise<any[]> {
  const isBrowser = typeof window !== 'undefined';
  const base = getApiOrigin();
  if (!isBrowser && !base) return [];
  const params = new URLSearchParams({ category: 'youth-pulse', limit: String(limit) });
  if (language) {
    params.set('lang', String(language));
    params.set('language', String(language));
  }
  const url = `${base}/api/public/news?${params.toString()}`;

  try {
    const res = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, signal: opts.signal });
    if (!res.ok) return [];

    const data = await res.json().catch(() => null);
    const list: unknown =
      (data && (data.items || data.articles || data.news || data.data)) ?? (Array.isArray(data) ? data : []);
    return Array.isArray(list) ? (list as any[]) : [];
  } catch (e: any) {
    if (e && e.name === 'AbortError') throw e;
    return [];
  }
}

function toYouthStory(raw: any, fallbackCategoryLabel?: string): YouthStory {
  const id = raw?._id || raw?.id || raw?.slug || `${Date.now()}-${Math.random()}`;
  const title = String(raw?.title || 'Untitled').trim();
  const summary = String(raw?.summary || raw?.excerpt || '').trim();
  const image = String(raw?.imageUrl || raw?.image || '/images/placeholder-16x9.svg');

  const when = String(raw?.publishedAt || raw?.createdAt || '').trim();
  const date = formatDateLabel(when) || '';

  const backendCategory = String(raw?.category || '').trim();
  const category = toCategorySlug(backendCategory || fallbackCategoryLabel || 'youth-pulse') || 'youth-pulse';
  const categoryLabel = fallbackCategoryLabel || (backendCategory ? humanizeSlug(backendCategory) : 'Youth Pulse');

  return { id, title, summary, category, categoryLabel, image, date };
}

export async function getYouthTopics(): Promise<YouthCategory[]> {
  // Static source used in existing pages
  return youthCategories.map((c) => ({
    slug: c.slug,
    title: c.title,
    emoji: c.emoji,
    description: c.description,
    gradientFrom: c.gradientFrom,
    gradientTo: c.gradientTo,
    fromHex: c.fromHex,
    toHex: c.toHex,
  }));
}

export async function getYouthTrending(limit = 12): Promise<YouthStory[]> {
  // Public backend (category=youth-pulse)
  const items = await fetchYouthPulseArticles(limit);
  if (items.length) return items.map((raw) => toYouthStory(raw));

  // Fallback: only use evergreen local stories and reject year-stamped stale mock items.
  const list = getFallbackYouthStories();
  return list.slice(0, limit);
}

export async function getYouthTrendingByLanguage(
  limit = 12,
  language?: string,
  opts: FetchOpts = {}
): Promise<YouthStory[]> {
  const items = await fetchYouthPulseArticles(limit, language, opts);
  if (items.length) return items.map((raw) => toYouthStory(raw));

  const list = getFallbackYouthStories();
  return list.slice(0, limit);
}

export async function getYouthByCategory(slug: string, language?: string, opts: FetchOpts = {}): Promise<YouthStory[]> {
  // Best-effort client-side filtering on fetched youth-pulse feed.
  const display = humanizeSlug(slug);
  const needles = [normalizeText(slug), normalizeText(display)].filter(Boolean);

  // If asking for the main category, just return the latest youth-pulse feed.
  if (normalizeText(slug) === 'youth pulse' || normalizeText(slug) === 'youth-pulse') {
    const items = await fetchYouthPulseArticles(30, language, opts);
    if (items.length) return items.map((raw) => toYouthStory(raw, 'Youth Pulse'));
    return getFallbackYouthStories();
  }

  const items = await fetchYouthPulseArticles(30, language, opts);
  const filtered = items.filter((raw) => {
    const tags = extractTags(raw);
    const cat = normalizeText(toCategorySlug(raw?.category));
    const text = normalizeText(`${raw?.title || ''} ${raw?.summary || ''} ${raw?.excerpt || ''}`);
    return needles.some((n) => (n && (tags.includes(n) || cat.includes(n) || text.includes(n))));
  });

  if (filtered.length) return filtered.map((raw) => toYouthStory(raw, display || 'Youth Pulse'));

  return getFallbackYouthStories(slug);
}
