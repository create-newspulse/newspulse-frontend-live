import { COVER_PLACEHOLDER_SRC, resolveCoverImageUrl } from './coverImages';
import { buildNewsUrl } from './newsRoutes';
import { resolveArticleSlug } from './articleSlugs';
import { resolveSponsoredContentMeta } from './sponsoredContent';

export type SupportedSponsoredFeatureLang = 'en' | 'hi' | 'gu';

export type HomepageSponsoredFeature = {
  sponsorName: string;
  headline: string;
  shortSummary: string;
  ctaLabel: string;
  ctaText: string | null;
  imageSrc: string;
  coverImage: string | null;
  href: string;
  destinationUrl: string | null;
  destinationIsExternal: boolean;
  sponsorDisclosure: string;
  linkedArticleId: string | null;
  linkedSponsoredArticleId: string | null;
  linkedArticleSlug: string | null;
  linkedArticleUrl: string | null;
};

const HOMEPAGE_SPONSORED_FEATURE_ALLOWED_IMAGE_HOSTS = new Set([
  'res.cloudinary.com',
  'newspulse-backend-real.onrender.com',
  'fluidmechpumps.com',
  'www.fluidmechpumps.com',
  'localhost',
  '127.0.0.1',
]);

function cleanText(value: unknown): string {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeText(value: unknown): string {
  return cleanText(value)
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[_/|]+/g, ' ')
    .replace(/[^a-z0-9\s-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSafeExternalUrl(value: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function isSupportedHomepageSponsoredFeatureImageSrc(value: string): boolean {
  if (!value) return false;
  if (value.startsWith('/')) return true;
  if (value.startsWith('data:image/')) return true;

  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
    if (!HOMEPAGE_SPONSORED_FEATURE_ALLOWED_IMAGE_HOSTS.has(url.hostname)) return false;
    if (url.hostname === 'fluidmechpumps.com' || url.hostname === 'www.fluidmechpumps.com') {
      return /^\/wp-content\/uploads\//.test(url.pathname);
    }
    return true;
  } catch {
    return false;
  }
}

function resolveHomepageSponsoredFeatureImageSrc(candidate: any): string {
  const imageSrc = cleanText(
    pickFirstText(candidate, [
      ['imageSrc'],
      ['imageUrl'],
      ['image'],
      ['coverImageUrl'],
      ['coverImage', 'url'],
      ['creativeUrl'],
      ['creative', 'url'],
    ]) || resolveCoverImageUrl(candidate)
  );

  return isSupportedHomepageSponsoredFeatureImageSrc(imageSrc) ? imageSrc : COVER_PLACEHOLDER_SRC;
}

function pickFirstText(source: any, paths: string[][]): string {
  for (const path of paths) {
    let current = source;
    for (const segment of path) {
      current = current && typeof current === 'object' ? current[segment] : undefined;
    }
    const text = cleanText(current);
    if (text) return text;
  }
  return '';
}

function unwrapFeatureCandidate(payload: any): any {
  if (!payload || typeof payload !== 'object') return null;

  const directCandidates = [
    payload.feature,
    payload.item,
    payload.data,
    payload.result,
    payload.sponsoredFeature,
    payload.homepageSponsoredFeature,
  ];

  for (const candidate of directCandidates) {
    if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) return candidate;
  }

  const listCandidates = [payload.features, payload.items, payload.data, payload.results, payload.ads];
  for (const list of listCandidates) {
    if (Array.isArray(list) && list.length > 0 && list[0] && typeof list[0] === 'object') return list[0];
  }

  return payload;
}

function resolveLinkedArticleIdentity(candidate: any, lang: SupportedSponsoredFeatureLang): { id: string; slug: string; href: string } {
  const linked =
    candidate?.linkedSponsoredArticle ||
    candidate?.linkedArticle ||
    candidate?.sponsoredArticle ||
    candidate?.article ||
    null;

  const linkedId = cleanText(
    linked?._id ||
      linked?.id ||
      candidate?.linkedSponsoredArticleId ||
      candidate?.linkedArticleId ||
      candidate?.sponsoredArticleId ||
      candidate?.targetArticleId ||
      candidate?.destinationArticleId
  );

  const linkedSlug = cleanText(
    linked?.slug ||
      resolveArticleSlug(linked, lang) ||
      candidate?.linkedSponsoredArticleSlug ||
      candidate?.linkedArticleSlug ||
      candidate?.sponsoredArticleSlug ||
      candidate?.targetArticleSlug ||
      candidate?.destinationArticleSlug
  );

  const href = linkedId || linkedSlug
    ? buildNewsUrl({ id: linkedId || linkedSlug, slug: linkedSlug || linkedId, lang })
    : '';

  return { id: linkedId, slug: linkedSlug, href };
}

function resolveDirectDestination(candidate: any): { href: string; isExternal: boolean } {
  const href = pickFirstText(candidate, [
    ['href'],
    ['destinationUrl'],
    ['targetUrl'],
    ['url'],
    ['cta', 'href'],
    ['cta', 'url'],
    ['callToAction', 'href'],
    ['callToAction', 'url'],
  ]);

  if (!href) return { href: '', isExternal: false };
  if (href.startsWith('/')) return { href, isExternal: false };
  if (isSafeExternalUrl(href)) return { href, isExternal: true };
  return { href: '', isExternal: false };
}

function isActiveFeatureCandidate(payload: any, candidate: any, metaIsFeatureActive: boolean): boolean {
  const falseyValues = ['0', 'false', 'no', 'inactive', 'disabled', 'draft', 'expired', 'off', 'archived', 'paused'];
  const truthyValues = ['1', 'true', 'yes', 'active', 'enabled', 'live', 'running', 'on'];

  const activeCandidates = [
    candidate?.active,
    candidate?.enabled,
    candidate?.isActive,
    candidate?.featureActive,
    candidate?.sponsoredFeatureActive,
    payload?.active,
    payload?.enabled,
  ];

  for (const value of activeCandidates) {
    if (value === false) return false;
    const normalized = normalizeText(value);
    if (falseyValues.includes(normalized)) return false;
    if (truthyValues.includes(normalized)) return true;
  }

  const statusCandidates = [
    candidate?.status,
    candidate?.featureStatus,
    candidate?.sponsoredStatus,
    candidate?.sponsoredFeatureStatus,
    payload?.status,
  ];

  for (const value of statusCandidates) {
    const normalized = normalizeText(value);
    if (falseyValues.includes(normalized)) return false;
    if (truthyValues.includes(normalized)) return true;
  }

  return metaIsFeatureActive;
}

export function normalizeHomepageSponsoredFeature(
  payload: any,
  lang: SupportedSponsoredFeatureLang
): HomepageSponsoredFeature | null {
  const candidate = unwrapFeatureCandidate(payload);
  if (!candidate || typeof candidate !== 'object') return null;

  const sponsoredMeta = resolveSponsoredContentMeta(candidate, lang);
  const linkedArticle = resolveLinkedArticleIdentity(candidate, lang);
  const directDestination = resolveDirectDestination(candidate);
  const href = linkedArticle.href || sponsoredMeta.destinationHref || directDestination.href;
  const destinationIsExternal = linkedArticle.href ? false : (sponsoredMeta.destinationIsExternal || directDestination.isExternal);
  const destinationUrl = directDestination.href || (sponsoredMeta.destinationIsExternal ? sponsoredMeta.destinationHref : '');

  const sponsorName = pickFirstText(candidate, [
    ['sponsorName'],
    ['brandName'],
    ['sponsor'],
    ['brand'],
    ['advertiserName'],
    ['partnerName'],
  ]) || cleanText(sponsoredMeta.sponsorName);

  const headline = pickFirstText(candidate, [
    ['headline'],
    ['title'],
    ['name'],
    ['content', 'headline'],
    ['content', 'title'],
  ]);

  const shortSummary = pickFirstText(candidate, [
    ['shortSummary'],
    ['summary'],
    ['excerpt'],
    ['description'],
    ['dek'],
    ['deck'],
    ['subtitle'],
  ]);

  const ctaLabel = pickFirstText(candidate, [
    ['ctaText'],
    ['ctaLabel'],
    ['buttonText'],
    ['buttonLabel'],
    ['callToAction', 'text'],
    ['callToAction', 'label'],
    ['cta', 'text'],
    ['cta', 'label'],
  ]) || cleanText(sponsoredMeta.ctaLabel);

  const imageSrc = resolveHomepageSponsoredFeatureImageSrc(candidate);

  const sponsorDisclosure = pickFirstText(candidate, [
    ['sponsorDisclosure'],
    ['disclosure'],
    ['disclaimer'],
  ]) || cleanText(sponsoredMeta.sponsorDisclosure);

  const isActive = isActiveFeatureCandidate(payload, candidate, sponsoredMeta.isFeatureActive);

  if (!isActive) return null;
  if (!sponsorName || !headline || !shortSummary || !ctaLabel || !imageSrc || !href) return null;

  return {
    sponsorName,
    headline,
    shortSummary,
    ctaLabel,
    ctaText: ctaLabel || null,
    imageSrc,
    coverImage: imageSrc || null,
    href,
    destinationUrl: destinationUrl || null,
    destinationIsExternal,
    sponsorDisclosure,
    linkedArticleId: linkedArticle.id || null,
    linkedSponsoredArticleId: linkedArticle.id || null,
    linkedArticleSlug: linkedArticle.slug || null,
    linkedArticleUrl: linkedArticle.href || null,
  };
}

export function normalizeHomepageSponsoredFeatureProps(
  feature: HomepageSponsoredFeature | null
): HomepageSponsoredFeature | null {
  if (!feature) return null;

  return {
    sponsorName: cleanText(feature.sponsorName),
    headline: cleanText(feature.headline),
    shortSummary: cleanText(feature.shortSummary),
    ctaLabel: cleanText(feature.ctaLabel),
    ctaText: cleanText(feature.ctaText) || cleanText(feature.ctaLabel) || null,
    imageSrc: cleanText(feature.imageSrc),
    coverImage: cleanText(feature.coverImage) || cleanText(feature.imageSrc) || null,
    href: cleanText(feature.href),
    destinationUrl: cleanText(feature.destinationUrl) || null,
    destinationIsExternal: Boolean(feature.destinationIsExternal),
    sponsorDisclosure: cleanText(feature.sponsorDisclosure),
    linkedArticleId: cleanText(feature.linkedArticleId) || null,
    linkedSponsoredArticleId: cleanText(feature.linkedSponsoredArticleId) || cleanText(feature.linkedArticleId) || null,
    linkedArticleSlug: cleanText(feature.linkedArticleSlug) || null,
    linkedArticleUrl: cleanText(feature.linkedArticleUrl) || null,
  };
}

export async function fetchHomepageSponsoredFeature(options: {
  lang: SupportedSponsoredFeatureLang;
  placement?: string;
  signal?: AbortSignal;
}): Promise<HomepageSponsoredFeature | null> {
  const params = new URLSearchParams();
  params.set('placement', String(options.placement || 'homepage'));
  params.set('lang', options.lang);
  params.set('language', options.lang);

  const response = await fetch(`/api/public/sponsored-feature?${params.toString()}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
    },
    cache: 'no-store',
    signal: options.signal,
  });

  if (!response.ok) return null;

  const json = await response.json().catch(() => null);
  const feature = json && typeof json === 'object' ? (json as any).feature : null;
  return feature && typeof feature === 'object' ? (feature as HomepageSponsoredFeature) : null;
}