import { resolveArticleSlug } from './articleSlugs';
import { buildNewsUrl } from './newsRoutes';

type SupportedLang = 'en' | 'hi' | 'gu';

export type SponsoredContentMeta = {
  isActive: boolean;
  isFeatureActive: boolean;
  isArticle: boolean;
  sponsorName: string;
  sponsorDisclosure: string;
  ctaLabel: string;
  destinationHref: string;
  destinationIsExternal: boolean;
};

function normalizeText(value: unknown): string {
  return String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[_/|]+/g, ' ')
    .replace(/[^a-z0-9\s-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanText(value: unknown): string {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toTextList(value: unknown): string[] {
  if (value == null) return [];

  if (Array.isArray(value)) {
    return value.flatMap((entry) => toTextList(entry));
  }

  if (typeof value === 'object') {
    const candidate =
      (value as any)?.label ??
      (value as any)?.name ??
      (value as any)?.title ??
      (value as any)?.value ??
      (value as any)?.key ??
      '';

    return candidate ? [String(candidate)] : [];
  }

  if (typeof value === 'string') {
    return value
      .split(/[;,|]+/g)
      .map((entry) => String(entry || '').trim())
      .filter(Boolean);
  }

  return [String(value)];
}

function isTruthyFlag(value: unknown): boolean {
  if (typeof value === 'boolean') return value;
  const normalized = normalizeText(value);
  return ['1', 'true', 'yes', 'active', 'enabled', 'live', 'running', 'on'].includes(normalized);
}

function isFalseyFlag(value: unknown): boolean {
  if (value === false) return true;
  const normalized = normalizeText(value);
  return ['0', 'false', 'no', 'inactive', 'disabled', 'draft', 'expired', 'ended', 'off', 'paused', 'archived'].includes(normalized);
}

function parseDateValue(value: unknown): number | null {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? parsed : null;
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

function normalizeDestinationHref(value: unknown): { href: string; isExternal: boolean } {
  const raw = String(value || '').trim();
  if (!raw) return { href: '', isExternal: false };

  if (raw.startsWith('/')) {
    return { href: raw.replace(/\/\/+/g, '/'), isExternal: false };
  }

  if (isSafeExternalUrl(raw)) {
    return { href: raw, isExternal: true };
  }

  return { href: '', isExternal: false };
}

function collectContainers(article: any): Record<string, unknown>[] {
  const candidates: Array<Record<string, unknown> | null | undefined> = [
    article,
    article?.meta,
    article?.metadata,
    article?.attributes,
    article?.flags,
    article?.settings,
  ];

  const nestedKeys = [
    'sponsoredContent',
    'sponsorship',
    'sponsor',
    'sponsorDetails',
    'sponsorMeta',
    'sponsoredFeature',
    'sponsoredArticle',
    'sponsoredCampaign',
    'campaign',
    'promotion',
    'promo',
    'brandedContent',
    'partnerContent',
    'advertiser',
    'callToAction',
    'cta',
  ];

  for (const container of [...candidates]) {
    if (!container || typeof container !== 'object') continue;
    for (const key of nestedKeys) {
      const nested = (container as any)?.[key];
      if (nested && typeof nested === 'object') candidates.push(nested);
    }
  }

  const seen = new Set<object>();
  return candidates.filter((value): value is Record<string, unknown> => {
    if (!value || typeof value !== 'object') return false;
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

function readFirstValue(containers: Array<Record<string, unknown>>, keys: string[]): unknown {
  for (const container of containers) {
    for (const key of keys) {
      const value = (container as any)?.[key];
      if (value !== undefined && value !== null && value !== '') return value;
    }
  }

  return undefined;
}

function collectTokens(article: any, containers: Array<Record<string, unknown>>): string[] {
  const values = [
    ...containers.flatMap((container) => [
      container.tags,
      container.tag,
      container.labels,
      container.label,
      container.badges,
      container.badge,
      container.keywords,
      container.featureType,
      container.featureLabel,
      container.type,
      container.storyType,
      container.articleType,
      container.contentType,
      container.format,
      container.placement,
      container.slot,
      container.position,
      container.topic,
      container.topics,
    ]),
    article?.category,
  ];

  return Array.from(new Set(values.flatMap((value) => toTextList(value)).map((value) => normalizeText(value)).filter(Boolean)));
}

function tokenMatches(tokens: string[], patterns: RegExp[]): boolean {
  return patterns.some((pattern) => tokens.some((token) => pattern.test(token)));
}

function extractCta(containers: Array<Record<string, unknown>>): { label: string; url: string } {
  const ctaContainer = readFirstValue(containers, ['callToAction', 'cta', 'ctaButton', 'action']) as any;
  const directLabel = cleanText(readFirstValue(containers, ['ctaLabel', 'ctaText', 'buttonLabel', 'buttonText', 'actionLabel', 'actionText', 'linkText']));
  const directUrl = cleanText(readFirstValue(containers, ['ctaUrl', 'destinationUrl', 'targetUrl', 'linkUrl', 'href', 'url']));

  const objectLabel = cleanText(
    ctaContainer && typeof ctaContainer === 'object'
      ? ctaContainer.label || ctaContainer.text || ctaContainer.title || ctaContainer.name || ctaContainer.buttonText
      : ''
  );

  const objectUrl = cleanText(
    ctaContainer && typeof ctaContainer === 'object'
      ? ctaContainer.url || ctaContainer.href || ctaContainer.link || ctaContainer.targetUrl || ctaContainer.destinationUrl
      : ''
  );

  return {
    label: directLabel || objectLabel,
    url: directUrl || objectUrl,
  };
}

export function resolveSponsoredContentMeta(article: any, lang: SupportedLang): SponsoredContentMeta {
  const containers = collectContainers(article);
  const tokens = collectTokens(article, containers);
  const sponsorName = cleanText(
    readFirstValue(containers, ['sponsorName', 'sponsor', 'brandName', 'brand', 'advertiserName', 'partnerName', 'sponsoredBy'])
  );
  const sponsorDisclosureRaw = cleanText(
    readFirstValue(containers, [
      'sponsorDisclosure',
      'disclosure',
      'disclaimer',
      'sponsoredDisclosure',
      'sponsorshipDisclosure',
      'partnerDisclosure',
      'advertiserDisclosure',
    ])
  );

  const explicitSponsored =
    isTruthyFlag(readFirstValue(containers, ['isSponsored', 'sponsored', 'isSponsoredContent', 'isPartnerContent', 'isBrandedContent'])) ||
    tokenMatches(tokens, [/\bsponsored\b/, /\bpartner content\b/, /\bbranded content\b/, /\bpromoted\b/]);

  const explicitSponsoredFeature =
    isTruthyFlag(readFirstValue(containers, ['isSponsoredFeature', 'sponsoredFeature', 'sponsoredFeatureActive', 'featureActive'])) ||
    tokenMatches(tokens, [
      /\bsponsored feature\b/,
      /\bhomepage promo\b/,
      /\bpromo card\b/,
      /\bcenter block\b/,
      /\bhome feature\b/,
      /\bhomepage feature\b/,
      /\bpartner spotlight\b/,
    ]);

  const explicitSponsoredArticle =
    isTruthyFlag(readFirstValue(containers, ['isSponsoredArticle', 'sponsoredArticle', 'isPartnerArticle', 'partnerArticle'])) ||
    tokenMatches(tokens, [/\bsponsored article\b/, /\bsponsored story\b/, /\bpartner article\b/, /\bbranded article\b/]);

  const explicitlyInactive =
    isFalseyFlag(readFirstValue(containers, ['sponsoredFeatureActive', 'featureActive', 'isSponsoredFeature', 'sponsoredStatus', 'campaignStatus'])) ||
    isFalseyFlag(readFirstValue(containers, ['isSponsored', 'sponsored', 'isSponsoredArticle', 'sponsoredArticleStatus']));

  const startAt = parseDateValue(readFirstValue(containers, ['sponsoredStartAt', 'campaignStartAt', 'startAt', 'startsAt', 'startDate', 'goLiveAt']));
  const endAt = parseDateValue(readFirstValue(containers, ['sponsoredEndAt', 'campaignEndAt', 'endAt', 'endsAt', 'endDate', 'expiresAt']));
  const now = Date.now();
  const dateIsActive = (!startAt || startAt <= now) && (!endAt || endAt >= now);

  const hasActiveStatus = isTruthyFlag(readFirstValue(containers, ['sponsoredStatus', 'sponsoredFeatureStatus', 'sponsoredArticleStatus', 'campaignStatus']));
  const isActive = !explicitlyInactive && dateIsActive && (explicitSponsored || explicitSponsoredFeature || explicitSponsoredArticle || Boolean(sponsorName) || Boolean(sponsorDisclosureRaw) || hasActiveStatus);

  const linkedArticleSlug = cleanText(
    readFirstValue(containers, ['linkedArticleSlug', 'sponsoredArticleSlug', 'targetArticleSlug', 'destinationArticleSlug', 'articleSlug'])
  );
  const linkedArticleId = cleanText(
    readFirstValue(containers, ['linkedArticleId', 'sponsoredArticleId', 'targetArticleId', 'destinationArticleId'])
  );
  const currentId = cleanText(article?._id || article?.id);
  const currentSlug = cleanText(resolveArticleSlug(article, lang) || article?.slug);

  const cta = extractCta(containers);
  const directDestination = normalizeDestinationHref(
    cta.url || readFirstValue(containers, ['destinationUrl', 'targetUrl', 'linkUrl', 'ctaUrl', 'href', 'url', 'permalink', 'canonicalUrl'])
  );

  const linkedDestination = linkedArticleId || linkedArticleSlug
    ? {
        href: buildNewsUrl({ id: linkedArticleId || linkedArticleSlug, slug: linkedArticleSlug || linkedArticleId, lang }),
        isExternal: false,
      }
    : { href: '', isExternal: false };

  const currentArticleDestination = (currentId || currentSlug) && isActive
    ? {
        href: buildNewsUrl({ id: currentId || currentSlug, slug: currentSlug || currentId, lang }),
        isExternal: false,
      }
    : { href: '', isExternal: false };

  const destination = linkedDestination.href ? linkedDestination : (directDestination.href ? directDestination : currentArticleDestination);
  const isFeatureActive = isActive && (explicitSponsoredFeature || Boolean(linkedDestination.href) || Boolean(directDestination.href && !explicitSponsoredArticle));
  const isArticle = isActive && (explicitSponsoredArticle || explicitSponsored || isFeatureActive);

  const sponsorDisclosure = sponsorDisclosureRaw || (
    sponsorName
      ? `This story is presented as sponsored content in partnership with ${sponsorName}.`
      : (isArticle || isFeatureActive ? 'This story is presented as sponsored content.' : '')
  );

  const ctaLabel = cleanText(cta.label) || (
    destination.href
      ? (destination.isExternal ? 'Visit sponsor' : (isFeatureActive ? 'Read sponsored feature' : 'Read sponsored story'))
      : ''
  );

  return {
    isActive,
    isFeatureActive,
    isArticle,
    sponsorName,
    sponsorDisclosure,
    ctaLabel,
    destinationHref: destination.href,
    destinationIsExternal: destination.isExternal,
  };
}