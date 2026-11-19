import { buildArticleSeoMetadata, getArticleAlternates, getArticleCanonicalUrl, getArticleSocialImageSources, isEligibleForNewsSitemap, isIndexablePublishedArticle } from '../../lib/seo';
import { buildSocialImageUrl } from '../../lib/articleSocialImage';

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
  test.each(['en', 'hi', 'gu'] as const)('uses a name-only author Person on %s articles and preserves the publisher exactly', (lang) => {
    const localizedArticle = { ...article, language: lang };
    const baseline = buildArticleSeoMetadata(localizedArticle, lang, 'https://www.newspulse.co.in');
    const seo = buildArticleSeoMetadata({ ...localizedArticle, authorByline: {
      enabled: true,
      snapshot: {
        name: 'Shailesh Rathod', publicDesignation: 'Independent Writer', photoUrl: '/uploads/author.jpg',
        shortBio: 'Public author biography.', email: 'private@example.com', internalNotes: 'Private note',
      },
    } }, lang, 'https://www.newspulse.co.in');
    expect(seo?.authorName).toBe('Shailesh Rathod');
    expect(seo?.newsArticleJsonLd?.author).toStrictEqual({ '@type': 'Person', name: 'Shailesh Rathod' });
    expect(seo?.newsArticleJsonLd?.publisher).toStrictEqual(baseline?.newsArticleJsonLd?.publisher);
    expect((seo?.newsArticleJsonLd?.publisher as any)?.name).toBe('News Pulse Media');
    expect(JSON.stringify(seo)).not.toMatch(/author.jpg|Public author biography|Independent Writer|private@example.com|Private note/);
  });

  test.each([
    undefined, null, {}, { name: 'Wrong flat name' },
    { enabled: false, snapshot: { name: 'Hidden author' } },
    { enabled: 'true', snapshot: { name: 'Hidden author' } },
    { enabled: true, snapshot: { name: '   ' } },
    { enabled: true, snapshot: { name: 123 } },
  ])('keeps legacy SEO unchanged for absent, disabled or invalid author %p', (authorByline) => {
    expect(buildArticleSeoMetadata({ ...article, authorByline }, 'en', 'https://www.newspulse.co.in'))
      .toStrictEqual(buildArticleSeoMetadata(article, 'en', 'https://www.newspulse.co.in'));
  });

  test('preserves the exact supplied name in SEO', () => {
    const name = ' Shailesh  Rathod ';
    const seo = buildArticleSeoMetadata({ ...article, authorByline: { enabled: true, snapshot: { name } } }, 'en', 'https://www.newspulse.co.in');
    expect(seo?.authorName).toBe(name);
    expect(seo?.newsArticleJsonLd?.author).toStrictEqual({ '@type': 'Person', name });
  });

  test.each([undefined, { bylineSnapshot: { name: 'Public Contributor', photoUrl: '/contributors/public.jpg' } }])('ignores author byline metadata for Pulse Dialogue SEO (%p)', (pulseDialogue) => {
    const pulseArticle = { ...article, category: 'pulse-dialogue', pulseDialogue };
    expect(buildArticleSeoMetadata({ ...pulseArticle, authorByline: { enabled: true, snapshot: { name: 'Wrong author' } } }, 'en', 'https://www.newspulse.co.in'))
      .toStrictEqual(buildArticleSeoMetadata(pulseArticle, 'en', 'https://www.newspulse.co.in'));
  });

  test('published article renders title, description, canonical, Open Graph, Twitter and NewsArticle JSON-LD values', () => {
    const seo = buildArticleSeoMetadata(article, 'en', 'https://www.newspulse.co.in');

    expect(seo?.title).toBe('Explicit SEO Title');
    expect(seo?.description).toBe('Explicit SEO description from admin.');
    expect(seo?.canonicalUrl).toBe('https://www.newspulse.co.in/news/real-english-headline');
    expect(seo?.robots).toContain('index');
    expect(seo?.ogTitle).toBe('Explicit OG Title');
    expect(seo?.ogUrl).toBe(seo?.canonicalUrl);
    expect(seo?.ogImage).toBe('https://www.newspulse.co.in/brand/news-pulse-social.jpg');
    expect(seo?.twitterTitle).toBe('Explicit OG Title');
    expect(seo?.twitterImage).toBe(seo?.ogImage);
    expect(seo?.newsArticleJsonLd?.['@type']).toBe('NewsArticle');
    expect(seo?.newsArticleJsonLd?.headline).toBe('Explicit SEO Title');
    expect(seo?.newsArticleJsonLd?.datePublished).toBe('2026-08-01T10:00:00.000Z');
    expect((seo?.newsArticleJsonLd?.publisher as any)?.name).toBe('News Pulse Media');
  });

  test('Pulse Dialogue SEO uses the public contributor as Person author while publisher remains News Pulse', () => {
    const seo = buildArticleSeoMetadata({
      ...article,
      category: 'pulse-dialogue',
      authorName: 'News Pulse Desk User',
      pulseDialogue: {
        dialogueFormat: 'guest_column',
        bylineSnapshot: {
          name: 'Dr Asha Mehta',
          designation: 'Urban Planner',
          affiliation: 'Civic Futures',
          photo: { url: '/contributors/asha.jpg', alt: 'Dr Asha Mehta portrait' },
        },
        contributor: {
          name: 'Current Contributor',
          internalEmail: 'private@example.com',
          internalNotes: 'Private note',
          rightsConsent: true,
        },
      },
    } as any, 'en', 'https://www.newspulse.co.in');

    const author = seo?.newsArticleJsonLd?.author as any;

    expect(seo?.authorName).toBe('Dr Asha Mehta');
    expect(author).toEqual(expect.objectContaining({
      '@type': 'Person',
      name: 'Dr Asha Mehta',
      image: 'https://www.newspulse.co.in/contributors/asha.jpg',
      affiliation: { '@type': 'Organization', name: 'Civic Futures' },
    }));
    expect((seo?.newsArticleJsonLd?.publisher as any)?.name).toBe('News Pulse Media');
    const serialized = JSON.stringify(seo?.newsArticleJsonLd);
    expect(serialized).not.toContain('News Pulse Desk User');
    expect(serialized).not.toContain('private@example.com');
    expect(serialized).not.toContain('Private note');
    expect(serialized).not.toContain('rightsConsent');
  });

  test('language canonical URLs are correct and hreflang appears only for existing translations', () => {
    expect(getArticleCanonicalUrl(article, 'hi', 'https://www.newspulse.co.in')).toBe('https://www.newspulse.co.in/hi/news/hindi-real-headline');
    expect(getArticleCanonicalUrl({ ...article, seo: { canonicalUrl: 'https://www.newspulse.co.in/news/global-canonical' } }, 'hi', 'https://www.newspulse.co.in')).toBe('https://www.newspulse.co.in/hi/news/hindi-real-headline');
    const alternates = getArticleAlternates(article, 'https://www.newspulse.co.in');

    expect(alternates.map((item) => item.hrefLang)).toEqual(['en', 'hi', 'x-default']);
    expect(alternates.find((item) => item.hrefLang === 'gu')).toBeUndefined();
  });

  test('localized SEO never inherits the source edition text or its stored canonical', () => {
    const stored = { ...article, seo: { ...article.seo, canonicalUrl: 'https://www.newspulse.co.in/gu/news/source-story' } };
    const before = JSON.stringify(stored);
    const translated = buildArticleSeoMetadata(stored, 'hi', 'https://www.newspulse.co.in');
    expect(translated?.ogTitle).toBe(article.translations.hi.title);
    expect(translated?.ogDescription).toBe(article.translations.hi.summary);
    expect(translated?.ogUrl).toBe('https://www.newspulse.co.in/hi/news/hindi-real-headline');
    expect(getArticleCanonicalUrl(stored, 'en', 'https://www.newspulse.co.in')).toBe('https://www.newspulse.co.in/news/real-english-headline');
    expect(JSON.stringify(stored)).toBe(before);
    const cached = { ...stored, language: 'hi', originalLang: 'en', isTranslated: true, translations: undefined,
      title: article.translations.hi.title, summary: article.translations.hi.summary, slug: 'hindi-real-headline' };
    expect(buildArticleSeoMetadata(cached, 'hi', 'https://www.newspulse.co.in')?.ogTitle).toBe(cached.title);
  });

  test.each([
    { coverImageUrl: null },
    { coverImageUrl: '/uploads/old.jpg', coverImage: { removed: true } },
    { coverImageUrl: 'javascript:alert(1)' },
  ])('uses the verified official image when a cover is absent, removed or unusable (%p)', cover => {
    const seo = buildArticleSeoMetadata({ ...article, ...cover }, 'en', 'https://www.newspulse.co.in');
    expect(seo?.ogImage).toBe('https://www.newspulse.co.in/brand/news-pulse-social.jpg');
    expect(seo?.twitterImage).toBe(seo?.ogImage);
  });

  test('draft, deleted and old records are excluded from sitemap eligibility', () => {
    expect(isIndexablePublishedArticle(article, new Date('2026-08-02T00:00:00.000Z'))).toBe(true);
    expect(isIndexablePublishedArticle({ ...article, status: 'draft' }, new Date('2026-08-02T00:00:00.000Z'))).toBe(false);
    expect(isIndexablePublishedArticle({ ...article, deleted: true }, new Date('2026-08-02T00:00:00.000Z'))).toBe(false);
    expect(isEligibleForNewsSitemap(article, new Date('2026-08-02T00:00:00.000Z'))).toBe(true);
    expect(isEligibleForNewsSitemap({ ...article, publishedAt: '2026-07-20T00:00:00.000Z' }, new Date('2026-08-02T00:00:00.000Z'))).toBe(false);
  });

  test.each([
    ['en', 'national', 'English headline', 'English summary', 'en_IN'],
    ['hi', 'sports', 'हिंदी शीर्षक', 'हिंदी विवरण', 'hi_IN'],
    ['gu', 'faith-culture', 'ગુજરાતી શીર્ષક', 'ગુજરાતી સારાંશ', 'gu_IN'],
  ] as const)('uses verified image properties and edition-owned overrides for %s / %s', (lang, category, title, summary, ogLocale) => {
    const source = 'https://res.cloudinary.com/fixture/image/upload/v1/news/edition.png';
    const socialImage = { source, url: buildSocialImageUrl(source, 75), type: 'image/jpeg', width: 1200, height: 630, bytes: 100_000 };
    const slug = { en: 'english-headline', hi: 'हिंदी-शीर्षक', gu: 'ગુજરાતી-શીર્ષક' }[lang];
    const story = {
      ...article, language: lang, originalLang: 'en', isTranslated: lang !== 'en', category,
      resolvedLanguage: lang, canonicalSlug: slug, slugs: { [lang]: slug }, slug,
      title, summary, translations: undefined, coverImageUrl: source, socialImage,
      seo: { ogTitle: 'Wrong unscoped title', ogDescription: 'Wrong unscoped description', [lang]: { ogTitle: title, ogDescription: summary } },
      openGraph: { [lang]: { ogImageAlt: title } },
    };
    const seo = buildArticleSeoMetadata(story, lang, 'https://www.newspulse.co.in');
    expect(seo).toMatchObject({
      ogTitle: title, ogDescription: summary, ogLocale, ogImage: socialImage.url,
      ogImageWidth: 1200, ogImageHeight: 630, ogImageType: 'image/jpeg', ogImageAlt: title,
      twitterTitle: title, twitterDescription: summary, twitterImage: socialImage.url, twitterImageAlt: title,
    });
    expect(seo?.ogUrl).toBe(seo?.canonicalUrl);
    expect(seo?.publishedAt).toBe(article.publishedAt);
    expect(seo?.ogUrl).toContain(`${lang === 'en' ? '' : `/${lang}`}/news/`);
  });

  test('preserves edition-specific OG images without borrowing another edition graphic or resurrecting removed covers', () => {
    const cover = 'https://res.cloudinary.com/fixture/image/upload/v1/cover.jpg';
    const editorial = 'https://res.cloudinary.com/fixture/image/upload/v1/hindi.jpg';
    const otherEdition = 'https://res.cloudinary.com/fixture/image/upload/v1/gujarati.jpg';
    const story = {
      ...article, coverImageUrl: cover, image: cover, url: 'https://www.newspulse.co.in/news/story',
      translations: {
        ...article.translations,
        hi: { ...article.translations.hi, image: cover, coverImage: { removed: true } },
        gu: { image: otherEdition },
      },
    };
    expect(getArticleSocialImageSources(story, 'hi')).toEqual([]);
    expect(getArticleSocialImageSources({ ...story, seo: { hi: { image: editorial } } }, 'hi')).toEqual([editorial]);
    expect(getArticleSocialImageSources({ ...story, coverImageUrl: undefined, image: undefined, translations: { gu: { image: otherEdition } } }, 'en')).toEqual([]);
    expect(getArticleSocialImageSources({ ...article, coverImageUrl: cover, seo: { ogImage: '/brand/news-pulse-final-logo.png' } }, 'en'))
      .toEqual(['/brand/news-pulse-social.jpg']);
  });

  test('replaced or removed covers cannot keep a stale verified preview', () => {
    const source = 'https://res.cloudinary.com/fixture/image/upload/v1/old.jpg';
    const socialImage = { source, url: buildSocialImageUrl(source, 75), type: 'image/jpeg', width: 1200, height: 630, bytes: 50_000 };
    for (const change of [{ coverImageUrl: source.replace('/v1/', '/v2/') }, { coverImage: { removed: true } }]) {
      const seo = buildArticleSeoMetadata({ ...article, coverImageUrl: source, socialImage, ...change }, 'en', 'https://www.newspulse.co.in');
      expect(seo?.ogImage).toBe('https://www.newspulse.co.in/brand/news-pulse-social.jpg');
    }
  });

  test('keeps Unicode intact when shortening descriptions and uses the localized headline for an empty body', () => {
    const seo = buildArticleSeoMetadata({ ...article, seo: {}, summary: `${'a'.repeat(178)}😀 tail` }, 'en', 'https://www.newspulse.co.in');
    expect(seo?.description).toBe(`${'a'.repeat(178)}😀…`);
    const emptyBody = buildArticleSeoMetadata({
      ...article, seo: {}, summary: '', content: '<p>&nbsp;</p><script>private script</script>',
    }, 'en', 'https://www.newspulse.co.in');
    expect(emptyBody?.ogDescription).toBe(article.title);
  });
});