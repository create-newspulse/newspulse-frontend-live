import { getLocalizedArticleFields, STRICT_LOCALE_POLICY, type RouteLocale } from '../../lib/localizedArticleFields';
import { REGIONAL_BLOCKED_IDS, selectRegionalInitialStories } from '../../lib/regionalInitialStories';

type TranslatedFields = {
  title?: string | null;
  content?: string | null;
  summary?: string;
  slug?: string;
};

function regionalArticle(
  locale: RouteLocale,
  translationStatus = 'ready',
  translatedFields: TranslatedFields = {
    title: `Translated ${locale} title`,
    content: `<p>Translated ${locale} content</p>`,
  }
) {
  return {
    _id: `regional-${locale}`,
    slug: `regional-${locale}`,
    slugs: { [locale]: `regional-${locale}` },
    category: 'regional',
    status: 'published',
    language: locale,
    sourceLanguage: 'gu',
    title: 'Base title is not a localized title',
    content: '<p>Base content is not localized content</p>',
    publishedAt: '2026-01-01T10:00:00.000Z',
    translationStatus: { [locale]: translationStatus },
    translations: { [locale]: translatedFields },
  };
}

describe.each(['en', 'hi'] as const)('Regional %s ready translations', (locale) => {
  test('includes a Gujarati-source ready translation with localized title and content', () => {
    const article = regionalArticle(locale);
    const selected = selectRegionalInitialStories({ data: { items: [article] } }, locale);

    expect(selected).toEqual([article]);
    expect(selected[0]).toBe(article);
    expect(article.translationStatus[locale]).toBe('ready');
  });

  test('leaves shared strict locale visibility unchanged for Home and other categories', () => {
    const article = regionalArticle(locale);

    expect(getLocalizedArticleFields(article, locale, STRICT_LOCALE_POLICY).isVisible).toBe(false);
    expect(selectRegionalInitialStories([article], locale)).toEqual([article]);
    expect(getLocalizedArticleFields(article, locale, STRICT_LOCALE_POLICY).isVisible).toBe(false);
  });

  test.each(['pending', 'failed', 'rejected', 'blocked', 'draft'])('rejects %s translations even with localized fields', (status) => {
    expect(selectRegionalInitialStories([regionalArticle(locale, status)], locale)).toEqual([]);
  });

  test.each<{ label: string; fields: TranslatedFields }>([
    { label: 'missing title', fields: { content: '<p>Translated content</p>' } },
    { label: 'missing content', fields: { title: 'Translated title' } },
    { label: 'blank title', fields: { title: ' \n ', content: '<p>Translated content</p>' } },
    { label: 'blank content', fields: { title: 'Translated title', content: ' \n ' } },
    { label: 'null title', fields: { title: null, content: '<p>Translated content</p>' } },
    { label: 'null content', fields: { title: 'Translated title', content: null } },
    { label: 'only summary and slug', fields: { summary: 'Translated summary', slug: 'translated-slug' } },
  ])('rejects ready translations with $label rather than using base fields', ({ fields }) => {
    expect(selectRegionalInitialStories([regionalArticle(locale, 'ready', fields)], locale)).toEqual([]);
  });

  test('does not use another locale to supply missing translated content', () => {
    const article = regionalArticle(locale, 'ready', { title: 'Translated title' });
    article.translations.gu = { title: 'Source title', content: '<p>Source content</p>' };

    expect(selectRegionalInitialStories([article], locale)).toEqual([]);
  });

  test('preserves approved translation visibility', () => {
    const article = regionalArticle(locale, 'APPROVED');

    expect(selectRegionalInitialStories([article], locale)).toEqual([article]);
  });
});

describe('Regional ready compatibility safeguards', () => {
  test.each(['ready', 'pending', 'failed', 'rejected'])('preserves Gujarati source behavior with %s translation status', (status) => {
    const article = regionalArticle('gu', status, {});

    expect(selectRegionalInitialStories([article], 'gu')).toEqual([article]);
  });

  test('does not enable ready cross-locale translations for Gujarati', () => {
    const article = { ...regionalArticle('gu'), sourceLanguage: 'en' };

    expect(selectRegionalInitialStories([article], 'gu')).toEqual([]);
  });

  test.each([
    { label: 'draft', fields: { status: 'draft' } },
    { label: 'unpublished', fields: { published: false } },
    { label: 'deleted', fields: { deleted: true } },
    { label: 'archived', fields: { archived: true } },
    { label: 'future publication', fields: { publishedAt: '2999-01-01T10:00:00.000Z' } },
  ])('still rejects $label articles with ready translations', ({ fields }) => {
    expect(selectRegionalInitialStories([{ ...regionalArticle('en'), ...fields }], 'en')).toEqual([]);
  });

  test.each([...REGIONAL_BLOCKED_IDS])('still suppresses ready article %s', (id) => {
    expect(selectRegionalInitialStories([{ ...regionalArticle('en'), _id: id }], 'en')).toEqual([]);
  });

  test('preserves first-occurrence slug dedupe and newest-first sorting', () => {
    const older = regionalArticle('en');
    const duplicate = { ...older, _id: 'duplicate', publishedAt: '2026-01-03T10:00:00.000Z' };
    const newer = {
      ...regionalArticle('en'),
      _id: 'newer',
      slugs: { en: 'newer-story' },
      publishedAt: '2026-01-02T10:00:00.000Z',
    };

    expect(selectRegionalInitialStories([older, duplicate, newer], 'en')).toEqual([newer, older]);
  });
});
