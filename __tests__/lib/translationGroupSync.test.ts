import {
  getArticleSyncVersion,
  pickFreshestArticleForLocale,
  pickFreshestArticlesForLocale,
  shouldReplaceArticleWithFreshCandidate,
} from '../../lib/translationGroupSync';
import { STRICT_LOCALE_POLICY } from '../../lib/localizedArticleFields';

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

  test('resolves category listings by translation group for strict localized routes', () => {
    const englishSource: any = {
      _id: 'article-en',
      translationGroupId: 'group-1',
      language: 'en',
      status: 'published',
      title: 'English title',
      summary: 'English summary',
      content: '<p>English body</p>',
      slug: 'english-title',
      publishedAt: '2026-03-29T10:00:00.000Z',
    };

    const hindiTranslation: any = {
      _id: 'article-hi',
      translationGroupId: 'group-1',
      language: 'hi',
      status: 'published',
      title: 'हिंदी शीर्षक',
      summary: 'हिंदी सारांश',
      content: '<p>हिंदी बॉडी</p>',
      slug: 'hindi-title',
      publishedAt: '2026-03-29T10:02:00.000Z',
    };

    const gujaratiViaEmbeddedTranslation: any = {
      _id: 'article-en-2',
      translationGroupId: 'group-2',
      language: 'en',
      status: 'published',
      title: 'Another English title',
      summary: 'Another English summary',
      content: '<p>Another English body</p>',
      slug: 'another-english-title',
      translations: {
        gu: {
          title: 'ગુજરાતી શીર્ષક',
          summary: 'ગુજરાતી સારાંશ',
          content: '<p>ગુજરાતી બોડી</p>',
          slug: 'gujarati-title',
        },
      },
      publishedAt: '2026-03-29T10:03:00.000Z',
    };

    const hindiItems = pickFreshestArticlesForLocale({
      articles: [englishSource, hindiTranslation],
      locale: 'hi',
      policy: STRICT_LOCALE_POLICY,
    });

    const gujaratiItems = pickFreshestArticlesForLocale({
      articles: [gujaratiViaEmbeddedTranslation],
      locale: 'gu',
      policy: STRICT_LOCALE_POLICY,
    });

    expect(hindiItems).toHaveLength(1);
    expect(hindiItems[0]?._id).toBe('article-hi');
    expect(gujaratiItems).toHaveLength(1);
    expect(gujaratiItems[0]?._id).toBe('article-en-2');
  });

  const published = {
    _id: 'same-id',
    language: 'en',
    status: 'published',
    title: 'Original title',
    summary: 'Original summary',
    content: '<p>Original body</p>',
    slug: 'original-slug',
    category: 'national',
    syncVersion: 'shared-version',
    updatedAt: '2026-01-01T10:00:00.000Z',
  };

  test.each([false, true])('deduplicates by freshness before selection (newest first: %s)', (newestFirst) => {
    const newer = { ...published, title: 'New title', content: '<p>New body</p>', updatedAt: '2026-01-02T10:00:00.000Z' };
    const picked = pickFreshestArticleForLocale({
      currentArticle: published,
      groupArticles: newestFirst ? [newer, published] : [published, newer],
      locale: 'en',
      policy: STRICT_LOCALE_POLICY,
    });
    expect(picked).toBe(newer);
    expect(shouldReplaceArticleWithFreshCandidate(published, picked, 'en')).toBe(true);
    expect(shouldReplaceArticleWithFreshCandidate(newer, published, 'en')).toBe(false);
  });

  test.each([
    { summary: 'New summary' },
    { category: 'business' },
    { category: { slug: 'business', name: 'Business' } },
    { imageCredit: 'Updated credit' },
    { authorByline: { enabled: true, snapshot: { name: 'New author' } } },
    { translations: { hi: { title: 'Localized title', content: '<p>Localized body</p>' } } },
    { translationStatus: { hi: 'APPROVED' } },
  ])('detects same-version render metadata changes: %j', (changes) => {
    const updated = { ...published, ...changes };
    const picked = pickFreshestArticleForLocale<Record<string, unknown>>({
      currentArticle: published,
      groupArticles: [updated],
      locale: 'en',
      policy: STRICT_LOCALE_POLICY,
    });
    expect(picked).toBe(updated);
    expect(shouldReplaceArticleWithFreshCandidate(published, picked, 'en')).toBe(true);
    expect(shouldReplaceArticleWithFreshCandidate(updated, { ...updated }, 'en')).toBe(false);
  });

  test.each([
    { status: 'unpublished' },
    { status: 'draft' },
    { status: 'scheduled' },
    { isDeleted: true },
    { deletedAt: '2026-01-02T10:00:00.000Z' },
    { archived: true },
  ])('never falls back to the old published object after a same-ID withdrawal: %j', (changes) => {
    expect(pickFreshestArticleForLocale({
      currentArticle: published,
      groupArticles: [{ ...published, ...changes }],
      locale: 'en',
      policy: STRICT_LOCALE_POLICY,
    })).toBeNull();
  });

  test('an authoritative candidate set can be empty or have no eligible locale', () => {
    for (const groupArticles of [[], [{ ...published, language: 'hi' }]]) {
      expect(pickFreshestArticleForLocale({
        currentArticle: null,
        groupArticles,
        locale: 'gu',
        policy: STRICT_LOCALE_POLICY,
      })).toBeNull();
    }
  });

  test('numeric versions are compared numerically, not parsed as calendar dates', () => {
    const older = { ...published, syncVersion: '12' };
    const newer = { ...published, syncVersion: '13' };
    expect(pickFreshestArticleForLocale({
      currentArticle: older, groupArticles: [newer], locale: 'en',
    })).toBe(newer);
    expect(shouldReplaceArticleWithFreshCandidate(newer, older, 'en')).toBe(false);
  });

  test('uses timestamps when only one record has a numeric version', () => {
    const current = { ...published, syncVersion: '12' };
    const older = { ...published, syncVersion: '', updatedAt: '2025-01-01T00:00:00.000Z' };
    expect(shouldReplaceArticleWithFreshCandidate(current, older, 'en')).toBe(false);
    expect(pickFreshestArticleForLocale({
      currentArticle: current, groupArticles: [older], locale: 'en',
    })).toBe(current);
  });

  test('keeps the existing id alias for same-ID freshness', () => {
    const older = { ...published, _id: undefined, id: 'legacy-id' };
    const newer = { ...older, summary: 'Updated legacy summary' };
    expect(shouldReplaceArticleWithFreshCandidate(older, newer, 'en')).toBe(true);
    expect(pickFreshestArticleForLocale({
      currentArticle: older, groupArticles: [newer], locale: 'en',
    })).toBe(newer);
  });

  test('ignores top-level and nested property insertion order', () => {
    const current = {
      ...published,
      category: { slug: 'national', name: 'National' },
      translations: { hi: { title: 'Localized title', content: '<p>Localized body</p>', status: 'APPROVED' } },
    };
    const reordered = Object.fromEntries(Object.entries({
      ...current,
      category: { name: 'National', slug: 'national' },
      translations: { hi: { status: 'APPROVED', content: '<p>Localized body</p>', title: 'Localized title' } },
    }).reverse());
    expect(shouldReplaceArticleWithFreshCandidate(current, reordered, 'en')).toBe(false);
  });

  test('ignores irrelevant diagnostics and transport metadata, including nested metadata', () => {
    const current = {
      ...published,
      category: { slug: 'national', name: 'National' },
      seo: { metaDescription: 'Public description' },
      translations: { hi: { title: 'Localized title', content: '<p>Localized body</p>' } },
    };
    const next = {
      ...current,
      requestId: 'new-request', diagnostics: { elapsed: 45 }, error: 'unused diagnostic',
      metadata: { requestId: 'ignored' }, attributes: { transport: 'ignored' },
      category: { ...current.category, debug: 'ignored' },
      seo: { ...current.seo, requestId: 'ignored' },
      translations: { hi: { ...current.translations.hi, providerRequestId: 'ignored' } },
    };
    expect(shouldReplaceArticleWithFreshCandidate(current, next, 'en')).toBe(false);
  });

  test('ignores empty serializer metadata but retains locale alias-precedence changes', () => {
    const current = {
      ...published,
      translation: { hi: { title: 'Localized title', content: '<p>Localized body</p>', status: 'APPROVED' } },
    };
    expect(shouldReplaceArticleWithFreshCandidate(current, { ...current, metadata: {}, seo: null }, 'en')).toBe(false);
    expect(shouldReplaceArticleWithFreshCandidate(current, { ...current, translations: {} }, 'en')).toBe(true);
  });

  test.each([
    { title: 'Edited title' }, { summary: 'Edited summary' }, { content: '<p>Edited content</p>' },
    { bodyHtml: '<p>Edited body</p>' }, { slug: 'edited-slug' },
    { status: 'draft' }, { deletedAt: '2026-01-02T00:00:00.000Z' }, { archived: true },
    { translations: { hi: { title: 'Edited title', content: '<p>Edited body</p>' } } },
    { translationStatus: { hi: 'BLOCKED' } },
    { seo: { canonicalUrl: '/news/editorial-canonical' } },
    { tags: ['one', 'two'] },
  ])('still detects meaningful edits with the same version and timestamp: %j', (change) => {
    expect(shouldReplaceArticleWithFreshCandidate(published, { ...published, ...change }, 'en')).toBe(true);
  });
});