import { buildArticleSeoMetadata, getArticleAlternates, getArticleCanonicalUrl, isEligibleForNewsSitemap, isIndexablePublishedArticle } from '../../lib/seo';

const article = {
  _id: 'article-1',
  status: 'published',
  language: 'en',
  title: 'Real English headline',
  summary: 'Real English summary for search snippets.',
  content: '<p>Real article body.</p>',
  slug: 'real-english-headline',
  category: 'business',
  publishedAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T12:00:00.000Z',
  authorName: 'Reporter Name',
  coverImageUrl: '/uploads/real-image.jpg',
  seo: {
    metaTitle: 'Explicit SEO Title',
    metaDescription: 'Explicit SEO description from admin.',
    ogTitle: 'Explicit OG Title',
  },
  translations: {
    hi: {
      status: 'APPROVED',
      title: 'वास्तविक हिंदी शीर्षक',
      summary: 'हिंदी सारांश',
      content: '<p>हिंदी लेख</p>',
      slug: 'hindi-real-headline',
    },
  },
};

describe('public SEO helpers', () => {
  test('published article renders title, description, canonical, Open Graph, Twitter and NewsArticle JSON-LD values', () => {
    const seo = buildArticleSeoMetadata(article, 'en', 'https://www.newspulse.co.in');

    expect(seo?.title).toBe('Explicit SEO Title');
    expect(seo?.description).toBe('Explicit SEO description from admin.');
    expect(seo?.canonicalUrl).toBe('https://www.newspulse.co.in/news/real-english-headline');
    expect(seo?.robots).toContain('index');
    expect(seo?.ogTitle).toBe('Explicit OG Title');
    expect(seo?.ogUrl).toBe(seo?.canonicalUrl);
    expect(seo?.ogImage).toBe('https://www.newspulse.co.in/uploads/real-image.jpg');
    expect(seo?.twitterTitle).toBe('Explicit OG Title');
    expect(seo?.twitterImage).toBe(seo?.ogImage);
    expect(seo?.newsArticleJsonLd?.['@type']).toBe('NewsArticle');
    expect(seo?.newsArticleJsonLd?.headline).toBe('Explicit SEO Title');
    expect(seo?.newsArticleJsonLd?.datePublished).toBe('2026-08-01T10:00:00.000Z');
    expect((seo?.newsArticleJsonLd?.publisher as any)?.name).toBe('News Pulse Media');
  });

  test('language canonical URLs are correct and hreflang appears only for existing translations', () => {
    expect(getArticleCanonicalUrl(article, 'hi', 'https://www.newspulse.co.in')).toBe('https://www.newspulse.co.in/hi/news/hindi-real-headline');
    expect(getArticleCanonicalUrl({ ...article, seo: { canonicalUrl: 'https://www.newspulse.co.in/news/global-canonical' } }, 'hi', 'https://www.newspulse.co.in')).toBe('https://www.newspulse.co.in/hi/news/hindi-real-headline');
    const alternates = getArticleAlternates(article, 'https://www.newspulse.co.in');

    expect(alternates.map((item) => item.hrefLang)).toEqual(['en', 'hi', 'x-default']);
    expect(alternates.find((item) => item.hrefLang === 'gu')).toBeUndefined();
  });

  test('draft, deleted and old records are excluded from sitemap eligibility', () => {
    expect(isIndexablePublishedArticle(article, new Date('2026-08-02T00:00:00.000Z'))).toBe(true);
    expect(isIndexablePublishedArticle({ ...article, status: 'draft' }, new Date('2026-08-02T00:00:00.000Z'))).toBe(false);
    expect(isIndexablePublishedArticle({ ...article, deleted: true }, new Date('2026-08-02T00:00:00.000Z'))).toBe(false);
    expect(isEligibleForNewsSitemap(article, new Date('2026-08-02T00:00:00.000Z'))).toBe(true);
    expect(isEligibleForNewsSitemap({ ...article, publishedAt: '2026-07-20T00:00:00.000Z' }, new Date('2026-08-02T00:00:00.000Z'))).toBe(false);
  });
});