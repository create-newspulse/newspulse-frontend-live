import { buildNewsShareUrl, buildNewsUrl, isNavigableNewsHref } from '../../lib/newsRoutes';

describe('article link generation', () => {
  test('keeps the canonical /news/<slug> route for English', () => {
    expect(buildNewsUrl({ id: '507f1f77bcf86cd799439011', slug: 'gujarat-budget-2026', lang: 'en' })).toBe(
      '/news/gujarat-budget-2026'
    );
  });

  test('prefixes Hindi and Gujarati routes', () => {
    expect(buildNewsUrl({ id: 'a1', slug: 'gujarat-budget-2026', lang: 'hi' })).toBe('/hi/news/gujarat-budget-2026');
    expect(buildNewsUrl({ id: 'a1', slug: 'gujarat-budget-2026', lang: 'gu' })).toBe('/gu/news/gujarat-budget-2026');
  });

  test('falls back to the article id when no slug is available', () => {
    expect(buildNewsUrl({ id: '507f1f77bcf86cd799439011', lang: 'en' })).toBe('/news/507f1f77bcf86cd799439011');
  });

  test('returns the non-navigable placeholder when nothing resolves', () => {
    expect(buildNewsUrl({ id: '', slug: '', lang: 'en' })).toBe('#');
  });
});

describe('stable article sharing links', () => {
  test.each([
    ['en', '/s/507f1f77bcf86cd799439011'],
    ['hi', '/hi/s/507f1f77bcf86cd799439011'],
    ['gu', '/gu/s/507f1f77bcf86cd799439011'],
  ])('uses the public ID rather than a mutable slug for %s', (lang, expected) => {
    expect(buildNewsShareUrl({ id: '507F1F77BCF86CD799439011', lang })).toBe(expected);
  });

  test.each(['', 'undefined', 'legacy-story', '507f1f77bcf86cd799439011/other', ' 507f1f77bcf86cd799439011', '507f1f77bcf86cd79943901z'])(
    'does not invent a short link for an unsupported identity: %s', id => {
      expect(isNavigableNewsHref(buildNewsShareUrl({ id, lang: 'gu' }))).toBe(false);
    }
  );
});

describe('isNavigableNewsHref', () => {
  test('accepts real article routes in every locale', () => {
    expect(isNavigableNewsHref('/news/story-one')).toBe(true);
    expect(isNavigableNewsHref('/hi/news/story-one')).toBe(true);
    expect(isNavigableNewsHref('/gu/news/story-one')).toBe(true);
  });

  test('rejects placeholder and empty hrefs', () => {
    expect(isNavigableNewsHref('#')).toBe(false);
    expect(isNavigableNewsHref('')).toBe(false);
    expect(isNavigableNewsHref('   ')).toBe(false);
    expect(isNavigableNewsHref(undefined)).toBe(false);
    expect(isNavigableNewsHref(null)).toBe(false);
  });

  test('an article without id or slug never produces a clickable href', () => {
    const href = buildNewsUrl({ id: '', slug: '', lang: 'hi' });
    expect(isNavigableNewsHref(href)).toBe(false);
  });
});
