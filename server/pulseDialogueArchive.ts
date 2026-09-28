import type { GetServerSidePropsContext, GetServerSidePropsResult } from 'next';
import sanitizeHtml from 'sanitize-html';
import type { CategoryStoryHierarchyItem } from '../components/category/CategoryStoryHierarchy';
import { getMessages } from '../lib/getMessages';
import { getPublicApiBaseUrl } from '../lib/publicApiBase';
import { withPublicReadDeadline } from '../lib/publicReadDeadline';
import { getLocalizedArticleFields, normalizeRouteLocale, type RouteLocale } from '../lib/localizedArticleFields';
import { buildNewsUrl } from '../lib/newsRoutes';
import { getPulseDialogueMetadata, pulseDialogueArchivePath } from '../lib/pulseDialogue';
import { resolveCoverFitMode, resolveCoverImageUrl } from '../lib/coverImages';
import { getStoryId } from '../lib/storyIdentity';
import { formatEditorialDateTime, resolveStoryDateIso } from '../lib/storyDateTime';
import { absolutePublicUrl, NEWS_PULSE_PUBLISHER_NAME, removeUndefined, resolvePublicSiteUrl, type SeoAlternate } from '../lib/seo';

export type ContributorProfile = {
  slug: string;
  name: string;
  publicDesignation: string | null;
  photoUrl: string | null;
  shortBio: string | null;
};

export type DialogueSeries = {
  slug: string;
  title: string;
  description: string | null;
  ownerContributor: ContributorProfile | null;
  articleCount: number;
};

export type DialogueArchiveProps = {
  locale: RouteLocale;
  messages: Record<string, unknown>;
  kind: 'contributors' | 'series';
  contributor: (ContributorProfile & { contributionCount: number }) | null;
  series: DialogueSeries | null;
  items: CategoryStoryHierarchyItem[];
  pagination: { page: number; totalPages: number; hasNextPage: boolean };
  error: boolean;
  seo: {
    title: string;
    description: string;
    canonicalUrl: string;
    alternates: SeoAlternate[];
    jsonLd: Record<string, unknown> | null;
    disableAlternates: boolean;
  };
};

function publicPhoto(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : null;
  } catch { return null; }
}

function profile(value: ContributorProfile): ContributorProfile {
  if (!value || typeof value.slug !== 'string' || !value.slug || typeof value.name !== 'string') {
    throw new Error('Invalid contributor response');
  }
  return {
    slug: value.slug, name: value.name,
    publicDesignation: typeof value.publicDesignation === 'string' ? value.publicDesignation : null,
    photoUrl: publicPhoto(value.photoUrl),
    shortBio: typeof value.shortBio === 'string' ? value.shortBio : null,
  };
}

function pageNumber(value: unknown): number {
  return typeof value === 'string' && /^\d+$/.test(value) ? Math.min(10000, Math.max(1, Number(value))) : 1;
}

function seoText(value: string): string {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, ' ').trim();
}

export async function getDialogueArchiveProps(
  ctx: GetServerSidePropsContext,
  kind: DialogueArchiveProps['kind'],
): Promise<GetServerSidePropsResult<DialogueArchiveProps>> {
  const locale = normalizeRouteLocale(ctx.locale);
  const slug = ctx.params?.slug;
  if (typeof slug !== 'string' || !slug) return { notFound: true };
  const page = pageNumber(ctx.query.page);
  const messages = await getMessages(locale);
  ctx.res.setHeader('Cache-Control', 'no-store');
  try {
    const base = getPublicApiBaseUrl();
    if (!base) throw new Error('Public backend is not configured');
    const query = new URLSearchParams({ lang: locale, page: String(page), limit: '12' });
    const payload = await withPublicReadDeadline(8000, async (signal) => {
      const response = await fetch(`${base}/api/public/pulse-dialogue/${kind}/${encodeURIComponent(slug)}/articles?${query}`, {
        method: 'GET', headers: { Accept: 'application/json' }, cache: 'no-store', signal,
      });
      if (response.status === 404) return null;
      if (!response.ok) throw new Error('Pulse Dialogue unavailable');
      return response.json();
    });
    if (payload === null) return { notFound: true };
    if (payload.ok !== true || !Array.isArray(payload.items) || payload.lang !== locale ||
      !Number.isInteger(payload.page) || payload.page !== page || !Number.isInteger(payload.totalPages) ||
      payload.totalPages < 0 || typeof payload.hasNextPage !== 'boolean') throw new Error('Invalid archive response');

    const contributor = kind === 'contributors'
      ? { ...profile(payload.contributor), contributionCount: payload.contributor.contributionCount } : null;
    const series: DialogueSeries | null = kind === 'series' ? {
      slug: payload.series.slug, title: payload.series.title,
      description: typeof payload.series.description === 'string' ? payload.series.description : null,
      ownerContributor: payload.series.ownerContributor ? profile(payload.series.ownerContributor) : null,
      articleCount: payload.series.articleCount,
    } : null;
    const canonicalSlug = contributor?.slug || series?.slug;
    const count = contributor?.contributionCount ?? series?.articleCount;
    if (!canonicalSlug || typeof canonicalSlug !== 'string' || !Number.isInteger(count) || count! < 0 ||
      (series && typeof series.title !== 'string')) throw new Error('Invalid profile response');
    if (contributor && payload.redirectRequired === true && payload.canonicalSlug === contributor.slug && contributor.slug !== slug) {
      return { redirect: { destination: pulseDialogueArchivePath(kind, contributor.slug, locale, page), permanent: true } };
    }

    const siteUrl = resolvePublicSiteUrl(ctx.req);
    const canonicalUrl = absolutePublicUrl(pulseDialogueArchivePath(kind, canonicalSlug, locale, page), siteUrl);
    const name = seoText(contributor?.name || series!.title);
    const description = seoText(contributor?.shortBio || series?.description || `${name} | Pulse Dialogue | News Pulse`).slice(0, 200);
    const person = contributor ? removeUndefined({
      '@type': 'Person', name: contributor.name,
      url: absolutePublicUrl(pulseDialogueArchivePath(kind, canonicalSlug, locale), siteUrl),
      jobTitle: contributor.publicDesignation || undefined,
      description: contributor.shortBio ? seoText(contributor.shortBio) : undefined,
      image: contributor.photoUrl || undefined,
    }) : null;
    const items = payload.items.map((article: any): CategoryStoryHierarchyItem => {
      const resolvedLang = normalizeRouteLocale(article.resolvedLang || article.resolvedLanguage || article.language || locale);
      const localized = getLocalizedArticleFields(article, resolvedLang);
      const id = getStoryId(article);
      const title = article.localizedTitle || localized.title || article.title;
      const imageSrc = resolveCoverImageUrl(article);
      const metadata = getPulseDialogueMetadata(article);
      const dateIso = resolveStoryDateIso(article);
      return removeUndefined({
        id, title, titleText: title,
        href: buildNewsUrl({ id, slug: article.localizedSlug || localized.slug || article.slug, lang: resolvedLang }),
        summary: localized.summary || article.summary || '', imageSrc: imageSrc || undefined,
        imageFitMode: resolveCoverFitMode(article, { src: imageSrc, altText: title }),
        dateIso, dateLabel: formatEditorialDateTime(dateIso),
        authorName: metadata?.contributorName || '', authorDesignation: metadata?.contributorDesignation || '',
        contributorPhotoSrc: metadata?.contributorPhotoUrl || '', contributorPhotoAlt: metadata?.contributorPhotoAlt || '',
      });
    });
    const alternates: SeoAlternate[] = (['en', 'hi', 'gu'] as const).map((lang) => ({
      hrefLang: lang, href: absolutePublicUrl(pulseDialogueArchivePath(kind, canonicalSlug, lang, page), siteUrl),
    }));
    alternates.push({ hrefLang: 'x-default', href: alternates[0].href });
    return { props: {
      locale, messages, kind, contributor, series, items,
      pagination: { page: payload.page, totalPages: payload.totalPages, hasNextPage: payload.hasNextPage }, error: false,
      seo: {
        title: `${name} | Pulse Dialogue | News Pulse`, description, canonicalUrl, alternates, disableAlternates: false,
        jsonLd: {
          '@context': 'https://schema.org', '@type': 'CollectionPage', name, description, url: canonicalUrl,
          inLanguage: locale, publisher: { '@type': 'Organization', name: NEWS_PULSE_PUBLISHER_NAME, url: siteUrl },
          ...(person ? { mainEntity: person } : {}),
        },
      },
    } };
  } catch {
    ctx.res.statusCode = 503;
    ctx.res.setHeader('Retry-After', '60');
    return { props: {
      locale, messages, kind, contributor: null, series: null, items: [], error: true,
      pagination: { page, totalPages: 0, hasNextPage: false },
      seo: { title: 'Pulse Dialogue | News Pulse', description: '', canonicalUrl: '', alternates: [], jsonLd: null, disableAlternates: true },
    } };
  }
}