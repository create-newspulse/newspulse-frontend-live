import {
  DEFAULT_PUBLIC_SETTINGS,
  getHomeModuleOrder,
  getOrderedEnabledKeys,
  getTickerSpeedSeconds,
  isHomeModuleEnabled,
  isTickerEnabled,
  mergePublicSettingsWithDefaults,
  fetchPublicSettings,
} from '../../src/lib/publicSettings';

describe('publicSettings helpers', () => {
  test('getOrderedEnabledKeys sorts by order and filters disabled', () => {
    const modules = {
      ...DEFAULT_PUBLIC_SETTINGS.modules,
      categoryStrip: { enabled: true, order: 3 },
      trendingStrip: { enabled: false, order: 1 },
      breakingTicker: { enabled: true, order: 2 },
    };

    const keys = getOrderedEnabledKeys(modules as any);
    expect(keys).toEqual(expect.arrayContaining(['breakingTicker', 'categoryStrip']));
    expect(keys).not.toContain('trendingStrip');

    const iBreaking = keys.indexOf('breakingTicker');
    const iCategory = keys.indexOf('categoryStrip');
    expect(iBreaking).toBeLessThan(iCategory);
  });

  test('mergePublicSettingsWithDefaults applies defaults when fields missing', () => {
    const merged = mergePublicSettingsWithDefaults({});
    expect(merged).toEqual(DEFAULT_PUBLIC_SETTINGS);
  });

  test('mergePublicSettingsWithDefaults ignores unknown fields safely', () => {
    const merged = mergePublicSettingsWithDefaults({
      settings: {
        modules: {
          exploreCategories: { enabled: false, order: 99 },
          somethingElse: { enabled: false, order: 1 },
        },
        tickers: {
          breaking: { enabled: false, speedSeconds: 12 },
          live: { enabled: true, speedSeconds: 34 },
          extra: { speedSeconds: 1 },
        },
      },
      version: 'v123',
      updatedAt: '2026-01-06T00:00:00.000Z',
      extraRoot: true,
    });

    expect(merged.modules.exploreCategories.enabled).toBe(false);
    expect(merged.modules.exploreCategories.order).toBe(99);
    expect(merged.tickers.breaking.speedSeconds).toBe(12);
    expect(merged.tickers.breaking.enabled).toBe(false);
    expect(merged.tickers.live.speedSeconds).toBe(34);
    expect(merged.tickers.live.enabled).toBe(true);
  });

  test('homepage mapping helpers apply published overrides', () => {
    const settings = mergePublicSettingsWithDefaults({
      settings: {
        modules: {
          categoryStrip: { enabled: false, order: 99 },
        },
        tickers: {
          breaking: { enabled: false, speedSeconds: 12 },
          live: { enabled: true, speedSeconds: 34 },
        },
      },
    });

    expect(isHomeModuleEnabled(settings, 'categoryStrip', true)).toBe(false);
    expect(getHomeModuleOrder(settings, 'categoryStrip', 10)).toBe(99);

    expect(isTickerEnabled(settings, 'breaking', true)).toBe(false);
    expect(isTickerEnabled(settings, 'live', false)).toBe(true);
    expect(getTickerSpeedSeconds(settings, 'breaking', 18)).toBe(12);
    expect(getTickerSpeedSeconds(settings, 'live', 24)).toBe(34);
  });

  test('fetchPublicSettings calls /api/public/settings and merges defaults', async () => {
    const originalFetch = (global as any).fetch;

    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        version: 'v1',
        updatedAt: '2026-01-06T00:00:00.000Z',

        // Simulate backend published schema with drift:
        // - exploreCategories (old)
        // - trending (new)
        // - tickers.*.speedSeconds (old)
        published: {
          homepage: {
            modules: {
              categoryStrip: { enabled: false, order: 7 },
              exploreCategories: { enabled: false, order: 11 },
              trending: { enabled: true, order: 33 },
            },
          },
          tickers: {
            breaking: { enabled: true, speedSeconds: 9, order: 12 },
            live: { enabled: true, speedSeconds: 400, order: 22 },
          },
          liveTv: { enabled: false, embedUrl: 'https://example.com/embed' },
          languageTheme: { languages: ['gu', 'hi', 'en'], themePreset: 'midnight' },
        },
      }),
    });
    (global as any).fetch = fetchMock;

    const res = await fetchPublicSettings();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('/api/public/settings');
    expect(init?.cache).toBe('no-store');
    expect(init?.headers?.['Cache-Control']).toBe('no-store');

    // Ensure normalization + clamping applied (live speedSec capped at 300)
    expect(res.modules.categoryStrip.enabled).toBe(false);
    expect(res.modules.categoryStrip.order).toBe(7);

    // explore maps from exploreCategories
    expect(res.modules.explore.enabled).toBe(false);
    expect(res.modules.explore.order).toBe(11);

    // trending reads new key
    expect(res.modules.trending.enabled).toBe(true);
    expect(res.modules.trending.order).toBe(33);

    expect(res.tickers.breaking.speedSec).toBe(9);
    expect(res.tickers.breaking.order).toBe(12);

    expect(res.tickers.live.enabled).toBe(true);
    expect(res.tickers.live.speedSec).toBe(300);
    expect(res.tickers.live.order).toBe(22);

    // liveTv.enabled should propagate
    expect(res.liveTv.enabled).toBe(false);

    // Cleanup
    (global as any).fetch = originalFetch;
  });
});
