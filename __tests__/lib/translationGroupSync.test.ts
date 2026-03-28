import {
  getArticleSyncVersion,
  pickFreshestArticleForLocale,
  shouldReplaceArticleWithFreshCandidate,
} from '../../lib/translationGroupSync';

describe('translationGroupSync', () => {
  test('prefers locale-matching translation-group article for the requested route', () => {
    const currentArticle: any = {
      _id: 'article-en',
      language: 'en',
      status: 'published',
      title: 'English title',
      content: '<p>English body</p>',
      slug: 'english-title',
      syncVersion: '2026-03-29T10:00:00.000Z',
    };

    const gujaratiArticle: any = {
      _id: 'article-gu',
      language: 'gu',
      status: 'published',
      title: 'ગુજરાતી શીર્ષક',
      content: '<p>ગુજરાતી બોડી</p>',
      slug: 'gujarati-title',
      syncVersion: '2026-03-29T10:00:00.000Z',
    };

    const picked = pickFreshestArticleForLocale({
      currentArticle,
      groupArticles: [gujaratiArticle],
      locale: 'gu',
    });

    expect(picked?._id).toBe('article-gu');
  });

  test('prefers newer sync version among same-locale candidates', () => {
    const olderArticle: any = {
      _id: 'article-hi-old',
      language: 'hi',
      status: 'published',
      title: 'पुराना शीर्षक',
      content: '<p>पुराना बॉडी</p>',
      slug: 'purana-shirshak',
      syncVersion: '2026-03-29T10:00:00.000Z',
    };

    const newerArticle: any = {
      _id: 'article-hi-new',
      language: 'hi',
      status: 'published',
      title: 'नया शीर्षक',
      content: '<p>नया बॉडी</p>',
      slug: 'naya-shirshak',
      syncVersion: '2026-03-29T10:05:00.000Z',
    };

    const picked = pickFreshestArticleForLocale({
      currentArticle: olderArticle,
      groupArticles: [newerArticle],
      locale: 'hi',
    });

    expect(getArticleSyncVersion(picked)).toBe('2026-03-29T10:05:00.000Z');
    expect(picked?._id).toBe('article-hi-new');
  });

  test('only replaces when localized content actually changed or became fresher', () => {
    const currentArticle: any = {
      _id: 'article-1',
      language: 'en',
      status: 'published',
      title: 'English title',
      content: '<p>English body</p>',
      slug: 'english-title',
      syncVersion: '2026-03-29T10:00:00.000Z',
    };

    const sameArticle: any = {
      ...currentArticle,
    };

    const fresherArticle: any = {
      ...currentArticle,
      syncVersion: '2026-03-29T10:03:00.000Z',
      content: '<p>Updated body</p>',
    };

    expect(shouldReplaceArticleWithFreshCandidate(currentArticle, sameArticle, 'en')).toBe(false);
    expect(shouldReplaceArticleWithFreshCandidate(currentArticle, fresherArticle, 'en')).toBe(true);
  });
});