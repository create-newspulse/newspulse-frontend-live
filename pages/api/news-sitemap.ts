import type { NextApiRequest, NextApiResponse } from 'next';

import { escapeXml, resolvePublicSiteUrl, NEWS_PULSE_BRAND_NAME } from '../../lib/seo';
import { fetchSitemapStories, setSitemapCache, sitemapUnavailable } from '../../lib/sitemap.server';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end('METHOD_NOT_ALLOWED');
  }

  const siteUrl = resolvePublicSiteUrl(req);
  const stories = await fetchSitemapStories(siteUrl, 8000);
  if (!stories) return sitemapUnavailable(res);
  const items: string[] = [];
  for (const editions of stories) {
    for (const { href, locale, news } of editions) {
      if (!news) continue;
      const title = news.title.replace(/[^\t\n\r\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/gu, '');
      items.push(`  <url>\n    <loc>${escapeXml(href)}</loc>\n    <news:news>\n      <news:publication>\n        <news:name>${escapeXml(NEWS_PULSE_BRAND_NAME)}</news:name>\n        <news:language>${locale}</news:language>\n      </news:publication>\n      <news:publication_date>${escapeXml(news.publishedAt)}</news:publication_date>\n      <news:title>${escapeXml(title)}</news:title>\n    </news:news>\n  </url>`);
    }
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${items.join('\n')}\n</urlset>\n`;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  setSitemapCache(res, 'public, s-maxage=300, stale-while-revalidate=600');
  res.status(200).send(sitemap);
}