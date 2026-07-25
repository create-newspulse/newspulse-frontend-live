import { getCategoryRouteKey } from './categoryKeys';

export type EditorialTypeKey = 'editorial' | 'special_story';

function cleanText(value: unknown): string {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickText(...values: unknown[]): string {
  for (const value of values) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = pickText(
        (value as any).name,
        (value as any).displayName,
        (value as any).fullName,
        (value as any).title,
        (value as any).label,
        (value as any).designation,
        (value as any).role
      );
      if (nested) return nested;
      continue;
    }

    const text = cleanText(value);
    if (text) return text;
  }
  return '';
}

function normalizeLocale(value: unknown): 'en' | 'hi' | 'gu' | '' {
  const raw = String(value || '').toLowerCase().trim();
  if (raw === 'hi' || raw === 'hindi' || raw === 'in') return 'hi';
  if (raw === 'gu' || raw === 'gujarati') return 'gu';
  if (raw === 'en' || raw === 'english') return 'en';
  return '';
}

function localizedContainers(item: any, lang?: unknown): any[] {
  const locale = normalizeLocale(lang);
  if (!locale) return [];

  const containers: any[] = [];
  const push = (value: any) => {
    if (!value || typeof value !== 'object') return;
    if (containers.includes(value)) return;
    containers.push(value);
  };

  for (const group of [item?.translations, item?.translation, item?.i18n, item?.localized, item?.locales, item?.byLang, item?.textByLang]) {
    push(group?.[locale]);
  }
  push(item?.seo?.[locale]);
  push(item?.meta?.[locale]);
  push(item?.openGraph?.[locale]);
  push(item?.og?.[locale]);
  push(item?.image?.[locale]);
  push(item?.images?.[locale]);
  push(item?.coverImage?.[locale]);
  push(item?.coverImages?.[locale]);

  return containers;
}

function normalizeToken(value: unknown): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/[^a-z0-9\s]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isEditorialArticle(article: unknown): boolean {
  const item = article && typeof article === 'object' ? (article as any) : null;
  if (!item) return false;

  const category = pickText(item.category, item.categoryKey, item.section, item.desk, item.type);
  return getCategoryRouteKey(category) === 'editorial' || normalizeToken(category) === 'editorial';
}

export function resolveEditorialType(article: unknown): EditorialTypeKey | null {
  const item = article && typeof article === 'object' ? (article as any) : null;
  if (!item) return null;

  const raw = normalizeToken(pickText(item.editorialType, item.editorial_type, item.storyType, item.story_type));
  if (raw === 'special story' || raw === 'specialstory') return 'special_story';
  if (raw === 'editorial') return 'editorial';

  return isEditorialArticle(item) ? 'editorial' : null;
}

export function getEditorialTypeLabel(article: unknown): string {
  const type = resolveEditorialType(article);
  if (type === 'special_story') return 'SPECIAL STORY';
  if (type === 'editorial') return 'EDITORIAL';
  return '';
}

export function getArticleAuthorName(article: unknown): string {
  const item = article && typeof article === 'object' ? (article as any) : null;
  if (!item) return '';

  return pickText(
    item.authorName,
    item.byline,
    item.author,
    item.writerName,
    item.reporterName,
    item.createdByName,
    item.userName
  );
}

export function getArticleAuthorDesignation(article: unknown): string {
  const item = article && typeof article === 'object' ? (article as any) : null;
  if (!item) return '';

  return pickText(
    item.authorDesignation,
    item.authorRole,
    item.authorTitle,
    item.designation,
    item.bylineDesignation,
    item.author?.designation,
    item.author?.role,
    item.author?.title
  );
}

export function getArticleReadingTime(article: unknown): string {
  const item = article && typeof article === 'object' ? (article as any) : null;
  if (!item) return '';

  const raw = pickText(item.readingTime, item.readTime, item.readingTimeText, item.estimatedReadingTime);
  if (raw) {
    if (/\bread\b/i.test(raw)) return raw;
    if (/^\d+(\.\d+)?$/.test(raw)) return `${Math.max(1, Math.round(Number(raw)))} min read`;
    return raw;
  }

  const minutes = Number(item.readingMinutes ?? item.readTimeMinutes ?? item.estimatedReadMinutes);
  if (Number.isFinite(minutes) && minutes > 0) return `${Math.max(1, Math.round(minutes))} min read`;
  return '';
}

export function getImageCaption(article: unknown, lang?: unknown): string {
  const item = article && typeof article === 'object' ? (article as any) : null;
  if (!item) return '';
  for (const container of localizedContainers(item, lang)) {
    const text = pickText(container.imageCaption, container.caption, container.featuredImageCaption, container.coverImage?.caption, container.image?.caption);
    if (text) return text;
  }
  return pickText(item.imageCaption, item.caption, item.featuredImageCaption, item.coverImage?.caption, item.image?.caption);
}

export function getImageCredit(article: unknown, lang?: unknown): string {
  const item = article && typeof article === 'object' ? (article as any) : null;
  if (!item) return '';
  for (const container of localizedContainers(item, lang)) {
    const text = pickText(container.imageCredit, container.credit, container.photoCredit, container.featuredImageCredit, container.coverImage?.credit, container.image?.credit);
    if (text) return text;
  }
  return pickText(item.imageCredit, item.credit, item.photoCredit, item.featuredImageCredit, item.coverImage?.credit, item.image?.credit);
}

export function getImageAltText(article: unknown, lang?: unknown): string {
  const item = article && typeof article === 'object' ? (article as any) : null;
  if (!item) return '';
  for (const container of localizedContainers(item, lang)) {
    const text = pickText(container.imageAlt, container.imageAltText, container.altText, container.alt, container.coverImage?.alt, container.image?.alt);
    if (text) return text;
  }
  return pickText(item.imageAlt, item.imageAltText, item.altText, item.alt, item.coverImage?.alt, item.image?.alt);
}

export function getStoredSeoValue(article: unknown, ...keys: string[]): string {
  const item = article && typeof article === 'object' ? (article as any) : null;
  if (!item) return '';

  const containers = [item.seo, item.meta, item.openGraph, item.og, item].filter(Boolean);
  for (const key of keys) {
    for (const container of containers) {
      const value = pickText(container?.[key]);
      if (value) return value;
    }
  }
  return '';
}

export function getLocalizedSeoValue(article: unknown, lang: unknown, ...keys: string[]): string {
  const item = article && typeof article === 'object' ? (article as any) : null;
  if (!item) return '';

  for (const container of localizedContainers(item, lang)) {
    for (const key of keys) {
      const value = pickText(container?.[key], container?.seo?.[key], container?.meta?.[key], container?.openGraph?.[key], container?.og?.[key]);
      if (value) return value;
    }
  }

  return getStoredSeoValue(item, ...keys);
}
