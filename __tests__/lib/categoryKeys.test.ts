import { getCategoryIdentity, getCategoryQueryKey, getCategoryRouteKey } from '../../lib/categoryKeys';

describe('categoryKeys', () => {
  test.each([
    [' Regional ', 'regional'],
    [{ slug: 'regional', title: 'Different display label', name: 'Another label' }, 'regional'],
    [{ slug: 'tech', title: 'Tech & Gadgets' }, 'science-technology'],
    [{ slug: 'tech-gadgets', title: 'Technology' }, 'tech-gadgets'],
    [{ slug: ' ', title: 'Regional' }, 'regional'],
    [{ name: 'Crime' }, 'crime'],
    [{ slug: 'unknown', title: 'National' }, 'unknown'],
    [null, ''],
    [[], ''],
  ])('resolves style identity without changing route aliases: %p', (category, expected) => {
    expect(getCategoryIdentity(category)).toBe(expected);
  });

  test('maps science and technology route variants to the public route slug', () => {
    expect(getCategoryRouteKey('science-technology')).toBe('science-technology');
    expect(getCategoryRouteKey('science tech')).toBe('science-technology');
    expect(getCategoryRouteKey('science & technology')).toBe('science-technology');
    expect(getCategoryRouteKey('tech')).toBe('science-technology');
  });

  test('maps science and technology route variants to tech for backend queries', () => {
    expect(getCategoryQueryKey('science-technology')).toBe('tech');
    expect(getCategoryQueryKey('science & technology')).toBe('tech');
    expect(getCategoryQueryKey('tech')).toBe('tech');
  });

  test('keeps unrelated categories unchanged', () => {
    expect(getCategoryRouteKey('business')).toBe('business');
    expect(getCategoryQueryKey('business')).toBe('business');
    expect(getCategoryRouteKey('international')).toBe('international');
    expect(getCategoryQueryKey('international')).toBe('international');
  });
});