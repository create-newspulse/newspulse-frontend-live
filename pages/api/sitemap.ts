import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../lib/publicApiBase';
import { unwrapArticles } from '../../lib/publicNewsApi';
import { absolutePublicUrl, escapeXml, getArticleAlternates, getSitemapLastModified, isIndexablePublishedArticle, resolvePublicSiteUrl } from '../../lib/seo';

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

async function fetchPublishedArticles(): Promise<any[]> {
  const base = String(getPublicApiBaseUrl() || '').trim().replace(/\/+$/, '');
  if (!base) return [];

  const params = new URLSearchParams({ limit: '500', strictLocale: '1' });
  try {
    const response = await fetch(`${base}/api/public/news?${params.toString()}`, {
      method: 'GET',
      headers: { Accept: 'application/json' },
    });
    const json = await response.json().catch(() => null);
    if (!response.ok) return [];
    return unwrapArticles(json).filter((article) => isIndexablePublishedArticle(article));
  } catch {
    return [];
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end('METHOD_NOT_ALLOWED');
  }

  const siteUrl = resolvePublicSiteUrl(req);
  const entries = new Map<string, string>();

  for (const path of STATIC_PUBLIC_PATHS) {
    const loc = absolutePublicUrl(path, siteUrl);
    if (loc) entries.set(loc, '');
  }

  const articles = await fetchPublishedArticles();
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

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  res.status(200).send(sitemap);
}
