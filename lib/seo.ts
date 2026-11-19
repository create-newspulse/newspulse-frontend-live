import type { IncomingMessage } from 'http';

import { resolveCoverImageUrl } from './coverImages';
import {
  getArticleAuthorName,
  getStoredSeoValue,
} from './editorialDisplay';
import { getArticleEditionLocale, resolveArticleSlug } from './articleSlugs';
import { getPulseDialogueMetadata } from './pulseDialogue';
import { getAuthorBylineMetadata } from './authorByline';
import {
  getLocalizedArticleFields,
  getPublicArticleStatus,
  normalizeRouteLocale,
  STRICT_LOCALE_POLICY,
  type RouteLocale,
} from './localizedArticleFields';
import { buildNewsUrl } from './newsRoutes';
import { isOfficialSocialImage, normalizeSocialImageSource, parseArticleSocialImage, SOCIAL_IMAGE_FALLBACK_PATH, SOCIAL_IMAGE_HEIGHT, SOCIAL_IMAGE_WIDTH } from './articleSocialImage';

export const NEWS_PULSE_SITE_URL = 'https://www.newspulse.co.in';
export const NEWS_PULSE_BRAND_NAME = 'News Pulse';
export const NEWS_PULSE_PUBLISHER_NAME = 'News Pulse Media';
export const NEWS_PULSE_LOGO_PATH = '/icons/icon-512x512.png';
export const NEWS_PULSE_SOCIAL_IMAGE_PATH = SOCIAL_IMAGE_FALLBACK_PATH;
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
  ogImageType: 'image/jpeg';
  ogImageWidth: number;
  ogImageHeight: number;
  ogImageAlt: string;
  ogLocale: string;
  twitterTitle: string;
  twitterDescription: string;
  twitterImage: string;
  twitterImageAlt: string;
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
  const characters = [...text];
  if (characters.length <= maxLength) return text;
  const sliced = characters.slice(0, maxLength - 1).join('').trim();
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
  const containers: Array<{ value: Record<string, unknown>; editorial: boolean }> = [];
  const push = (value: unknown, editorial = false) => {
    if (value && typeof value === 'object' && !Array.isArray(value) && !containers.some(entry => entry.value === value)) {
      containers.push({ value: value as Record<string, unknown>, editorial });
    }
  };

  for (const group of [article?.translations, article?.translation, article?.i18n, article?.localized, article?.locales, article?.byLang, article?.textByLang]) {
    push(group?.[lang]);
  }
  for (const group of ['seo', 'meta', 'openGraph', 'og']) push(article?.[group]?.[lang], true);

  for (const { value: container, editorial } of containers) {
    for (const key of keys) {
      const nested = ['seo', 'meta', 'openGraph', 'og'].map(group => {
        const record = container[group];
        return record && typeof record === 'object' ? (record as Record<string, unknown>)[key] : undefined;
      });
      const value = [key !== 'image' || editorial ? container[key] : undefined, ...nested].map(pickText).find(Boolean);
      if (value) return value;
    }
  }

  return '';
}

function articleSeoText(article: any, lang: RouteLocale, ...keys: string[]): string {
  const localized = getLocalizedSeoOnlyValue(article, lang, ...keys);
  if (localized) return localized;
  const original = article?.originalLang || article?.sourceLang || getArticleEditionLocale(article);
  if (article?.isTranslated === true || !original || normalizeRouteLocale(original) !== lang) return '';
  return getStoredSeoValue(article, ...keys);
}

export function getArticleSocialImageSources(article: unknown, langInput: unknown): string[] {
  if (!article || typeof article !== 'object' || Array.isArray(article)) return [];
  const item = article as Record<string, unknown>;
  const lang = normalizeRouteLocale(langInput);
  if (!getLocalizedArticleFields(item, lang, STRICT_LOCALE_POLICY).isVisible) return [];
  const scoped: Record<string, unknown> = { ...item, url: undefined, src: undefined };
  const covers: unknown[] = [item.coverImage];
  for (const group of ['translations', 'translation', 'i18n', 'localized', 'locales', 'byLang', 'textByLang']) {
    const variants = item[group];
    if (variants && typeof variants === 'object') {
      const variant = (variants as Record<string, unknown>)[lang];
      scoped[group] = { [lang]: variant };
      if (variant && typeof variant === 'object') covers.push((variant as Record<string, unknown>).coverImage);
    }
  }
  if (item.coverImage && typeof item.coverImage === 'object') covers.push((item.coverImage as Record<string, unknown>)[lang]);
  const removed = covers.some(cover => {
    if (!cover || typeof cover !== 'object') return false;
    const record = cover as Record<string, unknown>;
    return record.removed === true || ['trashed', 'deleted'].includes(String(record.status || record.mediaStatus || record.state || '').toLowerCase());
  });
  const editorial = articleSeoText({ ...item, image: undefined }, lang, 'ogImage', 'openGraphImage', 'image');
  if (isOfficialSocialImage(editorial)) return [SOCIAL_IMAGE_FALLBACK_PATH];
  const cover = removed ? '' : resolveCoverImageUrl(scoped, { lang });
  return [...new Set([editorial, cover].map(value =>
    isOfficialSocialImage(value) ? SOCIAL_IMAGE_FALLBACK_PATH : normalizeSocialImageSource(value)
  ).filter(Boolean))];
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
  const slug = resolveArticleSlug(item, lang);
  const id = String(item?._id || item?.id || '').trim();
  if (!slug) return '';
  return absolutePublicUrl(buildNewsUrl({ id, slug, lang }), siteUrl);
}

export function getArticleAlternates(article: unknown, siteUrl: string, editions: unknown[] = []): SeoAlternate[] {
  const item = article && typeof article === 'object' ? (article as any) : null;
  if (!item) return [];

  const alternates: SeoAlternate[] = [];
  for (const lang of ['en', 'hi', 'gu'] as RouteLocale[]) {
    const edition = editions.find(candidate => getArticleEditionLocale(candidate) === lang) || item;
    const localized = getLocalizedArticleFields(edition, lang, STRICT_LOCALE_POLICY);
    if (!localized.isVisible || !localized.slug || !isIndexablePublishedArticle(edition)) continue;
    const href = getArticleCanonicalUrl(edition, lang, siteUrl);
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
  const title = cleanText(articleSeoText(item, lang, 'pageTitle', 'seoTitle', 'metaTitle', 'title') || localized.title);
  const description = truncate(
    articleSeoText(item, lang, 'metaDescription', 'seoDescription', 'description', 'summary', 'excerpt') ||
      cleanText(localized.summary) ||
      cleanText(localized.bodyHtml) ||
      localized.title,
    180
  );
  const ogTitle = cleanText(articleSeoText(item, lang, 'ogTitle', 'openGraphTitle') || title);
  const ogDescription = truncate(articleSeoText(item, lang, 'ogDescription', 'openGraphDescription', 'socialDescription') || description, 220);
  const verifiedImage = parseArticleSocialImage(item.socialImage);
  const image = verifiedImage && getArticleSocialImageSources(item, lang).includes(verifiedImage.source) ? verifiedImage : null;
  const fallbackOrigin = /^https:\/\//i.test(siteUrl) ? siteUrl : NEWS_PULSE_SITE_URL;
  const ogImage = image?.url || absolutePublicUrl(NEWS_PULSE_SOCIAL_IMAGE_PATH, fallbackOrigin);
  const ogImageAlt = cleanText(articleSeoText(item, lang, 'ogImageAlt', 'openGraphImageAlt') || ogTitle);
  const pulseDialogue = getPulseDialogueMetadata(item);
  const authorByline = getAuthorBylineMetadata(item);
  const authorName = authorByline?.name || cleanText(pulseDialogue?.contributorName || getArticleAuthorName(item));
  const authorImage = absolutePublicUrl(pulseDialogue?.contributorPhotoUrl || '', siteUrl);
  const authorAffiliation = cleanText(pulseDialogue?.contributorAffiliation || '');
  const publishedAt = articlePublishedAt(item);
  const modifiedAt = articleModifiedAt(item);
  const section = getArticleSection(item, lang);
  const alternates = getArticleAlternates(item, siteUrl);
  const logoUrl = absolutePublicUrl(NEWS_PULSE_LOGO_PATH, siteUrl);

  const authorJsonLd = authorName ? removeUndefined({
    '@type': 'Person',
    name: authorName,
    image: authorImage || undefined,
    affiliation: authorAffiliation ? { '@type': 'Organization', name: authorAffiliation } : undefined,
  }) : undefined;

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
    author: authorJsonLd,
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
    ogImageType: 'image/jpeg',
    ogImageWidth: image?.width || SOCIAL_IMAGE_WIDTH,
    ogImageHeight: image?.height || SOCIAL_IMAGE_HEIGHT,
    ogImageAlt,
    ogLocale: { en: 'en_IN', hi: 'hi_IN', gu: 'gu_IN' }[lang],
    twitterTitle: cleanText(articleSeoText(item, lang, 'twitterTitle') || ogTitle),
    twitterDescription: truncate(articleSeoText(item, lang, 'twitterDescription') || ogDescription, 220),
    twitterImage: ogImage,
    twitterImageAlt: cleanText(articleSeoText(item, lang, 'twitterImageAlt') || ogImageAlt),
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