import {
  resolveArticleBodyHtml,
  resolveArticleSummaryOrExcerpt,
  resolveArticleTitle,
} from '../../lib/contentFallback';

describe('contentFallback resolvers', () => {
  test('prefers translations[lang] over top-level fields when status is missing', () => {
    const article: any = {
      title: 'ગુજરાતી શીર્ષક',
      summary: 'ગુજરાતી સારાંશ',
      content: '<p>ગુજરાતી બોડી</p>',
      translations: {
        hi: {
          title: 'हिंदी शीर्षक',
          summary: 'हिंदी सारांश',
          content: '<p>हिंदी बॉडी</p>',
        },
      },
    };

    expect(resolveArticleTitle(article, 'hi').text).toBe('हिंदी शीर्षक');
    expect(resolveArticleSummaryOrExcerpt(article, 'hi').text).toBe('हिंदी सारांश');
    expect(resolveArticleBodyHtml(article, 'hi').text).toBe('<p>हिंदी बॉडी</p>');
  });

  test('translationStatus as { [lang]: status } is respected (does not get misread as UNKNOWN)', () => {
    const article: any = {
      title: 'ગુજરાતી શીર્ષક',
      language: 'en',
      originalTitle: 'English title',
      translations: {
        hi: {
          title: 'हिंदी शीर्षक',
        },
      },
      translationStatus: {
        hi: 'APPROVED',
      },
    };

    expect(resolveArticleTitle(article, 'hi').text).toBe('हिंदी शीर्षक');
  });

  test('non-approved status does not leak source/original across locale', () => {
    const article: any = {
      title: 'ગુજરાતી શીર્ષક',
      language: 'en',
      originalTitle: 'English title',
      translations: {
        hi: {
          title: 'हिंदी शीर्षक',
        },
      },
      translationStatus: {
        hi: 'PENDING',
      },
    };

    const res = resolveArticleTitle(article, 'hi');
    expect(res.text).toBe('');
    expect(res.isOriginal).toBe(false);
  });
});
