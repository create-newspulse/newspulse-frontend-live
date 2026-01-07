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
        success: true,
        data: {
          // This matches the newer admin-published style (body.data)
          homeModules: {
            categoryStrip: { enabled: false, order: 7 },
          },
          ui: {
            showBreakingTicker: true,
            showLiveUpdatesTicker: false,
          },
          tickers: {
            breaking: { speedSeconds: 9 },
            live: { speedSeconds: 400 },
          },
        },
        version: 'v1',
        updatedAt: '2026-01-06T00:00:00.000Z',
      }),
    });
    (global as any).fetch = fetchMock;

    const res = await fetchPublicSettings();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe('/api/public/settings');
    expect(init?.cache).toBe('no-store');
    expect(init?.headers?.['Cache-Control']).toBe('no-store');

    // Ensure defaults merged + clamping applied (live speedSeconds capped at 300)
    expect(res.settings.modules.categoryStrip.enabled).toBe(false);
    expect(res.settings.modules.categoryStrip.order).toBe(7);
    expect(res.settings.tickers.breaking.speedSeconds).toBe(9);
    expect(res.settings.tickers.live.enabled).toBe(false);
    expect(res.settings.tickers.live.speedSeconds).toBe(300);

    // Cleanup
    (global as any).fetch = originalFetch;
  });
});
