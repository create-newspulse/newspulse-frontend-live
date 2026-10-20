import {
  normalizeHomepageSponsoredFeature,
  normalizeHomepageSponsoredFeatureProps,
} from '../../lib/publicSponsoredFeature';

describe.each(['en', 'hi', 'gu'] as const)('%s campaign safety', (lang) => {
  const now = '2026-10-20T12:00:00.000Z';
  const candidate = {
    active: true, sponsorName: 'Fixture Sponsor', headline: 'Sponsored fixture',
    shortSummary: 'Fixture campaign summary', ctaLabel: 'Visit fixture sponsor',
    imageSrc: '/images/placeholder-16x9.svg', destinationUrl: 'https://sponsor.test/information',
  };
  const inactiveCases: Array<{ name: string; feature: Record<string, unknown>; envelope?: Record<string, unknown> }> = [
    { name: 'paused status', feature: { status: 'paused' } },
    { name: 'expired status', feature: { status: 'expired' } },
    { name: 'ended status', feature: { status: 'ended' } },
    { name: 'scheduled status without invented dates', feature: { status: 'scheduled' } },
    { name: 'future scheduled campaign', feature: { status: 'scheduled', startsAt: '2026-10-21T12:00:00.000Z' } },
    { name: 'future start despite active status', feature: { status: 'active', startAt: '2026-10-21T12:00:00.000Z' } },
    { name: 'elapsed end despite active status', feature: { status: 'active', endAt: '2026-10-19T12:00:00.000Z' } },
    { name: 'disabled feature flag', feature: { featureActive: false } },
    { name: 'disabled enabled flag', feature: { enabled: false } },
    { name: 'disabled isActive flag', feature: { isActive: false } },
    { name: 'nested paused campaign', feature: { campaign: { status: 'paused' } } },
    { name: 'nested sponsored-content state', feature: { sponsoredContent: { status: 'paused' } } },
    { name: 'nested sponsorship flag', feature: { sponsorship: { enabled: false } } },
    { name: 'conflicting status aliases', feature: { status: 'active', featureStatus: 'paused' } },
    { name: 'conflicting sponsored status aliases', feature: { sponsoredStatus: 'active', campaignStatus: 'expired' } },
    { name: 'disabled response envelope', feature: {}, envelope: { active: false } },
    { name: 'paused response envelope', feature: {}, envelope: { status: 'paused' } },
  ];

  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date(now)); });
  afterEach(() => { jest.useRealTimers(); });

  test.each(inactiveCases)('$name overrides active:true for Feature and Combo placements', ({ feature, envelope }) => {
    for (const relation of [{}, { linkedSponsoredArticleId: 'paid-id', linkedArticleSlug: `paid-${lang}` }]) {
      expect(normalizeHomepageSponsoredFeature({
        ...envelope, feature: { ...candidate, ...relation, ...feature },
      }, lang)).toBeNull();
    }
  });

  test('active Feature and Combo keep their destinations within the existing date window', () => {
    const feature = { ...candidate, status: 'active', startAt: '2026-10-19T12:00:00.000Z', endAt: '2026-10-21T12:00:00.000Z' };
    expect(normalizeHomepageSponsoredFeature({ feature }, lang)?.href).toBe(candidate.destinationUrl);
    expect(normalizeHomepageSponsoredFeature({
      feature: { ...feature, linkedSponsoredArticleId: 'paid-id', linkedArticleSlug: `paid-${lang}` },
    }, lang)?.href).toBe(`${lang === 'en' ? '' : `/${lang}`}/news/paid-${lang}`);
  });

  test('preserves inclusive start and end boundaries', () => {
    expect(normalizeHomepageSponsoredFeature({
      feature: { ...candidate, startAt: now, endAt: now },
    }, lang)).not.toBeNull();
  });

  test('does not mistake an article-kind flag for Feature campaign eligibility', () => {
    expect(normalizeHomepageSponsoredFeature({
      feature: { ...candidate, isSponsoredArticle: false },
    }, lang)).not.toBeNull();
  });

  test('keeps the existing missing-activity fallback without inventing campaign dates', () => {
    expect(normalizeHomepageSponsoredFeature({
      feature: { ...candidate, active: undefined },
    }, lang)).not.toBeNull();
  });
});

describe('publicSponsoredFeature', () => {
  test('prefers a linked sponsored article route over a direct destination url', () => {
    const feature = normalizeHomepageSponsoredFeature(
      {
        active: true,
        sponsorName: 'Acme Brand',
        headline: 'Acme launches a new clean-energy initiative',
        shortSummary: 'A short premium summary for the homepage sponsored-content module.',
        ctaLabel: 'Read more',
        imageSrc: 'https://res.cloudinary.com/demo/image/upload/acme-feature.jpg',
        destinationUrl: 'https://brand.example.com/landing',
        linkedArticle: {
          _id: 'article-123',
          slug: 'acme-clean-energy',
          summary: 'Linked sponsored article summary should take priority.',
          sponsoredContent: {
            isSponsored: true,
            sponsorName: 'Acme Brand',
          },
        },
      },
      'en'
    );

    expect(feature).not.toBeNull();
    expect(feature?.href).toBe('/news/acme-clean-energy');
    expect(feature?.destinationIsExternal).toBe(false);
    expect(feature?.linkedArticleId).toBe('article-123');
    expect(feature?.linkedArticleSlug).toBe('acme-clean-energy');
    expect(feature?.shortSummary).toBe('Linked sponsored article summary should take priority.');
  });

  test('uses a direct destination url when no linked sponsored article exists', () => {
    const feature = normalizeHomepageSponsoredFeature(
      {
        active: true,
        sponsorName: 'Acme Brand',
        headline: 'Acme launches a new clean-energy initiative',
        shortSummary: 'A short premium summary for the homepage sponsored-content module.',
        ctaLabel: 'Visit sponsor',
        imageSrc: 'https://res.cloudinary.com/demo/image/upload/acme-feature.jpg',
        destinationUrl: 'https://brand.example.com/landing',
      },
      'en'
    );

    expect(feature).not.toBeNull();
    expect(feature?.href).toBe('https://brand.example.com/landing');
    expect(feature?.destinationIsExternal).toBe(true);
    expect(feature?.linkedArticleId).toBeNull();
    expect(feature?.linkedSponsoredArticleId).toBeNull();
    expect(feature?.linkedArticleSlug).toBeNull();
    expect(feature?.linkedArticleUrl).toBeNull();
    expect(feature?.destinationUrl).toBe('https://brand.example.com/landing');
  });

  test('normalizes homepage sponsored feature props into JSON-safe nulls', () => {
    const normalized = normalizeHomepageSponsoredFeatureProps({
      sponsorName: 'Acme Brand',
      headline: 'Acme launches a new clean-energy initiative',
      shortSummary: 'A short premium summary for the homepage sponsored-content module.',
      ctaLabel: 'Visit sponsor',
      ctaText: null,
      imageSrc: 'https://res.cloudinary.com/demo/image/upload/acme-feature.jpg',
      coverImage: null,
      href: 'https://brand.example.com/landing',
      destinationUrl: null,
      destinationIsExternal: true,
      sponsorDisclosure: 'Paid for by Acme Brand.',
      linkedArticleId: undefined as unknown as null,
      linkedSponsoredArticleId: undefined as unknown as null,
      linkedArticleSlug: undefined as unknown as null,
      linkedArticleUrl: undefined as unknown as null,
    });

    expect(normalized).toEqual({
      sponsorName: 'Acme Brand',
      headline: 'Acme launches a new clean-energy initiative',
      shortSummary: 'A short premium summary for the homepage sponsored-content module.',
      ctaLabel: 'Visit sponsor',
      ctaText: 'Visit sponsor',
      imageSrc: 'https://res.cloudinary.com/demo/image/upload/acme-feature.jpg',
      coverImage: 'https://res.cloudinary.com/demo/image/upload/acme-feature.jpg',
      href: 'https://brand.example.com/landing',
      destinationUrl: null,
      destinationIsExternal: true,
      sponsorDisclosure: 'Paid for by Acme Brand.',
      linkedArticleId: null,
      linkedSponsoredArticleId: null,
      linkedArticleSlug: null,
      linkedArticleUrl: null,
    });
  });

  test('returns null when the sponsored feature is inactive or incomplete', () => {
    expect(
      normalizeHomepageSponsoredFeature(
        {
          active: false,
          sponsorName: 'Acme Brand',
          headline: 'Inactive campaign',
          shortSummary: 'Should not render.',
          ctaLabel: 'Read more',
          imageSrc: 'https://res.cloudinary.com/demo/image/upload/acme-feature.jpg',
          destinationUrl: 'https://brand.example.com/landing',
        },
        'en'
      )
    ).toBeNull();

    expect(
      normalizeHomepageSponsoredFeature(
        {
          active: true,
          sponsorName: 'Acme Brand',
          headline: 'Missing summary',
          ctaLabel: 'Read more',
          imageSrc: 'https://cdn.example.com/acme-feature.jpg',
          destinationUrl: 'https://brand.example.com/landing',
        },
        'en'
      )
    ).toBeNull();
  });

  test('returns null when the sponsored image host is unsupported', () => {
    const feature = normalizeHomepageSponsoredFeature(
      {
        active: true,
        sponsorName: 'Acme Brand',
        headline: 'Acme launches a new clean-energy initiative',
        shortSummary: 'A short premium summary for the homepage sponsored-content module.',
        ctaLabel: 'Visit sponsor',
        imageSrc: 'https://unsupported.example.com/acme-feature.jpg',
        destinationUrl: 'https://brand.example.com/landing',
      },
      'en'
    );

    expect(feature).toBeNull();
  });

  test('returns null when normalized sponsored feature props are incomplete', () => {
    expect(
      normalizeHomepageSponsoredFeatureProps({
        sponsorName: 'Acme Brand',
        headline: 'Acme launches a new clean-energy initiative',
        shortSummary: 'A short premium summary for the homepage sponsored-content module.',
        ctaLabel: 'Visit sponsor',
        ctaText: 'Visit sponsor',
        imageSrc: '',
        coverImage: null,
        href: 'https://brand.example.com/landing',
        destinationUrl: null,
        destinationIsExternal: true,
        sponsorDisclosure: 'Paid for by Acme Brand.',
        linkedArticleId: null,
        linkedSponsoredArticleId: null,
        linkedArticleSlug: null,
        linkedArticleUrl: null,
      })
    ).toBeNull();
  });

  test('keeps fluidmechpumps uploads images as valid sponsored feature images', () => {
    const feature = normalizeHomepageSponsoredFeature(
      {
        active: true,
        sponsorName: 'Acme Brand',
        headline: 'Acme launches a new clean-energy initiative',
        shortSummary: 'A short premium summary for the homepage sponsored-content module.',
        ctaLabel: 'Visit sponsor',
        imageSrc: 'https://fluidmechpumps.com/wp-content/uploads/2024/03/CENTRIFUGAL-POLYPROPYLENE-PUMP.jpg',
        destinationUrl: 'https://brand.example.com/landing',
      },
      'en'
    );

    expect(feature).not.toBeNull();
    expect(feature?.imageSrc).toBe('https://fluidmechpumps.com/wp-content/uploads/2024/03/CENTRIFUGAL-POLYPROPYLENE-PUMP.jpg');
  });
});