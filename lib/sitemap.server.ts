import type { NextApiResponse } from 'next';

import { getArticleEditionLocale } from './articleSlugs';
import { getLocalizedArticleFields, STRICT_LOCALE_POLICY, type RouteLocale } from './localizedArticleFields';
import { getOrdinaryCategoryPagination } from './ordinaryCategoryPagination';
import { getPublicApiBaseUrl } from './publicApiBase';
import { parsePublicNewsList, type Article } from './publicNewsApi';
import { PublicReadTimeoutError, withPublicReadDeadline } from './publicReadDeadline';
import { getSafeRetryAfter } from './retryAfter';
import { getArticleCanonicalUrl, getSitemapLastModified, isEligibleForNewsSitemap, isIndexablePublishedArticle } from './seo';

export const SITEMAP_LOCALES = ['en', 'hi', 'gu'] as const;
// Page one of this unfiltered feed is the backend's prewarmed, locale-specific latest key.
const PAGE_SIZE = 40;
const READ_TIMEOUT_MS = 8000;

export type SitemapEdition = {
  locale: RouteLocale;
  href: string;
  lastmod: string;
  news: { publishedAt: string; title: string } | null;
};

type Candidate = SitemapEdition & { id: string; group?: string; translationKey?: string; native: boolean };

class SitemapReadError extends Error {
  constructor(reason: string, readonly status?: number) {
    super(reason);
  }
}

function edition(article: Article, locale: RouteLocale, siteUrl: string): Candidate | null {
  if (!isIndexablePublishedArticle(article)) return null;
  const fields = getLocalizedArticleFields(article, locale, STRICT_LOCALE_POLICY);
  const resolved = article.resolvedLanguage || article.resolvedLang || getArticleEditionLocale(article);
  if (article.isFallback || resolved !== locale || !fields.isVisible) throw new SitemapReadError('wrong-edition');
  const href = getArticleCanonicalUrl(article, locale, siteUrl);
  if (!href || !fields.title) throw new SitemapReadError('invalid-edition');
  const date = article.publishedAt || ('publishDate' in article && typeof article.publishDate === 'string' && article.publishDate);
  return {
    locale, href, lastmod: getSitemapLastModified(article),
    id: article._id, group: article.translationGroupId, translationKey: article.translationKey,
    native: !article.isTranslated && (!article.originalLang || article.originalLang === locale),
    news: date && isEligibleForNewsSitemap(article) ? { publishedAt: new Date(date).toISOString(), title: fields.title } : null,
  };
}

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Defense in depth: public DTO projection intentionally drops internal workflow flags.
function withheld(raw: unknown): boolean {
  if (!record(raw)) throw new SitemapReadError('invalid-feed');
  const workflow = record(raw.workflow) ? raw.workflow : {};
  return (raw.status != null && String(raw.status).trim().toLowerCase() !== 'published')
    || (raw.visibility != null && String(raw.visibility).trim().toLowerCase() !== 'public')
    || raw.private === true || raw.isPublic === false || raw.locked === true || workflow.locked === true
    || [raw.embargoUntil, workflow.embargoUntil, raw.scheduledAt, raw.publishAt].some(date => {
      if (date == null || date === '') return false;
      if (typeof date !== 'string' || !Number.isFinite(Date.parse(date))) throw new SitemapReadError('invalid-publication-date');
      return Date.parse(date) > Date.now();
    });
}

async function readPage(url: string, page: number, deadline: number) {
  const remaining = Math.min(READ_TIMEOUT_MS, deadline - Date.now());
  if (remaining <= 0) throw new PublicReadTimeoutError();
  const expires = Date.now() + remaining;
  return withPublicReadDeadline(remaining, async signal => {
    for (let attempt = 0; ; attempt++) {
      signal.throwIfAborted();
      const response = await fetch(url, { method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store', signal });
      if (response.status !== 200) {
        void response.body?.cancel().catch(() => {});
        const wait = Number(getSafeRetryAfter(response.headers.get('Retry-After'))) * 1000;
        if (attempt === 0 && (response.status === 503 || response.status === 429)
          && wait <= 2000 && Date.now() + wait < expires) {
          await new Promise(resolve => setTimeout(resolve, wait));
          continue;
        }
        throw new SitemapReadError('upstream-http', response.status);
      }
      const raw: unknown = await response.json();
      signal.throwIfAborted();
      if (!record(raw) || !Array.isArray(raw.items) || raw.complete === false || raw.partial === true) throw new SitemapReadError('invalid-feed');
      const read = parsePublicNewsList(raw);
      if (!read) throw new SitemapReadError('invalid-feed');
      // The direct News endpoint returns all four fields; hasMore is optional.
      if ([raw.page, raw.limit, raw.total, raw.totalPages].some(v => v == null)) throw new SitemapReadError('missing-pagination');
      let pagination: ReturnType<typeof getOrdinaryCategoryPagination>;
      try {
        pagination = getOrdinaryCategoryPagination(raw, { page, limit: PAGE_SIZE }, read.items.length);
      } catch {
        throw new SitemapReadError('invalid-pagination');
      }
      const { total, totalPages, hasMore } = pagination;
      if (total === undefined || total !== Number(raw.total) || totalPages !== Number(raw.totalPages)
        || Number(raw.page) !== page || Number(raw.limit) !== PAGE_SIZE || (raw.hasMore != null && raw.hasMore !== hasMore)) {
        throw new SitemapReadError('invalid-pagination');
      }
      return { items: read.items, withheld: raw.items.map(withheld), total, hasMore };
    }
  });
}

async function readLocale(base: string, locale: RouteLocale, siteUrl: string, deadline: number): Promise<Candidate[] | null> {
  const result: Candidate[] = [];
  const seen = new Set<string>();
  let total: number | undefined;
  let page = 1;
  try {
    for (;; page++) {
      const query = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), strictLocale: '1', lang: locale, language: locale });
      const read = await readPage(`${base}/api/public/news?${query}`, page, deadline);
      if ((total !== undefined && total !== read.total) || read.items.length !== Math.min(PAGE_SIZE, read.total - seen.size)) {
        throw new SitemapReadError('incomplete-page');
      }
      total = read.total;
      for (const [index, article] of read.items.entries()) {
        if (seen.has(article._id)) throw new SitemapReadError('repeated-record');
        seen.add(article._id);
        if (read.withheld[index]) continue;
        const item = edition(article, locale, siteUrl);
        if (item) result.push(item);
      }
      if (Date.now() >= deadline) throw new PublicReadTimeoutError();
      if (!read.hasMore) return result;
    }
  } catch (error) {
    const reason = error instanceof SitemapReadError ? error.message : error instanceof PublicReadTimeoutError ? 'timeout'
      : error instanceof SyntaxError ? 'invalid-json' : 'read-failed';
    console.error('[seo] Sitemap locale unavailable', {
      locale, page, reason, ...(error instanceof SitemapReadError && error.status ? { status: error.status } : {}),
    });
    return null;
  }
}

function groupEditions(candidates: Candidate[]): SitemapEdition[][] {
  const groupByKey = new Map<string, string>();
  const translationKeys = new Map<string, string>();
  function associate(map: Map<string, string>, key: string, value: string) {
    if (map.has(key) && map.get(key) !== value) throw new SitemapReadError('conflicting-story-identity');
    map.set(key, value);
  }
  for (const { group, translationKey } of candidates) {
    if (group && translationKey) {
      associate(groupByKey, translationKey, group);
      associate(translationKeys, group, translationKey);
    }
  }
  const groupById = new Map<string, string>();
  for (const { id, group, translationKey } of candidates) {
    const key = group || (translationKey && (groupByKey.get(translationKey) || translationKey));
    if (key) associate(groupById, id, key);
  }
  const groups = new Map<string, Map<RouteLocale, Candidate>>();
  // ID detail resolves a native sibling ahead of a cached translation of the same story.
  for (const item of candidates.sort((a, b) => Number(b.native) - Number(a.native))) {
    const key = groupById.has(item.id) ? `group:${groupById.get(item.id)}` : `id:${item.id}`;
    const editions = groups.get(key) || new Map<RouteLocale, Candidate>();
    groups.set(key, editions);
    const previous = editions.get(item.locale);
    if (!previous) editions.set(item.locale, item);
    else if (previous.native === item.native) {
      if (previous.href !== item.href) throw new SitemapReadError('ambiguous-canonical');
      if (item.lastmod > previous.lastmod) editions.set(item.locale, item);
    }
  }
  const urls = new Set<string>();
  return Array.from(groups.values(), editions => SITEMAP_LOCALES.flatMap(locale => {
    const item = editions.get(locale);
    if (!item) return [];
    if (urls.has(item.href)) throw new SitemapReadError('ambiguous-canonical');
    urls.add(item.href);
    return [item];
  }));
}

/** Null means incomplete, never an authoritative empty inventory. */
export async function fetchSitemapStories(siteUrl: string, budgetMs: number): Promise<SitemapEdition[][] | null> {
  const base = getPublicApiBaseUrl().replace(/\/+$/, '');
  if (!base) {
    console.error('[seo] Sitemap unavailable', { reason: 'backend-not-configured' });
    return null;
  }
  const deadline = Date.now() + budgetMs;
  const rows: Candidate[] = [];
  // Public News admits at most two concurrent cold rebuilds. Don't race all three.
  for (let i = 0; i < SITEMAP_LOCALES.length; i += 2) {
    const results = await Promise.all(SITEMAP_LOCALES.slice(i, i + 2).map(locale => readLocale(base, locale, siteUrl, deadline)));
    for (const items of results) {
      if (!items) return null;
      for (const item of items) rows.push(item);
    }
  }
  try {
    return groupEditions(rows);
  } catch (error) {
    if (!(error instanceof SitemapReadError)) throw error;
    console.error('[seo] Sitemap unavailable', { reason: error.message });
    return null;
  }
}

export function setSitemapCache(res: NextApiResponse, value: string) {
  for (const name of ['Cache-Control', 'CDN-Cache-Control', 'Vercel-CDN-Cache-Control']) res.setHeader(name, value);
}

export function sitemapUnavailable(res: NextApiResponse) {
  setSitemapCache(res, 'no-store');
  res.setHeader('Retry-After', '60');
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  return res.status(503).end('SITEMAP_TEMPORARILY_UNAVAILABLE');
}
