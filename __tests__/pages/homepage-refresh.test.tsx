import React from 'react';
import { act, render, renderHook, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import HomePage, { getServerSideProps } from '../../pages/index';
import { PublicSettingsProvider, usePublicSettings } from '../../src/context/PublicSettingsContext';
import { fetchPublicSettings, fetchPublishedPublicSettings, normalizePublicSettings } from '../../src/lib/publicSettings';
import { dispatchPublicDataRefresh } from '../../lib/publicDataRefresh';
import { fetchPublicNews } from '../../lib/publicNewsApi';

jest.mock('next/router', () => ({ useRouter: () => ({ asPath: '/', pathname: '/', locale: 'en', push: jest.fn(), replace: jest.fn() }) }));
jest.mock('next/head', () => ({ __esModule: true, default: () => null }));
jest.mock('../../src/i18n/LanguageProvider', () => ({ ...jest.requireActual('../../src/i18n/LanguageProvider'), useI18n: () => ({ lang: 'en', t: (key: string) => key, setLang: jest.fn() }) }));
jest.mock('../../src/consent/CookieConsentProvider', () => ({ useCookieConsent: () => ({ hasCategoryConsent: () => false, openPreferences: jest.fn() }) }));
jest.mock('../../src/components/ads/AdSlot', () => ({ __esModule: true, default: () => null }));
jest.mock('../../components/home/HomeRightRail', () => ({ __esModule: true, default: () => null }));
jest.mock('../../hooks/usePublicFounderToggles', () => ({ usePublicFounderToggles: () => ({ toggles: {} }) }));
jest.mock('../../hooks/usePublicBroadcastTicker', () => ({ usePublicBroadcastTicker: () => ({ breakingTexts: ['Breaking fixture'], liveTexts: ['Live fixture'] }) }));
jest.mock('../../hooks/usePublicTickerAds', () => ({ usePublicTickerAds: () => ({ ads: [] }) }));
jest.mock('../../hooks/usePublicAdSlot', () => ({ usePublicAdSlot: () => ({ enabled: false, ad: null }) }));
jest.mock('../../lib/publicNewsApi', () => ({ fetchPublicNews: jest.fn(async () => ({ items: [], endpoint: '/api/public/news' })) }));
jest.mock('../../lib/publicSponsoredFeature', () => ({ ...jest.requireActual('../../lib/publicSponsoredFeature'), fetchHomepageSponsoredFeature: jest.fn(async () => null) }));
jest.mock('../../lib/getTrendingTopics', () => ({ getTrendingTopics: jest.fn(async () => []) }));
jest.mock('../../lib/fetchWeather', () => ({ fetchCurrentWeather: jest.fn(async () => null) }));
jest.mock('../../src/lib/publicSettings', () => ({ ...jest.requireActual('../../src/lib/publicSettings'), fetchPublicSettings: jest.fn(), fetchPublishedPublicSettings: jest.fn() }));
jest.mock('../../lib/getMessages', () => ({ getMessages: jest.fn(async () => ({})) }));
jest.mock('../../lib/publicSponsoredFeatureSource', () => ({ normalizeSponsoredFeatureLang: (lang: string) => lang, resolvePublicHomepageSponsoredFeature: jest.fn(async () => ({ feature: null })) }));

const props = { messages: {}, seo: { canonicalUrl: '/' }, initialHomepageSponsoredFeature: null, initialTopStory: null, initialFreshStories: [] };
const published = (version = '426', appPromo = false) => normalizePublicSettings({
  version,
  published: {
    modules: {
      categoryStrip: { enabled: true, order: 1 },
      trending: { enabled: true, order: 2 },
      explore: { enabled: true, order: 5 },
      quickTools: { enabled: true, order: 6 },
      appPromo: { enabled: appPromo, order: 7 },
      footer: { enabled: false, order: 8 },
      snapshots: { enabled: false },
      liveTvCard: { enabled: false },
    },
    tickers: { breaking: { enabled: false }, live: { enabled: true } },
    inspirationHub: { enabled: false },
  },
});

const wrapper = ({ children }: { children: React.ReactNode }) => <React.StrictMode><PublicSettingsProvider>{children}</PublicSettingsProvider></React.StrictMode>;

describe('homepage published visibility', () => {
  beforeEach(() => { jest.clearAllMocks(); });

  test('published SSR snapshot renders ON modules immediately and survives a failed hydration refresh', async () => {
    const publishedSettings = published();
    publishedSettings.inspirationHub = { ...publishedSettings.inspirationHub!, homepageModuleEnabled: undefined };
    (fetchPublishedPublicSettings as jest.Mock).mockResolvedValueOnce(publishedSettings);
    const result = await getServerSideProps({ locale: 'en', res: { setHeader: jest.fn() } } as any) as any;
    const initialSettings = result.props.initialPublicSettings;
    expect(Object.hasOwn(initialSettings.inspirationHub, 'homepageModuleEnabled')).toBe(false);
    const story = { _id: 'ssr-story', title: 'SSR lead story', slug: 'ssr-lead', language: 'en', status: 'published', publishedAt: '2026-09-01T10:00:00Z' };
    const homepage = <PublicSettingsProvider initialSettings={initialSettings}><HomePage {...props} initialTopStory={story} initialFreshStories={[story]} /></PublicSettingsProvider>;
    const html = renderToString(homepage);
    expect(html).toContain('Live fixture');
    expect(html).toContain('href="/national"');
    expect(html).toContain('SSR lead story');
    expect(html).not.toContain('Breaking fixture');
    expect(html).not.toContain('common.appStore');
    expect(html).not.toContain('href="/monthly-compliance"');
    let rejectRefresh!: (reason: Error) => void;
    (fetchPublicSettings as jest.Mock).mockImplementation(() => new Promise((_resolve, reject) => { rejectRefresh = reject; }));
    const hydrationContainer = document.createElement('div');
    hydrationContainer.innerHTML = html;
    document.body.appendChild(hydrationContainer);
    const hydratedSettings = JSON.parse(JSON.stringify(result)).props.initialPublicSettings;
    expect(hydratedSettings).toStrictEqual(initialSettings);
    const hydratedHomepage = <PublicSettingsProvider initialSettings={hydratedSettings}><HomePage {...props} initialTopStory={story} initialFreshStories={[story]} /></PublicSettingsProvider>;
    const { container, unmount } = render(hydratedHomepage, { container: hydrationContainer, hydrate: true });
    expect(screen.getAllByText('Live fixture').length).toBeGreaterThan(0);
    await act(async () => { rejectRefresh(new Error('unavailable')); });
    expect(screen.getAllByText('Live fixture').length).toBeGreaterThan(0);
    expect(screen.queryByText('Breaking fixture')).toBeNull();
    expect(screen.queryByText('common.appStore')).toBeNull();
    expect(container.querySelector('a[href="/monthly-compliance"]')).toBeNull();
    expect(fetchPublicSettings).toHaveBeenCalledTimes(1);
    unmount();
    hydrationContainer.remove();
  });

  test('SSR does not render configurable modules from defaults', () => {
    const html = renderToString(<PublicSettingsProvider><HomePage {...props} /></PublicSettingsProvider>);
    expect(html).not.toContain('Breaking fixture');
    expect(html).not.toContain('common.appStore');
    expect(html).not.toContain('href="/monthly-compliance"');
    expect(html).not.toContain('Live fixture');
    expect(fetchPublicSettings).not.toHaveBeenCalled();
  });

  test('valid SSR Top Story renders immediately without waiting for settings', () => {
    const story = { _id: 'ssr-story', title: 'SSR lead story', slug: 'ssr-lead', language: 'en', status: 'published', publishedAt: '2026-09-01T10:00:00Z' };
    const html = renderToString(<PublicSettingsProvider><HomePage {...props} initialTopStory={story} initialFreshStories={[story]} /></PublicSettingsProvider>);
    const document = new DOMParser().parseFromString(html, 'text/html');
    expect(document.querySelector('#top-story h1')?.textContent).toBe('SSR lead story');
    expect(document.querySelector('#top-story .animate-pulse')).toBeNull();
    expect(document.querySelector('a[href="/monthly-compliance"]')).toBeNull();
  });

  test('OFF modules never appear while unresolved or after publish, and ON modules appear after resolution', async () => {
    let resolveSettings!: (settings: ReturnType<typeof published>) => void;
    (fetchPublicSettings as jest.Mock).mockImplementation(() => new Promise(resolve => { resolveSettings = resolve; }));
    const { container } = render(<PublicSettingsProvider><HomePage {...props} /></PublicSettingsProvider>);
    expect(screen.queryByText('Breaking fixture')).toBeNull();
    expect(screen.queryByText('common.appStore')).toBeNull();
    expect(container.querySelector('a[href="/monthly-compliance"]')).toBeNull();
    expect(screen.queryByText('Live fixture')).toBeNull();
    await act(async () => { resolveSettings(published()); });
    expect(screen.queryByText('Breaking fixture')).toBeNull();
    expect(screen.queryByText('common.appStore')).toBeNull();
    expect(container.querySelector('a[href="/monthly-compliance"]')).toBeNull();
    expect(screen.getAllByText('Live fixture').length).toBeGreaterThan(0);
    expect(container.querySelector('a[href="/national"]')).not.toBeNull();
    expect(fetchPublicSettings).toHaveBeenCalledTimes(1);
    expect(container.querySelector('#top-story .animate-pulse')).toBeNull();
    expect(screen.getByRole('heading', { name: 'News Pulse Front Page' })).toBeTruthy();
  });

  test('failed initial settings load does not enable default modules', async () => {
    (fetchPublicSettings as jest.Mock).mockRejectedValue(new Error('unavailable'));
    const { container } = render(<PublicSettingsProvider><HomePage {...props} /></PublicSettingsProvider>);
    await act(async () => {});
    expect(screen.queryByText('Breaking fixture')).toBeNull();
    expect(screen.queryByText('common.appStore')).toBeNull();
    expect(container.querySelector('a[href="/monthly-compliance"]')).toBeNull();
    expect(fetchPublicSettings).toHaveBeenCalledTimes(1);
  });

  test('homepage fallback survives 503 trigger bursts and is replaced by one successful retry', async () => {
    jest.useFakeTimers();
    const story = { _id: 'recovered', title: 'Recovered homepage lead', slug: 'recovered', language: 'en', status: 'published', publishedAt: '2026-01-01T10:00:00Z' };
    let attempts = 0;
    (fetchPublicSettings as jest.Mock).mockResolvedValue(published());
    (fetchPublicNews as jest.Mock).mockImplementation(async (options) => {
      if (options.category || !options.homepageRecovery) return { items: [] };
      attempts++;
      return attempts === 1 ? { items: [], error: 'API 503', status: 503, retryAfter: '45' } : { items: [story] };
    });
    const { container, unmount } = render(<PublicSettingsProvider initialSettings={published()}><HomePage {...props} /></PublicSettingsProvider>);
    try {
      await act(async () => {});
      expect(screen.getByRole('heading', { name: 'News Pulse Front Page' })).toBeTruthy();
      const fallbackMarkup = container.querySelector('#top-story')?.innerHTML;
      const navigation = Array.from(container.querySelectorAll('nav')).map(element => element.innerHTML);
      for (let iteration = 0; iteration < 10; iteration++) {
        await act(async () => {
          window.dispatchEvent(new Event('focus'));
          document.dispatchEvent(new Event('visibilitychange'));
          dispatchPublicDataRefresh({ version: String(iteration), previousVersion: null, source: 'test' });
        });
      }
      expect(attempts).toBe(1);
      expect(container.querySelector('#top-story')?.innerHTML).toBe(fallbackMarkup);
      await act(async () => { await jest.advanceTimersByTimeAsync(44_999); });
      expect(attempts).toBe(1);
      await act(async () => { await jest.advanceTimersByTimeAsync(1); });
      expect(attempts).toBe(2);
      expect(container.querySelector('#top-story h1')?.textContent).toBe(story.title);
      expect(Array.from(container.querySelectorAll('nav')).map(element => element.innerHTML)).toEqual(navigation);
      expect(screen.queryByText('Breaking fixture')).toBeNull();
      expect(screen.queryByText('common.appStore')).toBeNull();
    } finally {
      unmount();
      jest.useRealTimers();
      (fetchPublicNews as jest.Mock).mockReset().mockResolvedValue({ items: [], endpoint: '/api/public/news' });
    }
  });

  test('single initial fetch survives StrictMode and preserves version and background semantics', async () => {
    (fetchPublicSettings as jest.Mock).mockResolvedValue(published());
    const { result, rerender } = renderHook(() => usePublicSettings(), { wrapper });
    await act(async () => {});
    expect(fetchPublicSettings).toHaveBeenCalledTimes(1);
    const original = result.current.settings;
    rerender();
    expect(fetchPublicSettings).toHaveBeenCalledTimes(1);
    (fetchPublicSettings as jest.Mock).mockResolvedValue(published('426', true));
    await act(async () => { await result.current.refetch(); });
    expect(result.current.settings).toBe(original);
    expect(result.current.settings?.modules.appPromo.enabled).toBe(false);
    (fetchPublicSettings as jest.Mock).mockRejectedValue(new Error('unavailable'));
    await act(async () => { dispatchPublicDataRefresh({ version: '427', previousVersion: '426', source: 'test' }); });
    expect(result.current.settings).toBe(original);
    (fetchPublicSettings as jest.Mock).mockResolvedValue(published('428', true));
    await act(async () => { dispatchPublicDataRefresh({ version: '428', previousVersion: '427', source: 'test' }); });
    expect(result.current.settings?.version).toBe('428');
    expect(result.current.settings?.modules.appPromo.enabled).toBe(true);
    expect(result.current.settings?.modules.appPromo.order).toBe(7);
    expect(result.current.settings?.modules.footer.enabled).toBe(false);
    expect(fetchPublicSettings).toHaveBeenCalledTimes(4);
  });
});