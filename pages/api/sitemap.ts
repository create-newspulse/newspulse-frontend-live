import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../lib/publicApiBase';
import { unwrapArticles } from '../../lib/publicNewsApi';
import { absolutePublicUrl, escapeXml, getArticleAlternates, getSitemapLastModified, isIndexablePublishedArticle, resolvePublicSiteUrl } from '../../lib/seo';

const SITEMAP_UPSTREAM_TIMEOUT_MS = 8_000;
const SITEMAP_FRESH_SECONDS = 300;
const SITEMAP_STALE_SECONDS = 600;
const SITEMAP_RETRY_AFTER_ERROR_SECONDS = 60;

const STATIC_PUBLIC_PATHS = [
  '/',
  '/breaking',
  '/national',
  '/international',
  '/business',
  '/science-technology',
  '/sports',
  '/lifestyle',
  '/glamour',
  '/web-stories',
  '/viral-videos',
  '/editorial',
  '/youth-pulse',
  '/inspiration-hub',
  '/community-reporter',
  '/community-reporter/guidelines',
  '/regional/gujarat',
  '/about-us',
  '/contact',
  '/privacy-policy',
  '/cookie-policy',
  '/terms-of-service',
  '/advertise-with-us',
  '/digital-code-of-ethics',
  '/grievance-redressal',
];

type SitemapCacheEntry = {
  xml: string;
  generatedAt: number;
  nextRetryAt: number;
  complete: boolean;
};

const sitemapCache = new Map<string, SitemapCacheEntry>();

function getNowMs(): number {
  return Date.now();
}

function isFresh(entry: SitemapCacheEntry, nowMs: number): boolean {
  return nowMs - entry.generatedAt < SITEMAP_FRESH_SECONDS * 1000;
}

function isStaleButUsable(entry: SitemapCacheEntry, nowMs: number): boolean {
  return nowMs - entry.generatedAt < (SITEMAP_FRESH_SECONDS + SITEMAP_STALE_SECONDS) * 1000;
}

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const timeout = (globalThis as any)?.AbortSignal?.timeout;
  if (typeof timeout === 'function') {
    return fetch(url, { ...init, signal: timeout(SITEMAP_UPSTREAM_TIMEOUT_MS) });
  }

  if (typeof AbortController === 'undefined') return fetch(url, init);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SITEMAP_UPSTREAM_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchPublishedArticles(): Promise<{ articles: any[]; complete: boolean }> {
  const base = String(getPublicApiBaseUrl() || '').trim().replace(/\/+$/, '');
  if (!base) return { articles: [], complete: false };

  const params = new URLSearchParams({ limit: '500', strictLocale: '1' });
  try {
    const response = await fetchWithTimeout(`${base}/api/public/news?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const json = await response.json().catch(() => null);
    if (!response.ok) return { articles: [], complete: false };
    return {
      articles: unwrapArticles(json).filter((article) => isIndexablePublishedArticle(article)),
      complete: true,
    };
  } catch {
    return { articles: [], complete: false };
  }
}

function buildSitemapXml(articles: any[], siteUrl: string): string {
  const entries = new Map<string, string>();

  for (const path of STATIC_PUBLIC_PATHS) {
    const loc = absolutePublicUrl(path, siteUrl);
    if (loc) entries.set(loc, '');
  }

  for (const article of articles) {
    const lastmod = getSitemapLastModified(article);
    for (const alternate of getArticleAlternates(article, siteUrl)) {
      if (alternate.hrefLang === 'x-default') continue;
      if (!entries.has(alternate.href)) entries.set(alternate.href, lastmod);
    }
  }

  const urls = Array.from(entries.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([loc, lastmod]) => `  <url>\n    <loc>${escapeXml(loc)}</loc>${lastmod ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>` : ''}\n  </url>`)
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

async function getSitemapXml(siteUrl: string): Promise<SitemapCacheEntry> {
  const nowMs = getNowMs();
  const cached = sitemapCache.get(siteUrl);
  if (cached && isFresh(cached, nowMs)) return cached;
  if (cached && cached.nextRetryAt > nowMs && isStaleButUsable(cached, nowMs)) return cached;

  const { articles, complete } = await fetchPublishedArticles();
  if (!complete && cached && isStaleButUsable(cached, nowMs)) {
    cached.nextRetryAt = nowMs + SITEMAP_RETRY_AFTER_ERROR_SECONDS * 1000;
    return cached;
  }

  const entry: SitemapCacheEntry = {
    xml: buildSitemapXml(articles, siteUrl),
    generatedAt: nowMs,
    nextRetryAt: complete ? 0 : nowMs + SITEMAP_RETRY_AFTER_ERROR_SECONDS * 1000,
    complete,
  };
  sitemapCache.set(siteUrl, entry);
  return entry;
}

function setSitemapCacheHeaders(res: NextApiResponse, complete: boolean) {
  const maxAge = complete ? SITEMAP_FRESH_SECONDS : SITEMAP_RETRY_AFTER_ERROR_SECONDS;
  const stale = complete ? SITEMAP_STALE_SECONDS : SITEMAP_RETRY_AFTER_ERROR_SECONDS;
  const value = `public, s-maxage=${maxAge}, stale-while-revalidate=${stale}`;
  res.setHeader('Cache-Control', value);
  res.setHeader('CDN-Cache-Control', value);
  res.setHeader('Vercel-CDN-Cache-Control', value);
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end('METHOD_NOT_ALLOWED');
  }

  const siteUrl = resolvePublicSiteUrl(req);
  const sitemap = await getSitemapXml(siteUrl);
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  setSitemapCacheHeaders(res, sitemap.complete);
  res.status(200).send(sitemap.xml);
}
