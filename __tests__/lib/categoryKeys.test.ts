import { getCategoryQueryKey, getCategoryRouteKey } from '../../lib/categoryKeys';

describe('categoryKeys', () => {
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