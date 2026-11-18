import type { NextApiRequest, NextApiResponse } from 'next';

import { fetchSitemapArticles } from '../../lib/articleSeo.server';
import { absolutePublicUrl, escapeXml, getArticleAlternates, getSitemapLastModified, resolvePublicSiteUrl } from '../../lib/seo';

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

  const { articles, complete } = await fetchSitemapArticles();
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
