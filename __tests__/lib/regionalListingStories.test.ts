import { resolveArticleSlug } from '../../lib/articleSlugs';
import { resolveCoverImageUrl } from '../../lib/coverImages';
import { getLocalizedArticleFields, STRICT_LOCALE_POLICY } from '../../lib/localizedArticleFields';
import { appendRegionalStories, REGIONAL_BLOCKED_IDS, selectRegionalInitialStories } from '../../lib/regionalInitialStories';
import { compactRegionalInitialStories, getRegionalReadMinutes } from '../../lib/regionalListingStories';

function story(language: 'en' | 'hi' | 'gu' = 'en') {
  return {
    _id: `regional-${language}`,
    slug: 'source-slug',
    slugs: { [language]: `localized-${language}` },
    title: 'Regional display title',
    summary: 'The existing card summary.',
    excerpt: 'The existing search excerpt.',
    content: '<p>Regional article body. </p>'.repeat(2000),
    localizedContent: '<p>Duplicate body.</p>'.repeat(2000),
    description: 'Unused duplicate description.',
    category: 'regional',
    language,
    sourceLanguage: language,
    status: 'published',
    publishedAt: '2026-10-03T20:15:33.097Z',
    publishAt: '2026-10-03T20:15:33.097Z',
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-10-03T20:15:33.097Z',
    coverImage: { url: 'https://images.example.test/bridge.jpg', unused: 'metadata' },
    location: { district: 'Ahmedabad', city: 'Ahmedabad', unused: 'metadata' },
    districtSlug: 'ahmedabad',
    tags: ['state:gujarat', 'district:ahmedabad'],
    detailApiUrl: 'https://backend.test/api/public/news/article',
    canonicalDetailUrl: '/news/article',
    translationAvailability: { en: true, hi: true, gu: true },
  };
}

describe('Regional initial listing projection', () => {
  test.each(['en', 'hi', 'gu'] as const)('%s retains card, district, ticker, identity, chronology and eligibility fields', (locale) => {
    const original = story(locale);
    const [compact] = compactRegionalInitialStories([original], locale);

    for (const field of ['_id', 'title', 'summary', 'excerpt', 'category', 'language', 'sourceLanguage', 'status', 'publishedAt', 'publishAt', 'createdAt', 'updatedAt', 'districtSlug', 'tags'] as const) {
      expect(compact[field]).toEqual(original[field]);
    }
    expect(compact.location).toEqual({ district: 'Ahmedabad' });
    expect(resolveArticleSlug(compact, locale)).toBe(resolveArticleSlug(original, locale));
    expect(resolveCoverImageUrl(compact)).toBe(resolveCoverImageUrl(original));
    expect(getRegionalReadMinutes(compact)).toBe(getRegionalReadMinutes(original));
    expect(selectRegionalInitialStories([compact], locale)).toEqual([compact]);
    expect(JSON.parse(JSON.stringify(compact))).toEqual(compact);

    for (const field of ['content', 'localizedContent', 'description', 'slugs', 'coverImage', 'translationAvailability', 'detailApiUrl', 'canonicalDetailUrl', 'i18n']) {
      expect(compact).not.toHaveProperty(field);
    }
    expect(JSON.stringify(compact).length).toBeLessThan(JSON.stringify(original).length / 10);
  });

  test.each(['en', 'hi'] as const)('%s keeps real READY evidence without changing shared visibility or source language', (locale) => {
    const original = {
      ...story(locale),
      sourceLanguage: 'gu',
      translationStatus: { [locale]: 'ready', gu: 'pending' },
      translations: {
        [locale]: { title: 'Localized title', content: 'Localized body text. '.repeat(2000), slug: 'localized-slug' },
        gu: { title: 'Source title', content: 'Source body. '.repeat(2000) },
      },
    };
    const [compact] = compactRegionalInitialStories([original], locale);

    expect(compact.language).toBe(locale);
    expect(compact.sourceLanguage).toBe('gu');
    expect(compact.translationStatus).toEqual({ [locale]: 'READY' });
    expect(compact.translations).toEqual({
      [locale]: {
        title: 'Localized title',
        content: original.translations[locale].content.slice(0, 256),
        slug: resolveArticleSlug(original, locale),
      },
    });
    expect(selectRegionalInitialStories([compact], locale)).toEqual([compact]);
    expect(getLocalizedArticleFields(compact, locale, STRICT_LOCALE_POLICY).isVisible).toBe(false);
  });

  test.each(['en', 'hi'] as const)('%s never projects pending, failed, rejected or incomplete READY translations', (locale) => {
    const original = { ...story(locale), sourceLanguage: 'gu' };
    for (const status of ['pending', 'failed', 'rejected']) {
      expect(compactRegionalInitialStories([{
        ...original,
        translationStatus: { [locale]: status },
        translations: { [locale]: { title: 'Localized title', content: 'Localized body' } },
      }], locale)).toEqual([]);
    }
    for (const fields of [{ title: 'Localized title' }, { content: 'Localized body' }, { title: ' ', content: 'Localized body' }]) {
      expect(compactRegionalInitialStories([{
        ...original,
        translationStatus: { [locale]: 'ready' },
        translations: { [locale]: fields },
      }], locale)).toEqual([]);
    }
  });

  test.each(['pending', 'failed', 'rejected', 'ready'])('keeps Gujarati source behavior with %s status', (status) => {
    const [compact] = compactRegionalInitialStories([{ ...story('gu'), translationStatus: { gu: status } }], 'gu');
    expect(selectRegionalInitialStories([compact], 'gu')).toEqual([compact]);
  });

  test('preserves field-first i18n status and empty cross-locale slug semantics without carrying i18n', () => {
    const original = {
      ...story('hi'),
      slugs: {},
      sourceLanguage: 'gu',
      i18n: {
        title: { hi: { text: 'Localized title', status: 'ready' } },
        content: { hi: { html: 'Localized body. '.repeat(1000), status: 'ready' } },
      },
    };
    const [compact] = compactRegionalInitialStories([original], 'hi');
    expect(compact).not.toHaveProperty('i18n');
    expect(compact.translationStatus).toEqual({ hi: 'READY' });
    expect(resolveArticleSlug(original, 'hi')).toBe('');
    expect(resolveArticleSlug(compact, 'hi')).toBe('');
    expect(selectRegionalInitialStories([compact], 'hi')).toEqual([compact]);
  });

  test('never relabels a wrong-language record as the requested locale', () => {
    const original = {
      ...story('gu'),
      translationStatus: { en: 'ready' },
      translations: { en: { title: 'English title', content: 'English content' } },
    };
    expect(compactRegionalInitialStories([original], 'en')[0].language).toBe('gu');
  });

  test('retains the original reading-time formula, including HTML whitespace counting', () => {
    const original = { title: ' Title ', summary: ' Summary ', content: '<p>word </p>'.repeat(220) };
    const oldWords = `${original.title.trim()} ${original.summary.trim()} ${original.content.trim()}`.trim().split(/\s+/).filter(Boolean).length;
    expect(getRegionalReadMinutes(original)).toBe(Math.max(1, Math.ceil(oldWords / 220)));
    expect(getRegionalReadMinutes({})).toBe(1);
  });

  test('preserves alternate publication dates, district shapes and suppression', () => {
    const original = {
      ...story(),
      publishedAt: '',
      location: undefined,
      geo: { district: 'Surat', state: 'Gujarat', unused: 'metadata' },
      region: { district: 'Ahmedabad', unused: 'metadata' },
      district_code: 'surat',
    };
    const [compact] = compactRegionalInitialStories([original], 'en');
    expect(compact.publishAt).toBe(original.publishAt);
    expect(compact.geo).toEqual({ district: 'Surat' });
    expect(compact.region).toEqual({ district: 'Ahmedabad' });
    expect(compact.district_code).toBe('surat');
    for (const _id of REGIONAL_BLOCKED_IDS) expect(compactRegionalInitialStories([{ ...original, _id }], 'en')).toEqual([]);
  });

  test('appends without duplicate IDs or locale slugs and preserves newest-first order', () => {
    const october = story();
    const may = { ...story(), _id: 'may', slugs: { en: 'may' }, publishedAt: '2026-05-19T09:46:24.291Z' };
    const september = { ...story(), _id: 'september', slugs: { en: 'september' }, publishedAt: '2026-09-22T18:25:18.049Z' };
    const duplicateSlug = { ...may, _id: 'duplicate-slug', slugs: { en: ' MAY ' } };
    const duplicateId = { ...september, slugs: { en: 'other-slug' } };
    const compact = compactRegionalInitialStories([may, october], 'en');
    const merged = appendRegionalStories(compact, [duplicateSlug, september, duplicateId], 'en');
    expect(merged.map((item) => item._id)).toEqual([october._id, september._id, may._id]);
  });

  test.each(['en', 'hi', 'gu'] as const)('%s keeps a full 30-story initial batch below 128 kB with large article bodies', (locale) => {
    const input = Array.from({ length: 30 }, (_, index) => ({
      ...story(locale), _id: `story-${index}`, slugs: { [locale]: `story-${index}` },
    }));
    const compact = compactRegionalInitialStories(input, locale);
    expect(compact).toHaveLength(30);
    expect(Buffer.byteLength(JSON.stringify({ initialStories: compact }), 'utf8')).toBeLessThan(128_000);
  });
});
