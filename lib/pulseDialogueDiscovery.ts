import type { Article } from './publicNewsApi';
import { getPublicApiBaseUrl } from './publicApiBase';
import { withPublicReadDeadline } from './publicReadDeadline';
import { normalizeRouteLocale, getLocalizedArticleFields, type RouteLocale } from './localizedArticleFields';
import { getPulseDialogueMetadata, getPulseDialogueFormatLabel, getPulseDialogueFormatLabelKey } from './pulseDialogue';
import { buildNewsUrl } from './newsRoutes';
import { resolveCoverImageUrl, resolveCoverFitMode } from './coverImages';
import { getStoryId } from './storyIdentity';
import { formatEditorialDateTime, resolveStoryDateIso } from './storyDateTime';
import type { CategoryStoryHierarchyItem } from '../components/category/CategoryStoryHierarchy';

export const PULSE_FORMAT_GROUPS = {
  columns: ['column', 'guest_column'],
  essays: ['essay', 'literary_essay'],
  culture: ['culture_ideas'],
  conversations: ['conversation', 'interview'],
} as const;
export const PULSE_FORMAT_OPTIONS = [
  ...Object.entries(PULSE_FORMAT_GROUPS).map(([group, formats]) => ({ value: formats.join(','), labelKey: `pulseDialogue.discovery.${group}`, grouped: true })),
  ...['viewpoint', 'expert_perspective', 'open_letter'].map((format) => ({ value: format, labelKey: getPulseDialogueFormatLabelKey(format), grouped: false })),
];
export const PULSE_FORMATS = PULSE_FORMAT_OPTIONS.flatMap((option) => option.value.split(','));
export type PulseCard = Article & Record<string, any>;
export type PulseContributor = { slug: string; name: string; publicDesignation: string | null; photoUrl: string | null; shortBio: string | null };
export type PulseSeries = { slug: string; title: string; description: string | null };
export type PulsePage<T> = { ok: true; items: T[]; lang?: RouteLocale; total: number; count: number; page: number; limit: number; totalPages: number; hasNextPage: boolean };
export type PulseDiscovery = { ok: true; lang: RouteLocale; featuredDialogue: PulseCard[]; featuredVoices: PulseContributor[]; formatGroups: Record<keyof typeof PULSE_FORMAT_GROUPS, PulseCard[]> };
export type PulseFilters = { q: string; contributor: string; series: string; format: string; sort: 'newest' | 'oldest' };
export const EMPTY_PULSE_FILTERS: PulseFilters = { q: '', contributor: '', series: '', format: '', sort: 'newest' };

export function pulseFilters(query: Record<string, unknown>): PulseFilters {
  const scalar = (key: string) => typeof query[key] === 'string' ? String(query[key]).trim() : '';
  const format = scalar('format').split(',').filter((value) => PULSE_FORMATS.includes(value));
  return { q: scalar('q').slice(0, 80), contributor: scalar('contributor').slice(0, 140), series: scalar('series').slice(0, 140),
    format: [...new Set(format)].join(','), sort: scalar('sort') === 'oldest' ? 'oldest' : 'newest' };
}

export function pulseArticleQuery(filters: PulseFilters, page = 1, limit = 12): Record<string, string> {
  return { page: String(Math.min(1000, Math.max(1, Math.floor(page) || 1))), limit: String(Math.min(24, Math.max(1, Math.floor(limit) || 12))),
    sort: filters.sort, ...(filters.q ? { q: filters.q.slice(0, 80) } : {}),
    ...(filters.contributor ? { contributor: filters.contributor } : {}), ...(filters.series ? { seriesSlug: filters.series } : {}),
    ...(filters.format ? { dialogueFormat: filters.format } : {}) };
}

export async function readPulse<T>(resource: string, locale: RouteLocale, query: Record<string, string> = {}, signal?: AbortSignal): Promise<T> {
  const base = getPublicApiBaseUrl();
  if (typeof window === 'undefined' && !base) throw new Error('Pulse Dialogue is unavailable');
  return withPublicReadDeadline(4000, async (deadlineSignal) => {
    const controller = new AbortController();
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    deadlineSignal.addEventListener('abort', abort, { once: true });
    if (signal?.aborted || deadlineSignal.aborted) abort();
    try {
      const params = new URLSearchParams({ ...query, lang: locale });
      const response = await fetch(`${base}/api/public/pulse-dialogue/${resource}?${params}`, {
        method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store', signal: controller.signal,
      });
      if (!response.ok) throw Object.assign(new Error('Pulse Dialogue is temporarily unavailable'), { status: response.status });
      const payload = await response.json();
      if (payload?.ok !== true || (payload.lang !== undefined && payload.lang !== locale)) throw new Error('Invalid Pulse Dialogue response');
      if (resource === 'discovery') {
        if (!Array.isArray(payload.featuredDialogue) || payload.featuredDialogue.length > 6 || !Array.isArray(payload.featuredVoices) || payload.featuredVoices.length > 6 ||
          Object.keys(PULSE_FORMAT_GROUPS).some((key) => !Array.isArray(payload.formatGroups?.[key]) || payload.formatGroups[key].length > 4)) throw new Error('Invalid discovery response');
      } else if (!Array.isArray(payload.items) || !Number.isInteger(payload.page) || payload.page !== Number(query.page || 1) ||
        !Number.isInteger(payload.totalPages) || payload.totalPages < 0 || typeof payload.hasNextPage !== 'boolean' || payload.items.length > Number(query.limit || 12)) {
        throw new Error('Invalid Pulse Dialogue page');
      }
      return payload as T;
    } finally {
      signal?.removeEventListener('abort', abort);
      deadlineSignal.removeEventListener('abort', abort);
    }
  });
}

export function pulseStoryKeys(article: PulseCard): string[] {
  const groups = [article.translationKey, article.translationGroupId].filter(Boolean).map((value) => `group:${value}`);
  const slugs = [article.slug, ...Object.values(article.slugs || {})].filter(Boolean).map((value) => `slug:${value}`);
  return [...groups, ...slugs, `id:${getStoryId(article)}`].filter((key) => !key.endsWith(':'));
}

export function uniquePulseStories(items: PulseCard[], excluded: PulseCard[] = []): PulseCard[] {
  const seen = new Set(excluded.flatMap(pulseStoryKeys));
  return items.filter((item) => {
    const keys = pulseStoryKeys(item);
    const duplicate = keys.some((key) => seen.has(key));
    keys.forEach((key) => seen.add(key));
    return keys.length > 0 && !duplicate;
  });
}

export function pulseCardView(article: PulseCard, locale: RouteLocale, translate?: (key: string) => string): CategoryStoryHierarchyItem {
  const lang = normalizeRouteLocale(article.resolvedLang || article.resolvedLanguage || article.language || locale);
  const localized = getLocalizedArticleFields(article, lang);
  const title = article.localizedTitle || localized.title || article.title || '';
  const id = getStoryId(article);
  const image = resolveCoverImageUrl(article);
  const metadata = getPulseDialogueMetadata(article);
  const dateIso = resolveStoryDateIso(article);
  return { id, title, titleText: title, href: buildNewsUrl({ id, slug: article.localizedSlug || localized.slug || article.slug, lang }),
    summary: localized.summary || article.summary || article.description || '', imageSrc: image,
    imageFitMode: resolveCoverFitMode(article, { src: image, altText: title }), dateIso, dateLabel: formatEditorialDateTime(dateIso),
    label: getPulseDialogueFormatLabel(metadata?.dialogueFormat, translate), authorName: metadata?.contributorName || '',
    authorDesignation: metadata?.contributorDesignation || '', contributorPhotoSrc: metadata?.contributorPhotoUrl || '',
    contributorPhotoAlt: metadata?.contributorPhotoAlt || '', meta: metadata?.series ? [metadata.series] : [] };
}

export function publicPulsePhoto(value: unknown): string {
  if (typeof value !== 'string') return '';
  try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : ''; } catch { return ''; }
}