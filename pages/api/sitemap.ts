import type { NextApiRequest, NextApiResponse } from 'next';

import { absolutePublicUrl, escapeXml, resolvePublicSiteUrl } from '../../lib/seo';
import { fetchSitemapStories, setSitemapCache, sitemapUnavailable, SITEMAP_LOCALES, type SitemapEdition } from '../../lib/sitemap.server';

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
  '/tech-gadgets',
  '/sports',
  '/lifestyle',
  '/glamour',
  '/web-stories',
  '/viral-videos',
  '/editorial',
  '/faith-culture',
  '/pulse-dialogue',
  '/sponsored-content',
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
};

const sitemapCache = new Map<string, SitemapCacheEntry>();
const refreshing = new Map<string, Promise<SitemapCacheEntry | null>>();

function usable(entry: SitemapCacheEntry, nowMs: number): boolean {
  return nowMs - entry.generatedAt < (SITEMAP_FRESH_SECONDS + SITEMAP_STALE_SECONDS) * 1000;
}

function buildSitemapXml(stories: SitemapEdition[][], siteUrl: string): string {
  const entries = new Map<string, string>();
  function addGroup(editions: Pick<SitemapEdition, 'locale' | 'href' | 'lastmod'>[]) {
    const defaultEdition = editions.find(item => item.locale === 'en') || editions[0];
    const links = [...editions, { locale: 'x-default', href: defaultEdition.href }]
      .map(({ locale, href }) => `    <xhtml:link rel="alternate" hreflang="${locale}" href="${escapeXml(href)}" />`).join('\n');
    for (const { href, lastmod } of editions) {
      entries.set(href, `  <url>\n    <loc>${escapeXml(href)}</loc>${lastmod ? `\n    <lastmod>${escapeXml(lastmod)}</lastmod>` : ''}\n${links}\n  </url>`);
    }
  }
  for (const path of STATIC_PUBLIC_PATHS) {
    addGroup(SITEMAP_LOCALES.map(locale => ({
      locale, lastmod: '', href: absolutePublicUrl(locale === 'en' ? path : `/${locale}${path === '/' ? '' : path}`, siteUrl),
    })));
  }
  stories.forEach(addGroup);
  const urls = Array.from(entries.keys()).sort().map(loc => entries.get(loc)).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls}\n</urlset>\n`;
}

async function getSitemapXml(siteUrl: string): Promise<SitemapCacheEntry | null> {
  const nowMs = Date.now();
  const cached = sitemapCache.get(siteUrl);
  if (cached && usable(cached, nowMs) && (nowMs - cached.generatedAt < SITEMAP_FRESH_SECONDS * 1000 || nowMs < cached.nextRetryAt)) {
    return cached;
  }
  const pending = refreshing.get(siteUrl);
  if (pending) return pending;
  const refresh = (async () => {
    const stories = await fetchSitemapStories(siteUrl, 25000);
    if (stories === null) {
      if (!cached || !usable(cached, Date.now())) return null;
      cached.nextRetryAt = Date.now() + SITEMAP_RETRY_AFTER_ERROR_SECONDS * 1000;
      return cached;
    }
    const entry = { xml: buildSitemapXml(stories, siteUrl), generatedAt: Date.now(), nextRetryAt: 0 };
    sitemapCache.set(siteUrl, entry);
    return entry;
  })().finally(() => refreshing.delete(siteUrl));
  refreshing.set(siteUrl, refresh);
  return refresh;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end('METHOD_NOT_ALLOWED');
  }

  const siteUrl = resolvePublicSiteUrl(req);
  const sitemap = await getSitemapXml(siteUrl);
  if (!sitemap) return sitemapUnavailable(res);
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  const remaining = SITEMAP_FRESH_SECONDS - Math.floor((Date.now() - sitemap.generatedAt) / 1000);
  setSitemapCache(res, remaining > 0 ? `public, s-maxage=${remaining}, stale-while-revalidate=${SITEMAP_STALE_SECONDS}` : 'no-store');
  res.status(200).send(sitemap.xml);
}
