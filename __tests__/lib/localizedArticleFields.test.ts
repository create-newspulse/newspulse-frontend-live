import {
  filterPubliclyPublishedArticles,
  getLocalizedArticleFields,
  getLocalizedContent,
  getLocalizedSlug,
  getLocalizedSummary,
  STRICT_LOCALE_POLICY,
  getLocalizedTitle,
  isPubliclyPublishedArticle,
} from '../../lib/localizedArticleFields';

describe.each(['en', 'hi', 'gu'] as const)('strict translated fields (%s)', (locale) => {
  const base = {
    _id: 'approved-translation',
    status: 'published',
    language: locale,
    sourceLanguage: locale === 'gu' ? 'en' : 'gu',
    title: 'Source title',
    summary: 'Source summary',
    content: '<p>Source body</p>',
    slug: 'canonical-source-slug',
    category: 'faith-culture',
    translationStatus: { [locale]: 'APPROVED' },
  };

  test.each([
    {},
    { title: 'Localized title' },
    { content: '<p>Localized body</p>' },
    { title: ' \n ', content: '<p>Localized body</p>' },
    { title: 'Localized title', content: ' \n ' },
    { title: null, content: '<p>Localized body</p>' },
    { title: 'Localized title', content: null },
    { summary: 'Localized summary', slug: 'localized-slug' },
  ])('rejects APPROVED without both actual localized title and body: %j', (fields) => {
    const result = getLocalizedArticleFields({ ...base, translations: { [locale]: fields } }, locale, STRICT_LOCALE_POLICY);
    expect(result.isVisible).toBe(false);
    expect(result.isFallback).toBe(false);
    expect(result.title).toBe('');
    expect(result.summary).toBe('');
    expect(result.bodyHtml).toBe('');
  });

  test('accepts complete localized APPROVED fields without borrowing the source summary', () => {
    const article = { ...base, translations: { [locale]: { title: 'Localized title', content: '<p>Localized body</p>' } } };
    const result = getLocalizedArticleFields(article, locale, STRICT_LOCALE_POLICY);
    expect(result.isVisible).toBe(true);
    expect(result.isFallback).toBe(false);
    expect(result.title).toBe('Localized title');
    expect(result.bodyHtml).toBe('<p>Localized body</p>');
    expect(result.summary).toBe('');
    expect(result.slug).toBe(base.slug);
    expect(result.categoryLabel).toBe(base.category);
  });

  test('preserves existing non-strict fallback and standalone text helpers', () => {
    const article = { ...base, translations: { [locale]: { title: 'Localized title' } } };
    const result = getLocalizedArticleFields(article, locale);
    expect(result.isVisible).toBe(true);
    expect(result.title).toBe('Localized title');
    expect(result.summary).toBe(base.summary);
    expect(result.bodyHtml).toBe(base.content);
    expect(getLocalizedSummary(article, locale)).toBe(base.summary);
    expect(getLocalizedContent(article, locale)).toBe(base.content);
  });

  test('does not borrow another locale body to complete an APPROVED translation', () => {
    const article = {
      ...base,
      translations: {
        [base.sourceLanguage]: { title: 'Other locale title', content: '<p>Other locale body</p>' },
        [locale]: { title: 'Localized title' },
      },
    };
    expect(getLocalizedArticleFields(article, locale, STRICT_LOCALE_POLICY).isVisible).toBe(false);
  });
});

describe('localizedArticleFields', () => {
  test.each([undefined, '', 'unknown', 'fr'])('strict feeds do not assume English for missing/unsupported locale %s', (language) => {
    const article = {
      _id: 'unknown-locale', status: 'published', language,
      title: 'ગુજરાતી શીર્ષક', content: '<p>ગુજરાતી સામગ્રી</p>',
      translations: { en: true, hi: false, gu: true },
    };
    for (const locale of ['gu', 'hi', 'en']) {
      const selected = getLocalizedArticleFields(article, locale, STRICT_LOCALE_POLICY);
      expect(selected.sourceLocale).toBeNull();
      expect(selected.isVisible).toBe(false);
      expect(selected.translationFound).toBe(false);
      expect(selected.title).toBe('');
    }
  });

  test.each(['gu', 'hi', 'en'])('unknown source can still expose complete explicit %s content, not availability flags', (locale) => {
    const article = {
      _id: 'explicit-locale', status: 'published',
      title: 'Unidentified source title',
      translations: { [locale]: { title: 'Requested title', content: '<p>Requested body</p>', status: 'APPROVED' } },
    };
    expect(getLocalizedArticleFields(article, locale, STRICT_LOCALE_POLICY)).toMatchObject({
      isVisible: true, sourceLocale: null, title: 'Requested title', bodyHtml: '<p>Requested body</p>', summary: '',
    });
  });

  test('keeps published articles visible on Gujarati routes with base fallback', () => {
    const article: any = {
      _id: 'article-1',
      status: 'published',
      language: 'en',
      title: 'English title',
      summary: 'English summary',
      content: '<p>English body</p>',
      slug: 'english-title',
      category: 'Business',
    };

    const localized = getLocalizedArticleFields(article, 'gu');

    expect(localized.isVisible).toBe(true);
    expect(localized.isFallback).toBe(true);
    expect(localized.translationFound).toBe(false);
    expect(localized.title).toBe('English title');
    expect(localized.summary).toBe('English summary');
    expect(localized.bodyHtml).toBe('<p>English body</p>');
    expect(localized.slug).toBe('english-title');
    expect(getLocalizedTitle(article, 'gu')).toBe('English title');
    expect(getLocalizedSummary(article, 'gu')).toBe('English summary');
    expect(getLocalizedContent(article, 'gu')).toBe('<p>English body</p>');
    expect(getLocalizedSlug(article, 'gu')).toBe('english-title');
  });

  test('prefers Gujarati translation fields and localized slug when present', () => {
    const article: any = {
      _id: 'article-2',
      publishedAt: '2026-03-29T10:00:00.000Z',
      language: 'en',
      title: 'English title',
      summary: 'English summary',
      content: '<p>English body</p>',
      slug: 'english-title',
      translations: {
        gu: {
          title: 'ગુજરાતી શીર્ષક',
          summary: 'ગુજરાતી સારાંશ',
          content: '<p>ગુજરાતી બોડી</p>',
          slug: 'gujarati-title',
          categoryLabel: 'વ્યાપાર',
        },
      },
    };

    const localized = getLocalizedArticleFields(article, 'gu');

    expect(localized.isVisible).toBe(true);
    expect(localized.isFallback).toBe(false);
    expect(localized.translationFound).toBe(true);
    expect(localized.title).toBe('ગુજરાતી શીર્ષક');
    expect(localized.summary).toBe('ગુજરાતી સારાંશ');
    expect(localized.bodyHtml).toBe('<p>ગુજરાતી બોડી</p>');
    expect(localized.slug).toBe('gujarati-title');
    expect(localized.categoryLabel).toBe('વ્યાપાર');
  });

  test('reads locale-first object fields like slug.gu and title.gu', () => {
    const article: any = {
      _id: 'article-3',
      published: true,
      title: {
        gu: 'ઑબ્જેક્ટ શીર્ષક',
      },
      summary: {
        gu: 'ઑબ્જેક્ટ સારાંશ',
      },
      content: {
        gu: '<p>ઑબ્જેક્ટ બોડી</p>',
      },
      slug: {
        gu: 'object-slug-gu',
      },
    };

    expect(getLocalizedTitle(article, 'gu')).toBe('ઑબ્જેક્ટ શીર્ષક');
    expect(getLocalizedSummary(article, 'gu')).toBe('ઑબ્જેક્ટ સારાંશ');
    expect(getLocalizedContent(article, 'gu')).toBe('<p>ઑબ્જેક્ટ બોડી</p>');
    expect(getLocalizedSlug(article, 'gu')).toBe('object-slug-gu');
  });

  test('strict locale policy hides untranslated cross-locale stories', () => {
    const article: any = {
      _id: 'article-4',
      status: 'published',
      language: 'en',
      title: 'English title',
      summary: 'English summary',
      content: '<p>English body</p>',
      slug: 'english-title',
    };

    expect(getLocalizedArticleFields(article, 'hi', STRICT_LOCALE_POLICY).isVisible).toBe(false);
    expect(getLocalizedArticleFields(article, 'gu', STRICT_LOCALE_POLICY).isVisible).toBe(false);
    expect(getLocalizedArticleFields(article, 'en', STRICT_LOCALE_POLICY).isVisible).toBe(true);
  });

  test('strict locale policy allows approved locale variants', () => {
    const article: any = {
      _id: 'article-5',
      publishedAt: '2026-03-29T10:00:00.000Z',
      language: 'en',
      title: 'English title',
      summary: 'English summary',
      content: '<p>English body</p>',
      slug: 'english-title',
      translationStatus: {
        hi: 'APPROVED',
      },
      translations: {
        hi: {
          title: 'हिंदी शीर्षक',
          summary: 'हिंदी सारांश',
          content: '<p>हिंदी बॉडी</p>',
          slug: 'hindi-title',
        },
      },
    };

    const localized = getLocalizedArticleFields(article, 'hi', STRICT_LOCALE_POLICY);
    expect(localized.isVisible).toBe(true);
    expect(localized.slug).toBe('hindi-title');
    expect(localized.title).toBe('हिंदी शीर्षक');
  });

  test('hides drafts, scheduled, archived, deleted, and future-published articles from public visibility', () => {
    const baseArticle: any = {
      _id: 'editorial-public-contract',
      category: 'editorial',
      language: 'en',
      title: 'Public Editorial',
      content: '<p>Body</p>',
      slug: 'public-editorial',
    };

    expect(getLocalizedArticleFields({ ...baseArticle, status: 'published', publishedAt: '2026-01-01T10:00:00.000Z' }, 'en').isVisible).toBe(true);
    expect(getLocalizedArticleFields({ ...baseArticle, status: 'draft' }, 'en').isVisible).toBe(false);
    expect(getLocalizedArticleFields({ ...baseArticle, status: 'published', publishedAt: '2999-01-01T10:00:00.000Z' }, 'en').isVisible).toBe(false);
    expect(getLocalizedArticleFields({ ...baseArticle, status: 'archived', publishedAt: '2026-01-01T10:00:00.000Z' }, 'en').isVisible).toBe(false);
    expect(getLocalizedArticleFields({ ...baseArticle, archived: true, publishedAt: '2026-01-01T10:00:00.000Z' }, 'en').isVisible).toBe(false);
    expect(getLocalizedArticleFields({ ...baseArticle, deleted: true, publishedAt: '2026-01-01T10:00:00.000Z' }, 'en').isVisible).toBe(false);
  });

  test('exposes one canonical public-published predicate for collection filtering', () => {
    const published: any = { _id: 'published', status: 'published', publishedAt: '2026-01-01T10:00:00.000Z' };
    const draft: any = { _id: 'draft', status: 'draft', publishedAt: '2026-01-02T10:00:00.000Z' };

    expect(isPubliclyPublishedArticle(published)).toBe(true);
    expect(isPubliclyPublishedArticle(draft)).toBe(false);
    expect(filterPubliclyPublishedArticles([published, draft]).map((item) => item._id)).toEqual(['published']);
  });
});
