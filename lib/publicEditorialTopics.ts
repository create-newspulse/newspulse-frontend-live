import type { RouteLocale } from './localizedArticleFields';
import { getOrdinaryCategoryPagination } from './ordinaryCategoryPagination';
import { getPublicApiBaseUrl } from './publicApiBase';
import { withPublicReadDeadline } from './publicReadDeadline';

export const EDITORIAL_TRENDING_LIMIT = 6;
export const EDITORIAL_TOPIC_PAGE_SIZE = 12;
export const EDITORIAL_TOPICS_TIMEOUT_MS = 4000;

export type EditorialTopicSummary = {
  id: string;
  key: string;
  slug: string;
  label: string;
  href: string;
  colorKey: string;
  name: Record<RouteLocale, string>;
  description: Record<RouteLocale, string>;
};

export type EditorialTopicStory = {
  _id: string;
  slug: string;
  title: string;
  summary: string;
  language: RouteLocale;
  resolvedLang: RouteLocale;
  category: string | null;
  imageUrl: string | null;
  publishedAt: string | null;
  translationKey: string | null;
  translationGroupId: string | null;
};

export type EditorialTopicDetail = {
  lang: RouteLocale;
  topic: EditorialTopicSummary;
  pinnedArticle: EditorialTopicStory | null;
};

export type EditorialTopicStoryPage = {
  lang: RouteLocale;
  items: EditorialTopicStory[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
};

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid editorial topics response');
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error('Invalid editorial topics text');
  return value;
}

function optionalText(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') throw new Error('Invalid editorial topics text');
  return value;
}

export function editorialTopicPath(slug: string, lang: RouteLocale, page = 1): string {
  return `${lang === 'en' ? '' : `/${lang}`}/topic/${encodeURIComponent(slug)}${page > 1 ? `?page=${page}` : ''}`;
}

function topicSummary(value: unknown): EditorialTopicSummary {
  const item = record(value);
  const slug = text(item.slug);
  if (slug.length > 140 || !/^[\p{L}\p{N}][\p{L}\p{N}\p{M}]*(?:-[\p{L}\p{N}][\p{L}\p{N}\p{M}]*)*$/u.test(slug)
    || item.key !== slug || (item.href !== `/topic/${slug}` && item.href !== editorialTopicPath(slug, 'en'))) {
    throw new Error('Invalid editorial topic identity');
  }
  const name = record(item.name);
  const description = item.description == null ? {} : record(item.description);
  return {
    id: text(item.id), key: slug, slug, label: text(item.label),
    href: editorialTopicPath(slug, 'en'), colorKey: text(item.colorKey),
    name: { en: text(name.en), hi: text(name.hi), gu: text(name.gu) },
    description: {
      en: optionalText(description.en) || '',
      hi: optionalText(description.hi) || '',
      gu: optionalText(description.gu) || '',
    },
  };
}

function topicStory(value: unknown, lang: RouteLocale): EditorialTopicStory {
  const item = record(value);
  // Backend resolves exact topic membership, publication eligibility and locale before pagination.
  if (item.resolvedLang !== lang || item.language !== lang || item.isFallback === true) {
    throw new Error('Editorial topic story returned an unexpected language');
  }
  return {
    _id: text(item._id), slug: text(item.slug), title: text(item.title),
    summary: optionalText(item.summary) || '', language: lang, resolvedLang: lang,
    category: optionalText(item.category),
    imageUrl: optionalText(item.imageUrl ?? item.coverImageUrl),
    publishedAt: optionalText(item.publishedAt),
    translationKey: optionalText(item.translationKey),
    translationGroupId: optionalText(item.translationGroupId),
  };
}

async function request(
  path: string,
  lang: RouteLocale,
  query: Record<string, string> = {},
  allowNotFound = false,
  parentSignal?: AbortSignal,
): Promise<Record<string, unknown> | null> {
  const base = getPublicApiBaseUrl().replace(/\/+$/, '');
  if (!base && typeof window === 'undefined') throw new Error('Public backend is not configured');
  const params = new URLSearchParams({ lang, ...query });
  return withPublicReadDeadline(EDITORIAL_TOPICS_TIMEOUT_MS, async (signal) => {
    const response = await fetch(`${base}/api/public/topics${path}?${params}`, {
      method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store', signal,
    });
    if (allowNotFound && response.status === 404) return null;
    if (!response.ok) throw new Error(`Editorial topics request failed (${response.status})`);
    const payload = record(await response.json());
    if (payload.ok !== true || payload.lang !== lang) throw new Error('Invalid editorial topics response');
    return payload;
  }, parentSignal);
}

export async function fetchEditorialTopics(lang: RouteLocale): Promise<EditorialTopicSummary[]> {
  const payload = await request('', lang, { limit: String(EDITORIAL_TRENDING_LIMIT) });
  if (!payload || !Array.isArray(payload.items) || payload.items.length > EDITORIAL_TRENDING_LIMIT) {
    throw new Error('Invalid editorial trending list');
  }
  return payload.items.map(topicSummary);
}

export async function fetchEditorialTopic(slug: string, lang: RouteLocale, signal?: AbortSignal): Promise<EditorialTopicDetail | null> {
  const payload = await request(`/${encodeURIComponent(slug)}`, lang, {}, true, signal);
  if (!payload) return null;
  const topic = topicSummary(payload.topic);
  if (topic.slug !== slug) throw new Error('Editorial topic returned an unexpected slug');
  if (!Object.prototype.hasOwnProperty.call(payload, 'pinnedArticle')) throw new Error('Missing editorial topic pin');
  return {
    lang, topic,
    pinnedArticle: payload.pinnedArticle == null ? null : topicStory(payload.pinnedArticle, lang),
  };
}

export async function fetchEditorialTopicStories(slug: string, lang: RouteLocale, page: number, signal?: AbortSignal): Promise<EditorialTopicStoryPage> {
  if (!Number.isSafeInteger(page) || page < 1 || page > 10000) throw new Error('Invalid editorial topic page');
  const payload = await request(`/${encodeURIComponent(slug)}/articles`, lang, {
    page: String(page), limit: String(EDITORIAL_TOPIC_PAGE_SIZE),
  }, false, signal);
  if (!payload || !Array.isArray(payload.items) || typeof payload.hasNextPage !== 'boolean'
    || payload.count !== payload.items.length) throw new Error('Invalid editorial topic story page');
  const pagination = getOrdinaryCategoryPagination({
    page: payload.page, limit: payload.limit, total: payload.total, totalPages: payload.totalPages,
    hasMore: payload.hasNextPage,
  }, { page, limit: EDITORIAL_TOPIC_PAGE_SIZE }, payload.items.length, true);
  if (pagination.total === undefined || pagination.totalPages === undefined) throw new Error('Missing editorial topic pagination');
  return {
    lang, items: payload.items.map((item) => topicStory(item, lang)),
    page: pagination.page, limit: pagination.limit, total: pagination.total,
    totalPages: pagination.totalPages, hasNextPage: pagination.hasMore,
  };
}
