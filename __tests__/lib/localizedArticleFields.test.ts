import { getLocalizedArticleFields } from '../../lib/localizedArticleFields';

describe('getLocalizedArticleFields (English strictness)', () => {
  test('prefers explicit English localized fields over base when sourceLocale is en', () => {
    const article: any = {
      status: 'published',
      sourceLang: 'en',
      // Base fields are Gujarati due to backend issue.
      title: 'ગુજરાતી શીર્ષક',
      summary: 'ગુજરાતી સારાંશ',
      translations: {
        en: {
          status: 'APPROVED',
          title: 'English title',
          summary: 'English summary',
        },
      },
    };

    const localized = getLocalizedArticleFields(article, 'en');
    expect(localized.isVisible).toBe(true);
    expect(localized.title).toBe('English title');
    expect(localized.summary).toBe('English summary');
  });

  test('hides record on English route when other locales exist but English localized fields are missing', () => {
    const article: any = {
      status: 'published',
      sourceLang: 'en',
      title: 'ગુજરાતી શીર્ષક',
      translations: {
        gu: {
          status: 'APPROVED',
          title: 'ગુજરાતી શીર્ષક',
        },
      },
    };

    const localized = getLocalizedArticleFields(article, 'en');
    expect(localized.isVisible).toBe(false);
    expect(localized.title).toBe('');
  });

  test('still allows legacy English base-only records when no translation container exists', () => {
    const article: any = {
      status: 'published',
      sourceLang: 'en',
      title: 'Legacy English title',
      summary: 'Legacy English summary',
    };

    const localized = getLocalizedArticleFields(article, 'en');
    expect(localized.isVisible).toBe(true);
    expect(localized.title).toBe('Legacy English title');
    expect(localized.summary).toBe('Legacy English summary');
  });
});
