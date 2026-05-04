import {
  DEFAULT_PUBLIC_SETTINGS,
  getHomeModuleOrder,
  getOrderedEnabledKeys,
  getTickerSpeedSeconds,
  isHomeModuleEnabled,
  isTickerEnabled,
  mergePublicSettingsWithDefaults,
  fetchPublicSettings,
  normalizePublicSettings,
} from '../../src/lib/publicSettings';
import { resolveInspirationHubDroneTvSettings } from '../../src/lib/inspirationHubSettings';

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

  test('Inspiration Hub master switch hides DroneTV on all public surfaces', () => {
    const settings = normalizePublicSettings({
      published: {
        inspirationHub: {
          enabled: false,
          droneTv: {
            enabled: true,
            embedUrl: 'https://www.youtube.com/embed/AbCdEfGhIjK',
            showOnHomepage: true,
            showOnCategoryPage: true,
          },
        },
      },
    });

    expect(resolveInspirationHubDroneTvSettings(settings, 'homepage')).toBeNull();
    expect(resolveInspirationHubDroneTvSettings(settings, 'categoryPage')).toBeNull();
  });

  test('missing Inspiration Hub settings do not fall back to showing DroneTV', () => {
    const settings = normalizePublicSettings({
      published: {
        modules: {},
        tickers: {},
      },
    });

    expect(settings.inspirationHub).toBeNull();
    expect(resolveInspirationHubDroneTvSettings(settings, 'homepage')).toBeUndefined();
    expect(resolveInspirationHubDroneTvSettings(settings, 'categoryPage')).toBeUndefined();
  });

  test('DroneTV video switch hides only the video block while hub remains enabled', () => {
    const settings = normalizePublicSettings({
      published: {
        inspirationHub: {
          enabled: true,
          droneTv: {
            enabled: false,
            embedUrl: 'https://www.youtube.com/embed/AbCdEfGhIjK',
            showOnHomepage: true,
          },
        },
      },
    });

    expect(settings.inspirationHub?.enabled).toBe(true);
    expect(resolveInspirationHubDroneTvSettings(settings, 'homepage')).toBeNull();
  });

  test('DroneTV placement toggles control homepage and Inspiration Hub page separately', () => {
    const settings = normalizePublicSettings({
      published: {
        inspirationHub: {
          enabled: true,
          droneTv: {
            enabled: true,
            embedUrl: 'https://www.youtube.com/embed/AbCdEfGhIjK',
            showOnHomepage: true,
            showOnCategoryPage: false,
          },
        },
      },
    });

    expect(resolveInspirationHubDroneTvSettings(settings, 'homepage')?.embedUrl).toBe('https://www.youtube.com/embed/AbCdEfGhIjK');
    expect(resolveInspirationHubDroneTvSettings(settings, 'categoryPage')).toBeNull();
  });

  test('flat Inspiration Hub admin aliases are normalized strictly', () => {
    const settings = normalizePublicSettings({
      published: {
        inspirationHub: {
          enableInspirationHub: true,
          enableDroneTVVideo: true,
          showHome: false,
          pageEnabled: true,
          videoTitle: 'DroneTV',
          videoSubtitle: 'Stories, views, and inspiration from above',
          youtubeUrl: 'https://www.youtube.com/watch?v=AbCdEfGhIjK',
        },
      },
    });

    expect(settings.inspirationHub?.enabled).toBe(true);
    expect(settings.inspirationHub?.droneTv.enabled).toBe(true);
    expect(settings.inspirationHub?.droneTv.homepageEnabled).toBe(false);
    expect(settings.inspirationHub?.droneTv.categoryPageEnabled).toBe(true);
    expect(resolveInspirationHubDroneTvSettings(settings, 'homepage')).toBeNull();
    expect(resolveInspirationHubDroneTvSettings(settings, 'categoryPage')?.title).toBe('DroneTV');
  });

  test('explicit Inspiration Hub homepage module false hides the homepage block only when present', () => {
    const shouldShowHomepageHub = (settings: ReturnType<typeof normalizePublicSettings>) =>
      settings.inspirationHub?.enabled === true &&
      settings.inspirationHub.droneTv.homepageEnabled === true &&
      settings.inspirationHub.homepageModuleEnabled !== false;

    const missingModule = normalizePublicSettings({
      published: {
        homepage: { modules: {} },
        inspirationHub: {
          enabled: true,
          droneTvEnabled: true,
          showOnHomepage: true,
          embedUrl: 'https://www.youtube.com/embed/AbCdEfGhIjK',
        },
      },
    });
    expect(shouldShowHomepageHub(missingModule)).toBe(true);

    const explicitOff = normalizePublicSettings({
      published: {
        homepage: { modules: { inspirationHub: { enabled: false } } },
        inspirationHub: {
          enabled: true,
          droneTvEnabled: true,
          showOnHomepage: true,
          embedUrl: 'https://www.youtube.com/embed/AbCdEfGhIjK',
        },
      },
    });
    expect(shouldShowHomepageHub(explicitOff)).toBe(false);
    expect(resolveInspirationHubDroneTvSettings(explicitOff, 'homepage')?.embedUrl).toBe('https://www.youtube.com/embed/AbCdEfGhIjK');
  });

  test('homepage DroneTV shows when required flat fields are on and URL exists', () => {
    const settings = normalizePublicSettings({
      published: {
        inspirationHub: {
          isEnabled: true,
          enableDroneTVVideo: true,
          homepageEnabled: true,
          droneTvYoutubeUrl: 'https://www.youtube.com/watch?v=AbCdEfGhIjK',
        },
      },
    });

    const homepage = resolveInspirationHubDroneTvSettings(settings, 'homepage');
    expect(settings.inspirationHub?.enabled).toBe(true);
    expect(settings.inspirationHub?.droneTv.enabled).toBe(true);
    expect(settings.inspirationHub?.droneTv.homepageEnabled).toBe(true);
    expect(homepage?.embedUrl).toBe('https://www.youtube-nocookie.com/embed/AbCdEfGhIjK?rel=0&modestbranding=1&playsinline=1');
    expect(homepage?.title).toBe('');
    expect(homepage?.subtitle).toBe('');
  });

  test('homepage DroneTV hides when master switch is explicitly false', () => {
    const settings = normalizePublicSettings({
      published: {
        inspirationHub: {
          enableInspirationHub: false,
          enableDroneTVVideo: true,
          showOnHomepage: true,
          embedUrl: 'https://www.youtube.com/embed/AbCdEfGhIjK',
        },
      },
    });

    expect(settings.inspirationHub?.enabled).toBe(false);
    expect(resolveInspirationHubDroneTvSettings(settings, 'homepage')).toBeNull();
  });

  test('homepage Inspiration Hub master and child switches resolve independently', () => {
    const shouldShowHomepageHub = (settings: ReturnType<typeof normalizePublicSettings>) =>
      settings.inspirationHub?.enabled === true && settings.inspirationHub.droneTv.homepageEnabled === true;

    const masterOff = normalizePublicSettings({
      published: {
        inspirationHub: {
          enabled: false,
          droneTvEnabled: true,
          showOnHomepage: true,
          embedUrl: 'https://www.youtube.com/embed/AbCdEfGhIjK',
        },
      },
    });
    expect(shouldShowHomepageHub(masterOff)).toBe(false);
    expect(resolveInspirationHubDroneTvSettings(masterOff, 'homepage')).toBeNull();

    const homepageOff = normalizePublicSettings({
      published: {
        inspirationHub: {
          enabled: true,
          droneTvEnabled: true,
          showOnHomepage: false,
          embedUrl: 'https://www.youtube.com/embed/AbCdEfGhIjK',
        },
      },
    });
    expect(shouldShowHomepageHub(homepageOff)).toBe(false);
    expect(resolveInspirationHubDroneTvSettings(homepageOff, 'homepage')).toBeNull();

    const allOn = normalizePublicSettings({
      published: {
        inspirationHub: {
          enabled: true,
          droneTvEnabled: true,
          showOnHomepage: true,
          videoTitle: 'DroneTV',
          videoSubtitle: 'Stories, views, and inspiration from above',
          embedUrl: 'https://www.youtube.com/embed/AbCdEfGhIjK',
        },
      },
    });
    expect(shouldShowHomepageHub(allOn)).toBe(true);
    expect(resolveInspirationHubDroneTvSettings(allOn, 'homepage')?.title).toBe('DroneTV');

    const droneOff = normalizePublicSettings({
      published: {
        inspirationHub: {
          enabled: true,
          droneTvEnabled: false,
          showOnHomepage: true,
          embedUrl: 'https://www.youtube.com/embed/AbCdEfGhIjK',
        },
      },
    });
    expect(shouldShowHomepageHub(droneOff)).toBe(true);
    expect(resolveInspirationHubDroneTvSettings(droneOff, 'homepage')).toBeNull();
  });

  test('DroneTV resolver returns admin title subtitle and embed URL', () => {
    const settings = normalizePublicSettings({
      published: {
        inspirationHub: {
          enabled: true,
          droneTv: {
            enabled: true,
            videoTitle: 'DroneTV',
            videoSubtitle: 'Stories, views, and inspiration from above',
            droneTvEmbedUrl: 'https://www.youtube.com/watch?v=AbCdEfGhIjK',
            showOnHomepage: true,
          },
        },
      },
    });

    const homepage = resolveInspirationHubDroneTvSettings(settings, 'homepage');
    expect(homepage?.title).toBe('DroneTV');
    expect(homepage?.subtitle).toBe('Stories, views, and inspiration from above');
    expect(homepage?.embedUrl).toBe('https://www.youtube-nocookie.com/embed/AbCdEfGhIjK?rel=0&modestbranding=1&playsinline=1');
  });
});
