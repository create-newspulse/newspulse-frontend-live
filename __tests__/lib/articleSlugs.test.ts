import { isLocalizedArticleSlug, resolveArticleSlug } from '../../lib/articleSlugs';
import { getLocalizedArticleFields, STRICT_LOCALE_POLICY } from '../../lib/localizedArticleFields';
import { buildNewsUrl } from '../../lib/newsRoutes';

const id = '507f1f77bcf86cd79943c001';
const slugs = { en: 'heritage-2026', hi: '\u0935\u093f\u0930\u093e\u0938\u0924-\u0968\u0966\u0968\u096c', gu: '\u0ab5\u0abe\u0ab0\u0ab8\u0acb-\u0ae8\u0ae6\u0ae8\u0aec' };

describe('locale-owned public article URLs', () => {
  test.each(['en', 'hi', 'gu'] as const)('uses the Backend %s edition slug without modifying its published alias', lang => {
    const article = Object.freeze({
      _id: id, status: 'published', language: lang, slug: slugs.gu, slugs,
      title: 'Title', content: '<p>Body</p>', publishedAt: '2020-01-01T00:00:00.000Z',
    });
    expect(resolveArticleSlug(article, lang)).toBe(slugs[lang]);
    expect(getLocalizedArticleFields(article, lang, STRICT_LOCALE_POLICY).slug).toBe(slugs[lang]);
    expect(article.slug).toBe(slugs.gu);
    expect(buildNewsUrl({ id, slug: encodeURIComponent(slugs[lang]), lang }))
      .toBe(`${lang === 'en' ? '' : `/${lang}`}/news/${encodeURIComponent(slugs[lang])}`);
  });

  test.each([
    { slug: slugs.gu, canonicalSlug: slugs.gu, slugs: { gu: slugs.gu } },
    { slug: 'source-gu-transliteration', canonicalSlug: 'source-gu-transliteration', slugs: { gu: 'source-gu-transliteration' } },
    { slug: 'source-gu-transliteration', canonicalSlug: 'source-gu-transliteration', originalLang: 'gu', isTranslated: true },
    { slug: 'unsafe/path', canonicalSlug: 'unsafe/path' },
  ])('uses the supported ID instead of an inherited/unsafe slug: %j', fields => {
    expect(resolveArticleSlug({ _id: id, language: 'en', ...fields }, 'en')).toBe(id);
  });

  test('preserves the Backend collision fallback even when a locale slug looks valid', () => {
    expect(resolveArticleSlug({
      _id: id, language: 'en', canonicalSlug: id, localizedSlug: id, slug: slugs.en, slugs,
    }, 'en')).toBe(id);
  });

  test('keeps locale-owned legacy transliterations but never derives a slug from the headline', () => {
    expect(resolveArticleSlug({ _id: id, language: 'hi', slug: 'purana-samachar' }, 'hi')).toBe('purana-samachar');
    expect(resolveArticleSlug({ _id: id, language: 'hi', title: 'A new title' }, 'hi')).toBe(id);
    expect(resolveArticleSlug({ _id: 'unsupported-id', language: 'hi', title: 'A new title' }, 'hi')).toBe('');
  });

  test.each(['bad%encoding', 'two%2520levels', '../story', 'story?lang=hi', 'story#part', slugs.gu])('rejects invalid or foreign EN canonical segments: %s', slug => {
    expect(isLocalizedArticleSlug(slug, 'en')).toBe(false);
  });
});
