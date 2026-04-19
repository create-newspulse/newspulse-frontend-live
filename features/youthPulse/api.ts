import { youthCategories, youthStories } from "../../utils/youthData";
import type { YouthCategory, YouthStory } from "./types";
import { getApiOrigin } from '../../lib/publicNewsApi';

type FetchOpts = {
  signal?: AbortSignal;
};

const YOUTH_TRACKS = [
  { slug: 'youth-pulse', label: 'Youth Pulse' },
  { slug: 'campus-buzz', label: 'Campus Buzz' },
  { slug: 'govt-exam-updates', label: 'Govt Exam Updates' },
  { slug: 'career-boosters', label: 'Career Boosters' },
  { slug: 'young-achievers', label: 'Young Achievers' },
  { slug: 'student-voices', label: 'Student Voices' },
] as const;

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

function normalizeDashText(value: unknown): string {
  return normalizeText(value).replace(/\s+/g, '-');
}

function resolveYouthTrack(value: unknown): { slug: string; label: string } | null {
  const normalized = normalizeDashText(value);
  if (!normalized) return null;

  for (const track of YOUTH_TRACKS) {
    const label = normalizeDashText(track.label);
    if (normalized === track.slug || normalized === label) return { slug: track.slug, label: track.label };
    if (normalized.includes(track.slug) || normalized.includes(label)) return { slug: track.slug, label: track.label };
  }

  return null;
}

function resolveYouthTrackFromRaw(raw: any, fallbackCategoryLabel?: string): { slug: string; label: string } {
  const candidates = [
    raw?.trackLabel,
    raw?.track,
    raw?.subcategory,
    raw?.topic,
    raw?.section,
    raw?.category,
    raw?.categoryLabel,
    ...asStringList(raw?.tags),
    ...asStringList(raw?.categories),
  ];

  for (const candidate of candidates) {
    const resolved = resolveYouthTrack(candidate);
    if (resolved) return resolved;
  }

  const fallback = resolveYouthTrack(fallbackCategoryLabel);
  return fallback || { slug: 'youth-pulse', label: fallbackCategoryLabel || 'Youth Pulse' };
}

function resolveYouthEditorialLabel(raw: any, trackLabel: string): string {
  const candidates = [
    raw?.editorialLabel,
    raw?.label,
    raw?.deskLabel,
    raw?.badge,
    raw?.cardLabel,
    raw?.trackLabel,
    raw?.track,
    raw?.category,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeDashText(candidate);
    if (!normalized) continue;
    if (normalized.includes('student-voice') || normalized.includes('student-voices')) return 'Student Voice';
    if (normalized.includes('campus-buzz') || normalized.includes('campus-report')) return 'Campus Report';
    if (normalized.includes('young-achievers') || normalized.includes('young-achiever')) return 'Young Achiever';
    if (normalized.includes('govt-exam-updates') || normalized.includes('exam-update')) return 'Exam Update';
    if (normalized.includes('youth-pulse-desk') || normalized.includes('youth-pulse')) return 'Youth Pulse Desk';
  }

  const fallback = normalizeDashText(trackLabel);
  if (fallback.includes('student-voices')) return 'Student Voice';
  if (fallback.includes('campus-buzz')) return 'Campus Report';
  if (fallback.includes('young-achievers')) return 'Young Achiever';
  if (fallback.includes('govt-exam-updates')) return 'Exam Update';
  return 'Youth Pulse Desk';
}

function isExplicitlyNotPublic(raw: any): boolean {
  const flags = [raw?.isPublished, raw?.published, raw?.isPublic, raw?.visible];
  if (flags.some((flag) => flag === false)) return true;

  const statusValues = [
    raw?.status,
    raw?.approvalStatus,
    raw?.publicationStatus,
    raw?.workflowStatus,
    raw?.moderationStatus,
    raw?.state,
  ]
    .map((value) => normalizeDashText(value))
    .filter(Boolean);

  return statusValues.some((value) => (
    value === 'draft'
    || value === 'pending'
    || value === 'submitted'
    || value === 'rejected'
    || value === 'archived'
    || value.includes('under-review')
    || value.includes('in-review')
    || value.includes('awaiting-review')
  ));
}

function sanitizePublicYouthItems(items: any[]): any[] {
  return items.filter((raw) => !isExplicitlyNotPublic(raw));
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
  const image = String(raw?.imageUrl || raw?.image || raw?.coverImageUrl || raw?.coverImage?.url || '/images/placeholder-16x9.svg');

  const when = String(raw?.publishedAt || raw?.createdAt || '').trim();
  const date = formatDateLabel(when) || '';
  const track = resolveYouthTrackFromRaw(raw, fallbackCategoryLabel);
  const category = track.slug || 'youth-pulse';
  const categoryLabel = track.label || 'Youth Pulse';
  const editorialLabel = resolveYouthEditorialLabel(raw, categoryLabel);
  const slug = String(raw?.slug || raw?._id || raw?.id || '').trim() || undefined;

  return { id, title, summary, category, categoryLabel, editorialLabel, slug, image, date };
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
  const items = sanitizePublicYouthItems(await fetchYouthPulseArticles(limit));
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
  const items = sanitizePublicYouthItems(await fetchYouthPulseArticles(limit, language, opts));
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
    const items = sanitizePublicYouthItems(await fetchYouthPulseArticles(30, language, opts));
    if (items.length) return items.map((raw) => toYouthStory(raw, 'Youth Pulse'));
    return getFallbackYouthStories();
  }

  const items = sanitizePublicYouthItems(await fetchYouthPulseArticles(30, language, opts));
  const filtered = items.filter((raw) => {
    const tags = extractTags(raw);
    const track = resolveYouthTrackFromRaw(raw);
    const cat = normalizeText(track.slug || toCategorySlug(raw?.category));
    const text = normalizeText(`${raw?.title || ''} ${raw?.summary || ''} ${raw?.excerpt || ''}`);
    return needles.some((n) => (n && (tags.includes(n) || cat.includes(n) || text.includes(n))));
  });

  if (filtered.length) return filtered.map((raw) => toYouthStory(raw, display || 'Youth Pulse'));

  return getFallbackYouthStories(slug);
}
