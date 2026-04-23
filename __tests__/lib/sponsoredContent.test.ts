import { resolveSponsoredContentMeta } from '../../lib/sponsoredContent';

describe('sponsoredContent', () => {
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