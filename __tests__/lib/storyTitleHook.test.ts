import { getCategoryIdentity } from '../../lib/categoryKeys';
import { getStoryTitleHookColor, splitStoryTitleHook } from '../../lib/storyTitleHook';
import en from '../../src/i18n/en.json';
import hi from '../../src/i18n/hi.json';
import gu from '../../src/i18n/gu.json';

const dictionaries = { en, hi, gu };

describe('story headline category identity', () => {
  test.each([
    ['regional', '#65A30D'],
    ['national', '#2563EB'],
    ['international', '#7C3AED'],
    ['glamour', '#C026D3'],
    ['business', '#EA580C'],
    ['sports', '#4F46E5'],
    ['lifestyle', '#DB2777'],
    ['editorial', '#14B8A6'],
    ['breaking', '#DC2626'],
    ['crime', '#DC2626'],
    ['world', '#0D9488'],
    ['ipl', '#2563EB'],
    ['viral-videos', '#F97316'],
    ['faith-culture', '#2563EB'],
    ['pulse-dialogue', '#2563EB'],
  ])('preserves the existing %s headline palette', (category, color) => {
    expect(getStoryTitleHookColor(category)).toBe(color);
  });

  describe.each([
    ['regional', '#65A30D'],
    ['national', '#2563EB'],
    ['international', '#7C3AED'],
    ['glamour', '#C026D3'],
  ] as const)('%s identity', (slug, color) => {
    test.each(['en', 'hi', 'gu'] as const)('ignores the %s category display label when a slug is present', (locale) => {
      const label = dictionaries[locale].categories[slug];
      const category = { slug, title: label, name: label };
      expect(getCategoryIdentity(category)).toBe(slug);
      expect(getStoryTitleHookColor(category)).toBe(color);
    });
  });

  test.each([
    'tech', 'technology', 'science-technology', 'science-tech', 'science tech',
    'science & technology', 'science and technology', ' SCIENCE_TECH ',
  ])('uses the existing science alias for %s', (category) => {
    expect(getCategoryIdentity(category)).toBe('science-technology');
    expect(getStoryTitleHookColor(category)).toBe('#0891B2');
  });

  test('does not merge Tech & Gadgets into Science & Technology', () => {
    expect(getCategoryIdentity('tech-gadgets')).toBe('tech-gadgets');
    expect(getStoryTitleHookColor('tech-gadgets')).toBe('#2563EB');
    expect(getStoryTitleHookColor({ slug: 'tech-gadgets', title: 'Science & Technology' })).toBe('#2563EB');
  });

  test.each([
    undefined, null, '', 'unknown-desk', 42, [], {},
    { slug: 'unknown-desk', title: 'Regional' },
    hi.categories.international, gu.categories.regional,
  ])('preserves the blue fallback for unknown identity %p', (category) => {
    expect(getStoryTitleHookColor(category)).toBe('#2563EB');
  });

  test.each(['en', 'hi', 'gu'] as const)('keeps Pulse Dialogue unchanged with a %s label', (locale) => {
    expect(getStoryTitleHookColor({ slug: 'pulse-dialogue', title: dictionaries[locale].categories.pulseDialogue })).toBe('#2563EB');
  });
});

describe('story title splitting remains unchanged', () => {
  test.each([
    [4, 4], [5, 4], [8, 4], [9, 5], [12, 5], [13, 6],
  ])('splits %i words after %i words', (count, hookCount) => {
    const words = Array.from({ length: count }, (_, index) => `word${index + 1}`);
    expect(splitStoryTitleHook(words.join(' '))).toEqual({
      highlightedHook: words.slice(0, hookCount).join(' '),
      remainingTitle: words.slice(hookCount).join(' '),
    });
  });

  test.each([
    [undefined, '', ''],
    ['', '', ''],
    ['  One  \n two\tthree   ', 'One two three', ''],
    ['  Opening  phrase: \n remaining   title: details  ', 'Opening phrase:', 'remaining title: details'],
    [': one two three four five', ': one two three', 'four five'],
    ['Complete headline:', 'Complete headline:', ''],
  ])('preserves colon and whitespace handling for %p', (title, highlightedHook, remainingTitle) => {
    expect(splitStoryTitleHook(title)).toEqual({ highlightedHook, remainingTitle });
  });

  test.each(['hi', 'gu'] as const)('keeps %s words and punctuation unchanged', (locale) => {
    const labels = dictionaries[locale].categories;
    const words = [labels.regional, labels.national, labels.international, labels.business, labels.glamour];
    expect(splitStoryTitleHook(words.join(' \t '))).toEqual({
      highlightedHook: words.slice(0, 4).join(' '),
      remainingTitle: words[4],
    });
    expect(splitStoryTitleHook(`${words[0]}: ${words.slice(1).join(' ')}`)).toEqual({
      highlightedHook: `${words[0]}:`,
      remainingTitle: words.slice(1).join(' '),
    });
  });
});
