import {
  normalizeHomepageSponsoredFeature,
  normalizeHomepageSponsoredFeatureProps,
} from '../../lib/publicSponsoredFeature';

describe('publicSponsoredFeature', () => {
  test('prefers a linked sponsored article route over a direct destination url', () => {
    const feature = normalizeHomepageSponsoredFeature(
      {
        active: true,
        sponsorName: 'Acme Brand',
        headline: 'Acme launches a new clean-energy initiative',
        shortSummary: 'A short premium summary for the homepage sponsored-content module.',
        ctaLabel: 'Read more',
        imageSrc: 'https://cdn.example.com/acme-feature.jpg',
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
        imageSrc: 'https://cdn.example.com/acme-feature.jpg',
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
      imageSrc: 'https://cdn.example.com/acme-feature.jpg',
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
      imageSrc: 'https://cdn.example.com/acme-feature.jpg',
      coverImage: 'https://cdn.example.com/acme-feature.jpg',
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
          imageSrc: 'https://cdn.example.com/acme-feature.jpg',
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

  test('falls back to the safe placeholder when the sponsored image host is unsupported', () => {
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

    expect(feature).not.toBeNull();
    expect(feature?.imageSrc).toBe('/fallback.svg');
    expect(feature?.coverImage).toBe('/fallback.svg');
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