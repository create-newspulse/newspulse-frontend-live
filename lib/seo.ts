import type { IncomingMessage } from 'http';

import { resolveCoverImageUrl } from './coverImages';
import {
  getArticleAuthorName,
  getLocalizedSeoValue,
  getStoredSeoValue,
} from './editorialDisplay';
import {
  getLocalizedArticleFields,
  getPublicArticleStatus,
  normalizeRouteLocale,
  STRICT_LOCALE_POLICY,
  type RouteLocale,
} from './localizedArticleFields';
import { buildNewsUrl } from './newsRoutes';

export const NEWS_PULSE_SITE_URL = 'https://www.newspulse.co.in';
export const NEWS_PULSE_BRAND_NAME = 'News Pulse';
export const NEWS_PULSE_PUBLISHER_NAME = 'News Pulse Media';
export const NEWS_PULSE_LOGO_PATH = '/icons/icon-512x512.png';
export const NEWS_SITEMAP_WINDOW_DAYS = 2;

export type SeoAlternate = {
  hrefLang: RouteLocale | 'x-default';
  href: string;
};

export type ArticleSeoMetadata = {
  title: string;
  description: string;
  canonicalUrl: string;
  robots: string;
  ogTitle: string;
  ogDescription: string;
  ogUrl: string;
  ogImage: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  publishedAt: string;
  modifiedAt: string;
  authorName: string;
  section: string;
  inLanguage: RouteLocale;
  alternates: SeoAlternate[];
  newsArticleJsonLd: Record<string, unknown> | null;
  breadcrumbJsonLd: Record<string, unknown> | null;
};

function cleanText(value: unknown): string {
  return String(value ?? '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(value: string, maxLength: number): string {
  const text = cleanText(value);
  if (text.length <= maxLength) return text;
  const sliced = text.slice(0, maxLength - 1).trim();
  return sliced ? `${sliced}…` : '';
}

function trimSlash(value: string): string {
  return String(value || '').trim().replace(/\/+$/, '');
}

function pickText(value: unknown): string {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of ['text', 'value', 'url', 'href', 'canonicalUrl', 'canonical']) {
      const nested = pickText((value as any)[key]);
      if (nested) return nested;
    }
    return '';
  }
  return cleanText(value);
}

function getLocalizedSeoOnlyValue(article: any, lang: RouteLocale, ...keys: string[]): string {
  const containers: any[] = [];
  const push = (value: any) => {
    if (value && typeof value === 'object' && !Array.isArray(value) && !containers.includes(value)) containers.push(value);
  };

  for (const group of [article?.translations, article?.translation, article?.i18n, article?.localized, article?.locales, article?.byLang, article?.textByLang]) {
    push(group?.[lang]);
  }
  push(article?.seo?.[lang]);
  push(article?.meta?.[lang]);

  for (const container of containers) {
    for (const key of keys) {
      const value = pickText(container?.[key] || container?.seo?.[key] || container?.meta?.[key]);
      if (value) return value;
    }
  }

  return '';
}

function isProductionRuntime(): boolean {
  const vercelEnv = String(process.env.VERCEL_ENV || '').toLowerCase();
  const explicit = String(process.env.NEWS_PULSE_DEPLOYMENT || process.env.NEWS_PULSE_ENV || '').toLowerCase();
  return vercelEnv === 'production' || explicit === 'production' || explicit === 'prod';
}

export function resolvePublicSiteUrl(req?: IncomingMessage | null): string {
  const configured = trimSlash(process.env.NEXT_PUBLIC_SITE_URL || '');
  if (configured) return configured;

  if (req && !isProductionRuntime()) {
    const proto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() || 'http';
    const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
    if (host) return trimSlash(`${proto}://${host}`);
  }

  return NEWS_PULSE_SITE_URL;
}

export function absolutePublicUrl(value: unknown, siteUrl = NEWS_PULSE_SITE_URL): string {
  const raw = String(value || '').trim();
  if (!raw || raw === '#') return '';
  try {
    return new URL(raw).toString();
  } catch {
    try {
      return new URL(raw.startsWith('/') ? raw : `/${raw}`, trimSlash(siteUrl)).toString();
    } catch {
      return '';
    }
  }
}

export function escapeXml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function normalizeIsoDate(value: unknown): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}

function articlePublishedAt(article: any): string {
  return normalizeIsoDate(article?.publishedAt || article?.publishDate || article?.createdAt);
}

function articleModifiedAt(article: any): string {
  return normalizeIsoDate(article?.updatedAt || article?.modifiedAt || article?.publishedAt || article?.createdAt);
}

export function isIndexablePublishedArticle(article: unknown, nowDate = new Date()): boolean {
  const item = article && typeof article === 'object' ? (article as any) : null;
  if (!item) return false;
  if (getPublicArticleStatus(item) !== 'published') return false;
  const noIndex = String(item?.robots || item?.seo?.robots || item?.meta?.robots || '').toLowerCase();
  if (noIndex.includes('noindex')) return false;
  const publishedAt = articlePublishedAt(item);
  if (!publishedAt) return false;
  return new Date(publishedAt).getTime() <= nowDate.getTime();
}

export function isEligibleForNewsSitemap(article: unknown, nowDate = new Date()): boolean {
  if (!isIndexablePublishedArticle(article, nowDate)) return false;
  const publishedAt = articlePublishedAt(article as any);
  const ageMs = nowDate.getTime() - new Date(publishedAt).getTime();
  return ageMs >= 0 && ageMs <= NEWS_SITEMAP_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

export function getArticleCanonicalUrl(article: unknown, langInput: unknown, siteUrl: string): string {
  const item = article && typeof article === 'object' ? (article as any) : null;
  if (!item) return '';

  const lang = normalizeRouteLocale(langInput);
  const localizedStored = getLocalizedSeoOnlyValue(item, lang, 'canonicalUrl', 'canonical', 'url');
  if (localizedStored) return absolutePublicUrl(localizedStored, siteUrl);

  if (lang === 'en') {
    const stored = getStoredSeoValue(item, 'canonicalUrl', 'canonical', 'url');
    if (stored) return absolutePublicUrl(stored, siteUrl);
  }

  const localized = getLocalizedArticleFields(item, lang, STRICT_LOCALE_POLICY);
  const id = String(item?._id || item?.id || '').trim();
  const slug = localized.slug || String(item?.slug || id).trim();
  if (!id && !slug) return '';
  return absolutePublicUrl(buildNewsUrl({ id: id || slug, slug: slug || id, lang }), siteUrl);
}

export function getArticleAlternates(article: unknown, siteUrl: string): SeoAlternate[] {
  const item = article && typeof article === 'object' ? (article as any) : null;
  if (!item) return [];

  const alternates: SeoAlternate[] = [];
  for (const lang of ['en', 'hi', 'gu'] as RouteLocale[]) {
    const localized = getLocalizedArticleFields(item, lang, STRICT_LOCALE_POLICY);
    if (!localized.isVisible || !localized.slug) continue;
    const id = String(item?._id || item?.id || localized.slug).trim();
    const href = absolutePublicUrl(buildNewsUrl({ id, slug: localized.slug, lang }), siteUrl);
    if (href) alternates.push({ hrefLang: lang, href });
  }

  const english = alternates.find((alternate) => alternate.hrefLang === 'en') || alternates[0];
  if (english) alternates.push({ hrefLang: 'x-default', href: english.href });
  return alternates;
}

function getArticleSection(article: any, lang: RouteLocale): string {
  const localized = getLocalizedArticleFields(article, lang, STRICT_LOCALE_POLICY);
  return cleanText(localized.categoryLabel || article?.categoryLabel || article?.categoryName || article?.category || article?.section || '');
}

export function buildArticleSeoMetadata(article: unknown, langInput: unknown, siteUrl: string): ArticleSeoMetadata | null {
  const item = article && typeof article === 'object' ? (article as any) : null;
  if (!item) return null;

  const lang = normalizeRouteLocale(langInput);
  const localized = getLocalizedArticleFields(item, lang, STRICT_LOCALE_POLICY);
  if (!localized.isVisible) return null;

  const canonicalUrl = getArticleCanonicalUrl(item, lang, siteUrl);
  const title = cleanText(getLocalizedSeoValue(item, lang, 'pageTitle', 'seoTitle', 'metaTitle', 'title') || localized.title);
  const description = truncate(
    getLocalizedSeoValue(item, lang, 'metaDescription', 'seoDescription', 'description', 'summary', 'excerpt') ||
      localized.summary ||
      localized.bodyHtml,
    180
  );
  const ogTitle = cleanText(getLocalizedSeoValue(item, lang, 'ogTitle', 'openGraphTitle') || title);
  const ogDescription = truncate(getLocalizedSeoValue(item, lang, 'ogDescription', 'openGraphDescription', 'socialDescription') || description, 220);
  const heroImage = getLocalizedSeoValue(item, lang, 'ogImage', 'openGraphImage', 'twitterImage', 'image') || resolveCoverImageUrl(item, { lang }) || '';
  const ogImage = absolutePublicUrl(heroImage, siteUrl);
  const authorName = cleanText(getArticleAuthorName(item));
  const publishedAt = articlePublishedAt(item);
  const modifiedAt = articleModifiedAt(item);
  const section = getArticleSection(item, lang);
  const alternates = getArticleAlternates(item, siteUrl);
  const logoUrl = absolutePublicUrl(NEWS_PULSE_LOGO_PATH, siteUrl);

  const newsArticleJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'NewsArticle',
    headline: title,
    description,
    mainEntityOfPage: { '@type': 'WebPage', '@id': canonicalUrl },
    publisher: {
      '@type': 'NewsMediaOrganization',
      name: NEWS_PULSE_PUBLISHER_NAME,
      url: siteUrl,
      logo: logoUrl ? { '@type': 'ImageObject', url: logoUrl } : undefined,
    },
    inLanguage: lang,
    articleSection: section || undefined,
    image: ogImage ? [ogImage] : undefined,
    datePublished: publishedAt || undefined,
    dateModified: modifiedAt || publishedAt || undefined,
    author: authorName ? { '@type': 'Person', name: authorName } : undefined,
  };

  const breadcrumbJsonLd: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: siteUrl },
      section ? { '@type': 'ListItem', position: 2, name: section, item: absolutePublicUrl(`/${String(item?.category || '').trim()}`, siteUrl) || siteUrl } : null,
      { '@type': 'ListItem', position: section ? 3 : 2, name: title, item: canonicalUrl },
    ].filter(Boolean),
  };

  return {
    title,
    description,
    canonicalUrl,
    robots: 'index,follow,max-image-preview:large',
    ogTitle,
    ogDescription,
    ogUrl: canonicalUrl,
    ogImage,
    twitterTitle: cleanText(getLocalizedSeoValue(item, lang, 'twitterTitle') || ogTitle),
    twitterDescription: truncate(getLocalizedSeoValue(item, lang, 'twitterDescription') || ogDescription, 220),
    twitterImage: absolutePublicUrl(getLocalizedSeoValue(item, lang, 'twitterImage') || ogImage, siteUrl),
    publishedAt,
    modifiedAt,
    authorName,
    section,
    inLanguage: lang,
    alternates,
    newsArticleJsonLd: removeUndefined(newsArticleJsonLd),
    breadcrumbJsonLd: removeUndefined(breadcrumbJsonLd),
  };
}

export function removeUndefined<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => removeUndefined(item)).filter((item) => item !== undefined && item !== null) as T;
  if (!value || typeof value !== 'object') return value;
  const next: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (entry === undefined || entry === null || entry === '') continue;
    next[key] = removeUndefined(entry);
  }
  return next as T;
}

export function safeJsonLd(value: unknown): string {
  return JSON.stringify(removeUndefined(value)).replace(/</g, '\\u003c');
}

export function getSitemapLastModified(article: unknown): string {
  return articleModifiedAt(article as any) || articlePublishedAt(article as any);
}