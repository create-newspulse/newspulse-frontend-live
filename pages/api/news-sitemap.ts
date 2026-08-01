import type { NextApiRequest, NextApiResponse } from 'next';

import { getPublicApiBaseUrl } from '../../lib/publicApiBase';
import { getLocalizedArticleFields, normalizeRouteLocale, STRICT_LOCALE_POLICY, type RouteLocale } from '../../lib/localizedArticleFields';
import { unwrapArticles } from '../../lib/publicNewsApi';
import { escapeXml, getArticleAlternates, isEligibleForNewsSitemap, resolvePublicSiteUrl, NEWS_PULSE_BRAND_NAME } from '../../lib/seo';

async function fetchRecentNewsArticles(): Promise<any[]> {
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
    return unwrapArticles(json).filter((article) => isEligibleForNewsSitemap(article));
  } catch {
    return [];
  }
}

function publicationDate(article: any): string {
  const raw = String(article?.publishedAt || article?.publishDate || '').trim();
  if (!raw) return '';
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).end('METHOD_NOT_ALLOWED');
  }

  const siteUrl = resolvePublicSiteUrl(req);
  const articles = await fetchRecentNewsArticles();
  const seen = new Set<string>();
  const items: string[] = [];

  for (const article of articles) {
    const publishedAt = publicationDate(article);
    if (!publishedAt) continue;

    for (const alternate of getArticleAlternates(article, siteUrl)) {
      if (alternate.hrefLang === 'x-default' || seen.has(alternate.href)) continue;
      const lang = normalizeRouteLocale(alternate.hrefLang) as RouteLocale;
      const localized = getLocalizedArticleFields(article, lang, STRICT_LOCALE_POLICY);
      if (!localized.isVisible || !localized.title) continue;
      seen.add(alternate.href);
      items.push(`  <url>\n    <loc>${escapeXml(alternate.href)}</loc>\n    <news:news>\n      <news:publication>\n        <news:name>${escapeXml(NEWS_PULSE_BRAND_NAME)}</news:name>\n        <news:language>${escapeXml(lang)}</news:language>\n      </news:publication>\n      <news:publication_date>${escapeXml(publishedAt)}</news:publication_date>\n      <news:title>${escapeXml(localized.title)}</news:title>\n    </news:news>\n  </url>`);
    }
  }

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9">\n${items.join('\n')}\n</urlset>\n`;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
  res.status(200).send(sitemap);
}