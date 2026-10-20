import { isSponsoredContent, resolveSponsoredContentMeta } from '../../lib/sponsoredContent';

describe.each(['en', 'hi', 'gu'] as const)('%s campaign safety', (lang) => {
  const story = {
    _id: 'paid-id', slug: `paid-${lang}`, language: lang, status: 'published',
    isSponsoredArticle: true, sponsorName: 'Fixture Sponsor', sponsorDisclosure: 'Paid fixture disclosure.',
    sponsorDestinationUrl: 'https://sponsor.test/information', sponsorCtaText: 'Visit fixture sponsor',
  };
  const inactiveCases = [
    { campaignStatus: 'paused' },
    { campaignStatus: 'expired' },
    { campaignStatus: 'scheduled' },
    { sponsoredEndAt: '2026-10-19T12:00:00.000Z' },
    { sponsoredStartAt: '2026-10-21T12:00:00.000Z' },
    { sponsoredFeatureActive: false },
    { sponsoredFeatureActive: 0 },
    { sponsoredStatus: 'active', campaignStatus: 'paused' },
    {
      sponsorFeatureLinkedId: 'feature-id',
      linkedSponsoredFeature: {
        id: 'feature-id', linkedArticleId: 'paid-id', status: 'paused',
        ctaText: 'Visit linked sponsor', destinationUrl: 'https://sponsor.test/linked',
      },
    },
    { sponsoredContent: { status: 'paused' } },
    { sponsorship: { enabled: false } },
  ];

  beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(new Date('2026-10-20T12:00:00.000Z')); });
  afterEach(() => { jest.useRealTimers(); });

  test.each(inactiveCases)('retains paid identity and disclosure but no promotion for inactive metadata %#', (state) => {
    const record = { ...story, ...state };
    const meta = resolveSponsoredContentMeta(record, lang);
    expect(isSponsoredContent(record)).toBe(true);
    expect(meta.isArticle).toBe(true);
    expect(meta.sponsorName).toBe(story.sponsorName);
    expect(meta.sponsorDisclosure).toBe(story.sponsorDisclosure);
    expect(meta.isActive).toBe(false);
    expect(meta.isFeatureActive).toBe(false);
    expect(meta.sponsorDestinationHref).toBe('');
    expect(meta.sponsorCtaLabel).toBe('');
  });

  test('keeps the active article sponsor CTA unchanged', () => {
    const meta = resolveSponsoredContentMeta({ ...story, campaignStatus: 'active' }, lang);
    expect(meta.isArticle).toBe(true);
    expect(meta.isActive).toBe(true);
    expect(meta.sponsorDestinationHref).toBe(story.sponsorDestinationUrl);
    expect(meta.sponsorCtaLabel).toBe(story.sponsorCtaText);
  });

  test('retains the existing default disclosure after expiry without inventing a sponsor name', () => {
    const meta = resolveSponsoredContentMeta({
      _id: 'paid-id', slug: `paid-${lang}`, isSponsoredArticle: true, campaignStatus: 'expired',
    }, lang);
    expect(meta.isArticle).toBe(true);
    expect(meta.sponsorName).toBe('');
    expect(meta.sponsorDisclosure).toBe('This story is presented as sponsored content.');
  });

  test('does not classify ordinary text as durable paid identity', () => {
    const record = {
      _id: 'ordinary', slug: 'ordinary', status: 'published', language: lang,
      tags: ['sponsored'], campaignStatus: 'expired',
    };
    const meta = resolveSponsoredContentMeta(record, lang);
    expect(isSponsoredContent(record)).toBe(false);
    expect(meta.isArticle).toBe(false);
    expect(meta.sponsorDisclosure).toBe('');
  });
});

describe('sponsoredContent', () => {
  test('uses article-level sponsor destination url for the disclosure CTA instead of an image url', () => {
    const meta = resolveSponsoredContentMeta(
      {
        _id: 'article-123',
        slug: 'sponsored-story',
        sponsoredArticle: true,
        sponsorName: 'Fluidmech',
        sponsorCtaText: 'Explore Fluidmac Pumps',
        sponsorDestinationUrl: 'https://fluidmechpumps.com/',
        sponsorCallToAction: {
          url: 'https://fluidmechpumps.com/wp-content/uploads/2024/03/HORIZONTAL-SIDE-SUCTION-PUMP.jpg',
        },
      },
      'en'
    );

    expect(meta.sponsorDestinationHref).toBe('https://fluidmechpumps.com/');
    expect(meta.sponsorCtaLabel).toBe('Explore Fluidmac Pumps');
  });

  test('falls back to linked sponsored feature destination when article sponsor target resolves to an image', () => {
    const meta = resolveSponsoredContentMeta(
      {
        _id: 'article-123',
        slug: 'sponsored-story',
        sourceNewsId: 'news-123',
        sponsoredArticle: true,
        sponsorName: 'Fluidmech',
        sponsorCtaText: 'Explore Fluidmac Pumps',
        sponsorDestinationUrl: 'https://fluidmechpumps.com/wp-content/uploads/2024/03/HORIZONTAL-SIDE-SUCTION-PUMP.jpg',
        sponsorFeatureLinkedId: 'feature-9',
        linkedSponsoredFeature: {
          id: 'feature-9',
          linkedArticleId: 'news-123',
          linkedArticleSlug: 'sponsored-story',
          ctaText: 'Explore Fluidmac Pumps',
          url: 'https://fluidmechpumps.com/wp-content/uploads/2024/03/HORIZONTAL-SIDE-SUCTION-PUMP.jpg',
          destinationUrl: 'https://fluidmechpumps.com/',
        },
      },
      'en'
    );

    expect(meta.sponsorDestinationHref).toBe('https://fluidmechpumps.com/');
    expect(meta.sponsorCtaLabel).toBe('Explore Fluidmac Pumps');
  });

  test('hides the disclosure CTA when the only resolved sponsor target is an image url', () => {
    const meta = resolveSponsoredContentMeta(
      {
        _id: 'article-123',
        slug: 'sponsored-story',
        sponsoredArticle: true,
        sponsorName: 'Fluidmech',
        sponsorCtaText: 'Explore Fluidmac Pumps',
        sponsorDestinationUrl: 'https://fluidmechpumps.com/wp-content/uploads/2024/03/HORIZONTAL-SIDE-SUCTION-PUMP.jpg',
      },
      'en'
    );

    expect(meta.sponsorDestinationHref).toBe('');
    expect(meta.sponsorCtaLabel).toBe('');
  });

  test('keeps article disclosure-only when no article CTA and no real linked feature exist', () => {
    const meta = resolveSponsoredContentMeta(
      {
        _id: 'article-123',
        slug: 'sponsored-story',
        sponsoredArticle: true,
        sponsorName: 'Acme Pumps',
        ctaLabel: 'Read sponsored story',
        destinationUrl: 'https://acme.example.com/products',
      },
      'en'
    );

    expect(meta.destinationHref).toBe('/news/sponsored-story');
    expect(meta.ctaLabel).toBe('Read sponsored story');
    expect(meta.sponsorDestinationHref).toBe('');
    expect(meta.sponsorCtaLabel).toBe('');
  });

  test('hides article disclosure CTA when no sponsor destination exists', () => {
    const meta = resolveSponsoredContentMeta(
      {
        _id: 'article-123',
        slug: 'sponsored-story',
        sponsoredArticle: true,
        sponsorName: 'Acme Brand',
      },
      'en'
    );

    expect(meta.destinationHref).toBe('/news/sponsored-story');
    expect(meta.sponsorDestinationHref).toBe('');
    expect(meta.sponsorCtaLabel).toBe('');
  });

  test('uses article-level sponsor CTA fields when they exist without a linked feature', () => {
    const meta = resolveSponsoredContentMeta(
      {
        _id: 'article-123',
        slug: 'sponsored-story',
        sponsoredArticle: true,
        sponsorName: 'Acme Brand',
        sponsorCtaText: 'Official website',
        sponsorCtaUrl: 'https://acme.example.com',
      },
      'en'
    );

    expect(meta.sponsorDestinationHref).toBe('https://acme.example.com');
    expect(meta.sponsorCtaLabel).toBe('Official website');
  });

  test('prefers article-level sponsor CTA over linked feature CTA when both exist', () => {
    const meta = resolveSponsoredContentMeta(
      {
        _id: 'article-123',
        slug: 'sponsored-story',
        sourceNewsId: 'news-123',
        sponsoredArticle: true,
        sponsorName: 'Acme Brand',
        sponsorFeatureLinkedId: 'feature-9',
        sponsorCtaText: 'Visit article sponsor page',
        sponsorCtaUrl: 'https://acme.example.com/article',
        linkedSponsoredFeature: {
          id: 'feature-9',
          linkedArticleId: 'news-123',
          linkedArticleSlug: 'sponsored-story',
          ctaText: 'Visit feature page',
          destinationUrl: 'https://acme.example.com/feature',
        },
      },
      'en'
    );

    expect(meta.sponsorDestinationHref).toBe('https://acme.example.com/article');
    expect(meta.sponsorCtaLabel).toBe('Visit article sponsor page');
  });

  test('does not inherit sponsored feature promo CTA when no linked feature relation exists', () => {
    const meta = resolveSponsoredContentMeta(
      {
        _id: 'article-123',
        slug: 'sponsored-story',
        sponsoredArticle: true,
        sponsorName: 'Acme Brand',
        sponsoredFeature: {
          ctaLabel: 'Learn more',
          destinationUrl: 'https://acme.example.com/promo',
        },
      },
      'en'
    );

    expect(meta.destinationHref).toBe('/news/sponsored-story');
    expect(meta.sponsorDestinationHref).toBe('');
    expect(meta.sponsorCtaLabel).toBe('');
  });

  test('does not inherit linked feature CTA when the feature points to a different article', () => {
    const meta = resolveSponsoredContentMeta(
      {
        _id: 'article-123',
        slug: 'sponsored-story',
        sourceNewsId: 'news-123',
        sponsoredArticle: true,
        sponsorName: 'Acme Brand',
        linkedSponsoredFeature: {
          id: 'feature-9',
          linkedArticleId: 'news-999',
          linkedArticleSlug: 'another-story',
          ctaText: 'Visit feature page',
          destinationUrl: 'https://acme.example.com/feature',
        },
      },
      'en'
    );

    expect(meta.sponsorDestinationHref).toBe('');
    expect(meta.sponsorCtaLabel).toBe('');
  });

  test('inherits linked feature CTA only when the feature really links back to the current article', () => {
    const meta = resolveSponsoredContentMeta(
      {
        _id: 'article-123',
        slug: 'sponsored-story',
        sourceNewsId: 'news-123',
        sponsoredArticle: true,
        sponsorName: 'Acme Brand',
        linkedSponsoredFeature: {
          id: 'feature-9',
          linkedArticleId: 'news-123',
          linkedArticleSlug: 'sponsored-story',
          ctaText: 'Visit feature page',
          destinationUrl: 'https://acme.example.com/feature',
        },
      },
      'en'
    );

    expect(meta.sponsorDestinationHref).toBe('https://acme.example.com/feature');
    expect(meta.sponsorCtaLabel).toBe('Visit feature page');
  });

  test('does not inherit linked feature CTA when sponsorFeatureLinkedId points to a different feature', () => {
    const meta = resolveSponsoredContentMeta(
      {
        _id: 'article-123',
        slug: 'sponsored-story',
        sourceNewsId: 'news-123',
        sponsoredArticle: true,
        sponsorName: 'Acme Brand',
        sponsorFeatureLinkedId: 'feature-11',
        linkedSponsoredFeature: {
          id: 'feature-9',
          linkedArticleId: 'news-123',
          linkedArticleSlug: 'sponsored-story',
          ctaText: 'Visit feature page',
          destinationUrl: 'https://acme.example.com/feature',
        },
      },
      'en'
    );

    expect(meta.sponsorDestinationHref).toBe('');
    expect(meta.sponsorCtaLabel).toBe('');
  });
});