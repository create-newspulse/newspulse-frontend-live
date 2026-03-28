import {
  getLocalizedArticleFields,
  getLocalizedContent,
  getLocalizedSlug,
  getLocalizedSummary,
  getLocalizedTitle,
} from '../../lib/localizedArticleFields';

describe('localizedArticleFields', () => {
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
});