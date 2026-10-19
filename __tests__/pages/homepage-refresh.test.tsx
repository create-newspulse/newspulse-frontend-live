import React from 'react';
import { act, render, renderHook, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import HomePage, { getServerSideProps } from '../../pages/index';
import { PublicSettingsProvider, usePublicSettings } from '../../src/context/PublicSettingsContext';
import { fetchPublicSettings, fetchPublishedPublicSettings, normalizePublicSettings } from '../../src/lib/publicSettings';
import { dispatchPublicDataRefresh } from '../../lib/publicDataRefresh';
import { fetchPublicNews } from '../../lib/publicNewsApi';
import AdSlot from '../../src/components/ads/AdSlot';
import HomeRightRail from '../../components/home/HomeRightRail';
import { usePublicAdSlot } from '../../hooks/usePublicAdSlot';
import { usePublicBroadcastTicker, type PublicBroadcastTickerState } from '../../hooks/usePublicBroadcastTicker';
import { normalizePublicBroadcast } from '../../lib/publicBroadcast';
import { usePublicTickerAds } from '../../hooks/usePublicTickerAds';
import { isSafeMode } from '../../utils/safeMode';
import * as i18n from '../../src/i18n/LanguageProvider';
import * as storyTitleHook from '../../lib/storyTitleHook';
import { useHomeLowerAdAlignment } from '../../hooks/useHomeLowerAdAlignment';
import { readTrendingTopics } from '../../lib/getTrendingTopics';
import { DEFAULT_TRENDING_TOPICS } from '../../src/config/trendingTopics';
import { topicNames } from '../fixtures/editorialTopics';

jest.mock('next/router', () => ({ useRouter: () => ({ asPath: '/', pathname: '/', locale: 'en', push: jest.fn(), replace: jest.fn() }) }));
jest.mock('next/head', () => ({ __esModule: true, default: () => null }));
jest.mock('../../src/i18n/LanguageProvider', () => ({ __esModule: true, ...jest.requireActual('../../src/i18n/LanguageProvider'), useI18n: () => ({ lang: 'en', t: (key: string) => key, setLang: jest.fn() }) }));
jest.mock('../../src/consent/CookieConsentProvider', () => ({ useCookieConsent: () => ({ hasCategoryConsent: () => false, openPreferences: jest.fn() }) }));
jest.mock('../../src/components/ads/AdSlot', () => ({
  ...jest.requireActual('../../src/components/ads/AdSlot'),
  __esModule: true,
  default: jest.fn(() => null),
}));
jest.mock('../../components/home/HomeRightRail', () => ({
  __esModule: true,
  articleToHomeRightRailFeedItem: jest.requireActual('../../components/home/HomeRightRail').articleToHomeRightRailFeedItem,
  default: jest.fn(() => null),
}));
jest.mock('../../hooks/usePublicFounderToggles', () => ({ usePublicFounderToggles: () => ({ toggles: {} }) }));
jest.mock('../../hooks/usePublicBroadcastTicker', () => ({ usePublicBroadcastTicker: jest.fn() }));
jest.mock('../../hooks/usePublicTickerAds', () => ({ usePublicTickerAds: jest.fn() }));
jest.mock('../../utils/safeMode', () => ({ isSafeMode: jest.fn(() => false) }));
jest.mock('../../hooks/usePublicAdSlot', () => ({ usePublicAdSlot: jest.fn(() => ({ enabled: false, ad: null, isLoading: false, hasResolved: true })) }));
jest.mock('../../lib/publicNewsApi', () => ({ ...jest.requireActual('../../lib/publicNewsApi'), fetchPublicNews: jest.fn(async () => ({ items: [], endpoint: '/api/public/news' })) }));
jest.mock('../../lib/publicSponsoredFeature', () => ({ ...jest.requireActual('../../lib/publicSponsoredFeature'), fetchHomepageSponsoredFeature: jest.fn(async () => null) }));
jest.mock('../../lib/getTrendingTopics', () => ({ readTrendingTopics: jest.fn(async () => ({ items: [], authoritative: true })) }));
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

describe('homepage lower-ad geometry alignment', () => {
  const property = '--home-lower-ad-offset';
  let root: HTMLDivElement;
  let naturalBottom: number;
  let freshBottom: number;
  let resizeCallbacks: ResizeObserverCallback[];
  let frames: Map<number, FrameRequestCallback>;
  let nextFrame: number;
  let originalObserver: typeof ResizeObserver;
  let originalWidth: number;

  const lower = () => root.querySelector<HTMLElement>('.home-lower-ad')!;
  const offset = () => Number.parseFloat(lower()?.style.getPropertyValue(property) || '0');
  const flush = () => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach((callback) => callback(0));
  };
  const resize = () => {
    act(() => {
      resizeCallbacks.forEach((callback) => callback([], {} as ResizeObserver));
      flush();
    });
  };
  const mount = (locale = 'en') => renderHook(({ lang }) => {
    const refs = useHomeLowerAdAlignment(lang, true);
    refs.leftRailRef.current = root.querySelector('.home-left');
    refs.freshStoriesRef.current = root.querySelector('.fresh-stories-card');
    return refs;
  }, { initialProps: { lang: locale }, wrapper: ({ children }) => <React.StrictMode>{children}</React.StrictMode> });

  beforeEach(() => {
    originalWidth = window.innerWidth;
    originalObserver = global.ResizeObserver;
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1920, writable: true });
    naturalBottom = 3638.15;
    freshBottom = 3713.413;
    resizeCallbacks = [];
    frames = new Map();
    nextFrame = 0;
    global.ResizeObserver = class {
      constructor(callback: ResizeObserverCallback) { resizeCallbacks.push(callback); }
      observe = jest.fn();
      unobserve = jest.fn();
      disconnect = jest.fn();
    } as unknown as typeof ResizeObserver;
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation((frame) => { frames.delete(frame); });
    root = document.createElement('div');
    root.innerHTML = '<aside class="home-left"><div><div class="home-upper-ad"></div><div class="utility"></div><div class="home-lower-ad"></div></div></aside><main><div class="top-story-card"></div><div class="fresh-stories-card"></div></main><aside class="home-right"></aside>';
    document.body.append(root);
    jest.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(this: HTMLElement) {
      if (this.classList.contains('home-right')) throw new Error('Right rail must not be measured');
      const bottom = this.classList.contains('fresh-stories-card') ? freshBottom
        : this.classList.contains('home-lower-ad') ? naturalBottom + (window.innerWidth > 1200 ? offset() : 0) : 1000;
      return { top: bottom - 334.5, bottom, width: 300, height: 334.5, left: 0, right: 300, x: 0, y: bottom - 334.5, toJSON: () => ({}) };
    });
    const computed = window.getComputedStyle.bind(window);
    jest.spyOn(window, 'getComputedStyle').mockImplementation((element) => {
      const style = computed(element);
      if (element.classList.contains('home-lower-ad')) {
        Object.defineProperty(style, 'marginTop', { value: `${window.innerWidth > 1200 ? offset() : 0}px` });
      }
      return style;
    });
  });

  afterEach(() => {
    root.remove();
    global.ResizeObserver = originalObserver;
    Object.defineProperty(window, 'innerWidth', { value: originalWidth });
    jest.restoreAllMocks();
  });

  describe.each(['en', 'hi', 'gu'])('%s', (locale) => {
    test.each([1280, 1440, 1536, 1920, 1024, 768, 375, 320])('only aligns desktop at %ipx without accumulating or following the right rail', (width) => {
      window.innerWidth = width;
      freshBottom = locale === 'gu' ? 3640.838 : 3713.413;
      const result = mount(locale);
      const expected = width > 1200 ? freshBottom - naturalBottom : 0;
      expect(offset()).toBeCloseTo(expected, 3);
      for (let iteration = 0; iteration < 5; iteration++) resize();
      expect(offset()).toBeCloseTo(expected, 3);
      expect(root.querySelector('.utility')?.getAttribute('style')).toBeNull();
      result.unmount();
      expect(offset()).toBe(0);
      expect(frames.size).toBe(0);
    });
  });

  test.each(['upper', 'lower', 'both'])('keeps natural layout with %s ads absent, including asynchronous removal and insertion', async (missing) => {
    const upperAd = root.querySelector('.home-upper-ad')!;
    const lowerAd = lower();
    const stack = lowerAd.parentElement!;
    const result = mount();
    expect(offset()).toBeGreaterThan(0);
    await act(async () => {
      if (missing !== 'lower') upperAd.remove();
      if (missing !== 'upper') lowerAd.remove();
      await Promise.resolve();
      flush();
    });
    expect(lowerAd.style.getPropertyValue(property)).toBe('');
    await act(async () => {
      if (missing !== 'lower') stack.prepend(upperAd);
      if (missing !== 'upper') stack.append(lowerAd);
      await Promise.resolve();
      flush();
    });
    expect(offset()).toBeCloseTo(freshBottom - naturalBottom, 3);
    result.unmount();
  });

  test('clears alignment for short content, tolerance, resized ads, desktop/mobile resize and locale switches', () => {
    const result = mount();
    freshBottom = 2000;
    resize();
    expect(offset()).toBe(0);
    freshBottom = naturalBottom + 0.75;
    resize();
    expect(offset()).toBe(0);
    freshBottom = 3800;
    naturalBottom += 100;
    resize();
    expect(offset()).toBeCloseTo(3800 - naturalBottom, 3);
    window.innerWidth = 1024;
    act(() => { window.dispatchEvent(new Event('resize')); flush(); });
    expect(offset()).toBe(0);
    window.innerWidth = 1920;
    freshBottom = naturalBottom + 2.688;
    result.rerender({ lang: 'gu' });
    expect(offset()).toBeCloseTo(2.688, 3);
    result.unmount();
  });
});

describe('homepage category colour identity', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe.each([
    ['regional', 'rgb(101, 163, 13)'],
    ['national', 'rgb(37, 99, 235)'],
    ['international', 'rgb(124, 58, 237)'],
    ['glamour', 'rgb(192, 38, 211)'],
    ['pulse-dialogue', 'rgb(37, 99, 235)'],
  ])('%s', (category, color) => {
    test.each(['en', 'hi', 'gu'] as const)('%s preserves translated labels and both lead/fresh headline colours', (locale) => {
      const actual = jest.requireActual<typeof import('../../src/i18n/LanguageProvider')>('../../src/i18n/LanguageProvider');
      jest.spyOn(i18n, 'useI18n').mockImplementation(actual.useI18n);
      const colorLookup = jest.spyOn(storyTitleHook, 'getStoryTitleHookColor');
      const label = actual.getMessagesForLang(locale).categories[category === 'pulse-dialogue' ? 'pulseDialogue' : category] as string;
      const lead = {
        _id: 'colour-lead', slug: 'colour-lead', category, language: locale,
        title: `${label}: lead headline remainder`, content: '<p>Lead body</p>',
        status: 'published', publishedAt: '2026-10-01T10:00:00.000Z',
      };
      const fresh = {
        ...lead, _id: 'colour-fresh', id: 'colour-fresh', slug: 'colour-fresh',
        lang: locale, title: `${label}: fresh headline remainder`, desc: 'Fresh summary',
      };
      const html = renderToString(
        <i18n.LanguageProvider initialLang={locale}>
          <PublicSettingsProvider initialSettings={published()}>
            <HomePage {...props} initialTopStory={lead} initialFreshStories={[fresh]} />
          </PublicSettingsProvider>
        </i18n.LanguageProvider>
      );
      const root = document.createElement('div');
      root.innerHTML = html;
      const leadHook = root.querySelector<HTMLSpanElement>('#top-story h1 > span');
      const freshHook = root.querySelector<HTMLSpanElement>('.fresh-stories-card h3 > span');

      expect(leadHook?.style.color).toBe(color);
      expect(freshHook?.style.color).toBe(color);
      expect(leadHook?.textContent).toBe(`${label}:`);
      expect(freshHook?.textContent).toBe(`${label}:`);
      expect(root.querySelector('.fresh-stories-card article span.rounded-full')?.textContent).toBe(label);
      expect(Array.from(root.querySelectorAll('#top-story .truncate')).some((node) => node.textContent === label)).toBe(true);
      expect(colorLookup).toHaveBeenCalledWith(category);
      expect(colorLookup).not.toHaveBeenCalledWith(label);
    });
  });
});

describe('homepage Fresh Stories presentation', () => {
  type Locale = 'en' | 'hi' | 'gu';

  function storiesFor(locale: Locale) {
    const categories = ['national', 'regional', 'international', 'glamour'];
    return Array.from({ length: 29 }, (_, index) => {
      const publishedAt = new Date(Date.parse('2026-10-01T12:00:00Z') - index * 60_000).toISOString();
      return {
        _id: `fresh-${index}`, id: `fresh-${index}`, slug: `fresh-${index}`,
        language: locale, lang: locale, status: 'published',
        title: `Fresh story ${index}`, summary: `Summary for fresh story ${index}`,
        desc: `Summary for fresh story ${index}`, content: '<p>Published story body.</p>',
        category: categories[index % categories.length],
        imageUrl: '/logo.png', imageSrc: '/logo.png',
        publishedAt, iso: publishedAt,
        updatedAt: new Date(Date.parse('2026-10-02T12:00:00Z') + index * 60_000).toISOString(),
      };
    });
  }

  async function renderFreshStories(locale: Locale, stories = storiesFor(locale)) {
    const actual = jest.requireActual<typeof import('../../src/i18n/LanguageProvider')>('../../src/i18n/LanguageProvider');
    jest.spyOn(i18n, 'useI18n').mockImplementation(actual.useI18n);
    jest.mocked(fetchPublicSettings).mockResolvedValue(published());
    jest.mocked(fetchPublicNews).mockImplementation(async (options) => ({
      items: options?.category === 'web-stories' || (!options?.category && !options?.extraQuery?.spotlight) ? stories : [],
      meta: {},
      endpoint: '/api/public/news',
    }));
    let result!: ReturnType<typeof render>;
    await act(async () => {
      result = render(
        <i18n.LanguageProvider initialLang={locale}>
          <PublicSettingsProvider initialSettings={published()}>
            <HomePage {...props} initialTopStory={stories[0]} initialFreshStories={stories} />
          </PublicSettingsProvider>
        </i18n.LanguageProvider>
      );
    });
    return result.container;
  }

  function freshCards(container: HTMLElement) {
    return Array.from(container.querySelectorAll<HTMLElement>('.fresh-stories-card article'));
  }

  function hrefFor(locale: Locale, index: number) {
    return `${locale === 'en' ? '' : `/${locale}`}/news/fresh-${index}`;
  }

  beforeEach(() => {
    jest.mocked(fetchPublicNews).mockClear();
    jest.mocked(AdSlot).mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.mocked(fetchPublicNews).mockReset().mockResolvedValue({ items: [], meta: {}, endpoint: '/api/public/news' });
    jest.mocked(fetchPublicSettings).mockReset();
  });

  describe.each(['en', 'hi', 'gu'] as const)('%s', (locale) => {
    test('keeps 19 consecutive ordered stories and excludes the unchanged Top Story', async () => {
      const stories = storiesFor(locale);
      stories.splice(5, 0, stories[4]);
      const container = await renderFreshStories(locale, stories);
      const hrefs = freshCards(container).map((card) => card.closest('a')?.getAttribute('href'));

      expect(hrefs).toEqual(Array.from({ length: 19 }, (_, index) => hrefFor(locale, index + 1)));
      expect(new Set(hrefs).size).toBe(19);
      expect(hrefs).not.toContain(hrefFor(locale, 0));
      expect(hrefs).not.toContain(hrefFor(locale, 20));
      expect(container.querySelector('#top-story h1')?.textContent).toBe('Fresh story 0');
      expect(container.querySelector(`#top-story a[href="${hrefFor(locale, 0)}"]`)).not.toBeNull();
      expect(container.querySelectorAll('#top-story')).toHaveLength(1);
      expect(container.querySelector('.home-grid')?.classList.contains('home-grid--three')).toBe(true);
      expect(container.querySelector('#top-story')?.nextElementSibling?.classList.contains('fresh-stories-card')).toBe(true);
      expect(jest.mocked(AdSlot).mock.calls.map(([slotProps]) => slotProps.slot)).toEqual(expect.arrayContaining([
        'HOME_LEFT_300x600', 'HOME_LEFT_300x250', 'HOME_BILLBOARD_970x250',
      ]));
    });

    test('uses four existing summary cards followed by fifteen compact cards', async () => {
      const container = await renderFreshStories(locale);
      const cards = freshCards(container);
      expect(cards).toHaveLength(19);
      expect(cards.filter((card) => card.classList.contains('md:grid-cols-[1fr_148px]'))).toHaveLength(4);
      expect(cards.filter((card) => card.classList.contains('md:grid-cols-[1fr_116px]'))).toHaveLength(15);
      cards.forEach((card, index) => {
        expect(card.classList.contains('grid-cols-[1fr_96px]')).toBe(true);
        expect(card.classList.contains(index < 4 ? 'md:grid-cols-[1fr_148px]' : 'md:grid-cols-[1fr_116px]')).toBe(true);
        expect(card.querySelector('h3')?.classList.contains(index < 4 ? 'text-lg' : 'text-base')).toBe(true);
        expect(card.textContent?.includes(`Summary for fresh story ${index + 1}`)).toBe(index < 4);
      });
      expect(cards[3].closest('a')?.getAttribute('href')).toBe(hrefFor(locale, 4));
      expect(cards[4].closest('a')?.getAttribute('href')).toBe(hrefFor(locale, 5));
    });

    test('keeps a summary-less fourth story compact without substituting the fifth', async () => {
      const stories = storiesFor(locale);
      stories[4] = { ...stories[4], summary: '   ', desc: '   ' };
      const container = await renderFreshStories(locale, stories);
      const cards = freshCards(container);
      expect(cards.map((card) => card.closest('a')?.getAttribute('href')))
        .toEqual(Array.from({ length: 19 }, (_, index) => hrefFor(locale, index + 1)));
      expect(cards.filter((card) => card.classList.contains('md:grid-cols-[1fr_148px]'))).toHaveLength(3);
      expect(cards.filter((card) => card.classList.contains('md:grid-cols-[1fr_116px]'))).toHaveLength(16);
      expect(cards[3].classList.contains('md:grid-cols-[1fr_116px]')).toBe(true);
      expect(cards[4].textContent).not.toContain('Summary for fresh story 5');
    });

    test('preserves the downstream exclusion boundary and existing API limits', async () => {
      const container = await renderFreshStories(locale);
      const section = container.querySelector('.home-container > .mt-8.grid');
      expect(section).not.toBeNull();
      const sectionHrefs = Array.from(section!.querySelectorAll('a[href*="/news/"]')).map((link) => link.getAttribute('href'));
      expect([...new Set(sectionHrefs)]).toEqual(Array.from({ length: 5 }, (_, index) => hrefFor(locale, index + 23)));
      const mainReads = jest.mocked(fetchPublicNews).mock.calls
        .map(([options]) => options)
        .filter((options) => !options?.category && !options?.extraQuery?.spotlight);
      expect(mainReads).toHaveLength(1);
      expect(mainReads[0]).toEqual(expect.objectContaining({ language: locale, limit: 40 }));
      expect(mainReads[0]).not.toHaveProperty('page');
    });

    test('preserves the existing image-priority sequence rather than adding a new sort', async () => {
      const stories = storiesFor(locale);
      stories[2] = { ...stories[2], imageUrl: '', imageSrc: '' };
      const container = await renderFreshStories(locale, stories);
      expect(freshCards(container).map((card) => card.closest('a')?.getAttribute('href')))
        .toEqual([1, ...Array.from({ length: 18 }, (_, index) => index + 3)].map((index) => hrefFor(locale, index)));
    });
  });
});

function broadcastState(overrides: Partial<PublicBroadcastTickerState> = {}): PublicBroadcastTickerState {
  return {
    broadcast: normalizePublicBroadcast({
      settings: { breaking: { enabled: false, speedSec: 18 }, live: { enabled: true, speedSec: 24 } },
      items: { breaking: [{ text: 'Breaking fixture' }], live: [{ text: 'Live fixture' }] },
    }),
    breakingTexts: ['Breaking fixture'],
    liveTexts: ['Live fixture'],
    breakingEnabled: false,
    liveEnabled: true,
    breakingSpeedSec: 18,
    liveSpeedSec: 24,
    isLoading: false,
    error: null,
    lastUpdatedAt: null,
    source: 'poll',
    ...overrides,
  };
}

beforeEach(() => {
  jest.mocked(usePublicBroadcastTicker).mockReturnValue(broadcastState());
  jest.mocked(usePublicTickerAds).mockReturnValue({ ads: [], isLoading: false, error: null, lastUpdatedAt: null, refetch: jest.fn() });
  jest.mocked(isSafeMode).mockReturnValue(false);
});

describe('homepage hybrid Trending Strip', () => {
  beforeEach(() => {
    jest.mocked(fetchPublicSettings).mockResolvedValue(published());
    jest.mocked(fetchPublicNews).mockResolvedValue({ items: [], meta: {}, endpoint: '/api/public/news' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.mocked(readTrendingTopics).mockReset().mockResolvedValue({ items: [], authoritative: true });
  });

  test.each(['en', 'hi', 'gu'] as const)('preserves %s backend labels and all nine dictionary shortcuts in one strip', async (lang) => {
    const actual = jest.requireActual<typeof i18n>('../../src/i18n/LanguageProvider');
    jest.spyOn(i18n, 'useI18n').mockImplementation(actual.useI18n);
    const editorial = { key: 'navratri-2026', label: topicNames[lang], href: '/topic/navratri-2026', colorKey: 'sports' as const, source: 'editorial' as const };
    jest.mocked(readTrendingTopics).mockClear().mockResolvedValue({ items: [editorial, ...DEFAULT_TRENDING_TOPICS], authoritative: true });
    let container!: HTMLElement;
    await act(async () => {
      container = render(
        <i18n.LanguageProvider initialLang={lang}>
          <PublicSettingsProvider initialSettings={published()}>
            <HomePage {...props} />
          </PublicSettingsProvider>
        </i18n.LanguageProvider>
      ).container;
    });
    expect(container.querySelectorAll('.trending-shell')).toHaveLength(1);
    const links = Array.from(container.querySelectorAll('.trending-shell a'));
    expect(links.map((link) => link.getAttribute('href'))).toEqual([editorial.href, ...DEFAULT_TRENDING_TOPICS.map((topic) => topic.href)]);
    expect(links[0].textContent).toBe(topicNames[lang]);
    expect(links[1].textContent).toBe(actual.getMessagesForLang(lang).trending.breaking);
    expect(container.querySelectorAll('.trending-shell a[href="/business"]')).toHaveLength(3);
    expect(jest.mocked(readTrendingTopics)).toHaveBeenCalledTimes(1);
    expect(jest.mocked(readTrendingTopics)).toHaveBeenCalledWith(lang, expect.any(AbortSignal));
  });

  test.each(['en', 'hi', 'gu'] as const)('%s mounted homepage strip refreshes labels and retains them on fallback', async (lang) => {
    const actual = jest.requireActual<typeof i18n>('../../src/i18n/LanguageProvider');
    jest.spyOn(i18n, 'useI18n').mockImplementation(actual.useI18n);
    const editorial = { key: 'navratri-2026', label: topicNames[lang], href: '/topic/navratri-2026', colorKey: 'sports' as const, source: 'editorial' as const };
    jest.mocked(readTrendingTopics).mockClear().mockResolvedValue({ items: [editorial], authoritative: true });
    let container!: HTMLElement;
    await act(async () => {
      container = render(<i18n.LanguageProvider initialLang={lang}><PublicSettingsProvider initialSettings={published()}>
        <HomePage {...props} />
      </PublicSettingsProvider></i18n.LanguageProvider>).container;
    });
    const labels = () => Array.from(container.querySelectorAll('.trending-shell a')).map((link) => link.textContent);
    jest.mocked(readTrendingTopics).mockResolvedValue({ items: [{ ...editorial, label: `${topicNames[lang]} edited` }], authoritative: true });
    await act(async () => { dispatchPublicDataRefresh({ version: 'trending-edit', previousVersion: null, source: 'test' }); });
    expect(labels()).toEqual([`${topicNames[lang]} edited`]);
    jest.mocked(readTrendingTopics).mockResolvedValue({ items: DEFAULT_TRENDING_TOPICS, authoritative: false });
    await act(async () => { dispatchPublicDataRefresh({ version: 'trending-failure', previousVersion: 'trending-edit', source: 'test' }); });
    expect(labels()).toEqual([`${topicNames[lang]} edited`]);
    expect(jest.mocked(readTrendingTopics).mock.calls.map(([locale]) => locale)).toEqual([lang, lang, lang]);
  });
});

describe('homepage ad layout boundaries', () => {
  const slots = ['TOP_HOME_BILLBOARD_970x250', 'HOME_728x90', 'HOME_LEFT_300x600', 'HOME_LEFT_300x250', 'HOME_RIGHT_300x250', 'HOME_RIGHT_300x600', 'HOME_BILLBOARD_970x250', 'FOOTER_BANNER_728x90'];

  beforeEach(() => {
    jest.mocked(usePublicBroadcastTicker).mockReturnValue(broadcastState({ breakingEnabled: true }));
    jest.mocked(AdSlot).mockClear();
    jest.mocked(AdSlot).mockImplementation(jest.requireActual('../../src/components/ads/AdSlot').default);
    jest.mocked(HomeRightRail).mockImplementation(jest.requireActual('../../components/home/HomeRightRail').default);
  });

  afterEach(() => {
    jest.mocked(AdSlot).mockReset().mockImplementation(() => null);
    jest.mocked(HomeRightRail).mockReset().mockImplementation(() => <></>);
    jest.mocked(usePublicAdSlot).mockReset().mockReturnValue({ enabled: false, ad: null, isLoading: false, hasResolved: true });
  });

  test.each([
    { name: 'all slots ON', enabledSlots: slots, state: 'creative' },
    { name: 'premium top with independent billboard', enabledSlots: ['TOP_HOME_BILLBOARD_970x250', 'HOME_BILLBOARD_970x250'], state: 'creative' },
    { name: 'standard top with independent billboard and footer', enabledSlots: ['HOME_728x90', 'HOME_BILLBOARD_970x250', 'FOOTER_BANNER_728x90'], state: 'creative' },
    { name: 'non-clickable billboard', enabledSlots: ['HOME_BILLBOARD_970x250'], state: 'creative', isClickable: false },
    { name: 'only the tall left slot ON', enabledSlots: ['HOME_LEFT_300x600'], state: 'creative' },
    { name: 'only the small left slot ON', enabledSlots: ['HOME_LEFT_300x250'], state: 'creative' },
    { name: 'mixed slots ON', enabledSlots: ['HOME_LEFT_300x250', 'HOME_RIGHT_300x600', 'HOME_BILLBOARD_970x250'], state: 'creative' },
    { name: 'all slots OFF', enabledSlots: [], state: 'creative' },
    { name: 'enabled house ads', enabledSlots: slots, state: 'house' },
    { name: 'enabled loading placeholders', enabledSlots: slots, state: 'loading' },
  ])('$name preserves inventory, content order, and purposeful grid children', ({ enabledSlots, state, isClickable = true }) => {
    jest.mocked(usePublicAdSlot).mockImplementation(({ slot }) => ({
      enabled: enabledSlots.includes(slot),
      ad: state === 'creative' ? { imageUrl: '/logo.png', title: `Creative ${slot}`, isClickable, targetUrl: '/advertise' } : null,
      isLoading: state === 'loading',
      hasResolved: state !== 'loading',
    }));
    const settings = published();
    settings.modules.footer.enabled = true;
    settings.modules.snapshots.enabled = true;
    settings.modules.categoryStrip.order = 1;
    settings.tickers.breaking.enabled = true;
    settings.tickers.breaking.order = 2;
    settings.tickers.live.order = 3;
    const html = renderToString(<PublicSettingsProvider initialSettings={settings}><HomePage {...props} /></PublicSettingsProvider>);
    const document = new DOMParser().parseFromString(html, 'text/html');
    const leftGrid = document.querySelector('.home-left > .grid')!;
    const renderedSlots = Array.from(document.querySelectorAll('[data-ad-slot]')).map(element => element.getAttribute('data-ad-slot'));

    expect(leftGrid.querySelectorAll(':scope > .home-upper-ad')).toHaveLength(enabledSlots.includes('HOME_LEFT_300x600') ? 1 : 0);
    expect(leftGrid.querySelectorAll(':scope > .home-lower-ad')).toHaveLength(enabledSlots.includes('HOME_LEFT_300x250') ? 1 : 0);
    expect(leftGrid.querySelector('[style*="--home-lower-ad-offset"]')).toBeNull();

    const topSlot = state === 'creative' && enabledSlots.includes('TOP_HOME_BILLBOARD_970x250')
      ? 'TOP_HOME_BILLBOARD_970x250'
      : 'HOME_728x90';
    expect(renderedSlots).toEqual(slots.filter(slot =>
      enabledSlots.includes(slot)
      && (!['TOP_HOME_BILLBOARD_970x250', 'HOME_728x90'].includes(slot) || slot === topSlot)
      && (state === 'creative' || !/HOME_(LEFT|RIGHT)_/.test(slot))
    ));
    const topFrames = document.querySelectorAll('[data-ad-slot="TOP_HOME_BILLBOARD_970x250"], [data-ad-slot="HOME_728x90"]');
    expect(topFrames.length).toBeLessThanOrEqual(1);
    const header = document.querySelector('.header-shell')!;
    const categoryNav = document.querySelector('.category-nav-shell')!;
    const tickers = document.querySelector('.ticker-wrapper')!;
    const trending = document.querySelector('.trending-shell')!;
    expect(header.compareDocumentPosition(categoryNav)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(categoryNav.compareDocumentPosition(tickers)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(tickers.textContent).toContain('Breaking fixture');
    expect(tickers.textContent).toContain('Live fixture');
    expect(tickers.textContent!.indexOf('Breaking fixture')).toBeLessThan(tickers.textContent!.indexOf('Live fixture'));
    expect(tickers.compareDocumentPosition(trending)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(trending.compareDocumentPosition(document.querySelector('.home-grid')!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    if (topFrames.length) {
      const topFrame = topFrames[0];
      expect(topFrame.parentElement?.className).toBe(`home-shell mx-auto mt-3${state === 'creative' ? ' not-prose' : ''}`);
      expect(tickers.compareDocumentPosition(topFrame)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(topFrame.compareDocumentPosition(trending)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
      expect(topFrame.querySelector<HTMLElement>('[style*="aspect-ratio"]')?.style.aspectRatio)
        .toBe(topSlot === 'HOME_728x90' ? '728 / 90' : '970 / 250');
    }
    if (state !== 'creative') {
      for (const slot of slots.filter(slot => /HOME_(LEFT|RIGHT)_/.test(slot))) {
        expect(document.querySelector(`a[href="/advertise?slot=${slot}"]`)).not.toBeNull();
      }
    }
    expect(document.querySelector('#top-story')).not.toBeNull();
    expect(document.querySelector('.fresh-stories-card')).not.toBeNull();
    expect(leftGrid.textContent).toContain('home.exploreCategories');
    expect(leftGrid.textContent).toContain('home.snapshotsTitle');
    const marketLabel = Array.from(leftGrid.querySelectorAll('div')).find(element => element.textContent === 'home.snapshotMarkets');
    const goldLabel = Array.from(leftGrid.querySelectorAll('div')).find(element => element.textContent === 'home.snapshotGold');
    expect(marketLabel?.nextElementSibling?.textContent).toBe('— unavailable');
    expect(goldLabel?.nextElementSibling?.textContent).toBe('₹ — (api)');
    expect(document.querySelector('.home-right')?.textContent).toContain('home.youthDesk');
    expect(document.querySelector('.home-grid')!.compareDocumentPosition(document.querySelector('.post-home-grid-ads')!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(document.querySelector('.post-home-grid-ads')!.compareDocumentPosition(document.querySelector('a[href="/monthly-compliance"]')!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    expect(jest.mocked(AdSlot).mock.calls.map(([slotProps]) => slotProps)).toEqual(expect.arrayContaining([
      expect.objectContaining({ slot: 'HOME_BILLBOARD_970x250', variant: 'billboard970x250', className: 'mx-auto w-full' }),
      expect.objectContaining({ slot: 'FOOTER_BANNER_728x90', variant: 'banner728x90', className: 'mx-auto w-full max-w-[1440px] px-4 md:px-8 my-2' }),
    ]));

    const billboard = document.querySelector<HTMLElement>('[data-ad-slot="HOME_BILLBOARD_970x250"]');
    if (enabledSlots.includes('HOME_BILLBOARD_970x250')) {
      expect(billboard?.parentElement?.classList.contains('w-full')).toBe(true);
      expect(billboard?.parentElement?.parentElement?.classList.contains('post-home-grid-ads')).toBe(true);
      expect(billboard?.querySelector<HTMLElement>('[style*="aspect-ratio"]')?.style.aspectRatio).toBe('970 / 250');
      const image = billboard?.querySelector('img');
      if (state === 'creative') {
        expect(image?.getAttribute('src')).toBe('/logo.png');
        expect(image?.style.objectFit).toBe('cover');
        const link = image?.closest('a');
        if (isClickable) {
          expect(link?.getAttribute('href')).toBe('/advertise');
          expect(link?.getAttribute('target')).toBe('_blank');
          expect(link?.getAttribute('rel')).toBe('nofollow sponsored noopener noreferrer');
        } else {
          expect(link).toBeNull();
        }
      } else {
        expect(image).toBeNull();
        if (state === 'loading') {
          expect(billboard?.querySelector('.animate-pulse')).not.toBeNull();
        } else {
          expect(billboard?.querySelector('a[href="/advertise?slot=HOME_BILLBOARD_970x250"]')).not.toBeNull();
        }
      }
    } else {
      expect(billboard).toBeNull();
    }

    for (const slot of ['HOME_LEFT_300x600', 'HOME_LEFT_300x250']) {
      const frame = document.querySelector<HTMLElement>(`[data-ad-slot="${slot}"]`);
      if (enabledSlots.includes(slot) && state === 'creative') {
        expect(frame?.style.maxWidth).toBe('300px');
        expect(frame?.querySelector<HTMLElement>('[style*="aspect-ratio"]')?.style.aspectRatio).toBe(slot.endsWith('600') ? '300 / 600' : '300 / 250');
        expect(frame?.querySelector<HTMLImageElement>('img')?.style.objectFit).toBe('contain');
        expect(frame?.textContent).toContain('AD');
      } else if (!enabledSlots.includes(slot)) {
        expect(frame).toBeNull();
        expect(leftGrid.textContent).not.toContain(`Creative ${slot}`);
      }
    }

    expect(Array.from(leftGrid.children).filter(element => element.childNodes.length === 0)).toHaveLength(0);
    if (!enabledSlots.length) {
      expect(leftGrid.children).toHaveLength(2);
      expect(leftGrid.textContent).not.toMatch(/advertisement|advertise here/i);
    }
  });
});

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
    jest.mocked(usePublicBroadcastTicker).mockReturnValue(broadcastState({ isLoading: true, breakingEnabled: null, liveEnabled: null }));
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
    expect(screen.getAllByText('Live fixture').length).toBeGreaterThan(0);
    await act(async () => { resolveSettings(published()); });
    expect(screen.queryByText('Breaking fixture')).toBeNull();
    expect(screen.queryByText('common.appStore')).toBeNull();
    expect(container.querySelector('a[href="/monthly-compliance"]')).toBeNull();
    expect(screen.getAllByText('Live fixture').length).toBeGreaterThan(0);
    expect(container.querySelector('a[href="/national"]')).not.toBeNull();
    expect(fetchPublicSettings).toHaveBeenCalledTimes(1);
    expect(container.querySelector('#top-story .animate-pulse')).toBeNull();
    expect(container.querySelector('#top-story [role="status"]')?.textContent).toBe('categoryPage.noStoriesYet');
    expect(container.querySelector('#top-story h1')).toBeNull();
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

  test('homepage unavailable state survives 503 trigger bursts and is replaced by one successful retry', async () => {
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
      expect(container.querySelector('#top-story [role="alert"]')?.textContent).toBe('categoryPage.unableToLoadTitle');
      expect(container.querySelector('#top-story h1, #top-story a, #top-story button')).toBeNull();
      const unavailableMarkup = container.querySelector('#top-story')?.innerHTML;
      const navigation = Array.from(container.querySelectorAll('nav')).map(element => element.innerHTML);
      for (let iteration = 0; iteration < 10; iteration++) {
        await act(async () => {
          window.dispatchEvent(new Event('focus'));
          document.dispatchEvent(new Event('visibilitychange'));
          dispatchPublicDataRefresh({ version: String(iteration), previousVersion: null, source: 'test' });
        });
      }
      expect(attempts).toBe(1);
      expect(container.querySelector('#top-story')?.innerHTML).toBe(unavailableMarkup);
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

describe.each(['en', 'hi', 'gu'] as const)('homepage truthful read states (%s)', (lang) => {
  const actualI18n = jest.requireActual<typeof i18n>('../../src/i18n/LanguageProvider');
  const messages = actualI18n.getMessagesForLang(lang);
  const emptyResponse = { items: [], meta: {}, endpoint: '/api/public/news' };
  const story = {
    _id: `reported-${lang}`, slug: `reported-${lang}`, title: `Reported lead ${lang}`,
    content: '<p>Reported article content.</p>', summary: 'Reported article summary.',
    language: lang, status: 'published', category: 'national', publishedAt: '2026-10-01T10:00:00Z',
  };
  const storyHref = `${lang === 'en' ? '' : `/${lang}`}/news/${story.slug}`;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.spyOn(i18n, 'useI18n').mockImplementation(actualI18n.useI18n);
    jest.spyOn(global, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ items: [] }), { status: 200 }));
    jest.mocked(fetchPublicSettings).mockResolvedValue(published());
    jest.mocked(fetchPublicNews).mockReset().mockResolvedValue(emptyResponse);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
    jest.mocked(fetchPublicNews).mockReset().mockResolvedValue(emptyResponse);
  });

  function renderHomepage(initialProps: Partial<React.ComponentProps<typeof HomePage>> = {}) {
    return render(
      <i18n.LanguageProvider initialLang={lang}>
        <PublicSettingsProvider initialSettings={published()}>
          <HomePage {...props} initialFreshStories={null} {...initialProps} />
        </PublicSettingsProvider>
      </i18n.LanguageProvider>
    );
  }

  function refreshHomepage() {
    dispatchPublicDataRefresh({ version: '3b1-test', previousVersion: null, source: 'test' });
  }

  function expectNeutralState(container: HTMLElement, role: 'alert' | 'status', message: string) {
    const region = container.querySelector('#top-story');
    expect(region?.querySelector(`[role="${role}"]`)?.textContent).toBe(message);
    expect(region?.querySelector('h1, a, button, time, img')).toBeNull();
    expect(region?.querySelector('.animate-pulse')).toBeNull();
    expect(region?.textContent).not.toMatch(/News Pulse Front Page|Live now|Updated|Homepage|News Pulse/);
  }

  test.each(['returned', 'rejected'] as const)('cold %s failure is unavailable, not a fabricated article', async (failure) => {
    jest.mocked(fetchPublicNews).mockImplementation(async (options) => {
      if (!options.homepageRecovery) return emptyResponse;
      if (failure === 'rejected') throw new Error('Read unavailable');
      return { ...emptyResponse, error: 'API 503', status: 503 };
    });
    const { container } = renderHomepage();
    await act(async () => {});
    expectNeutralState(container, 'alert', messages.categoryPage.unableToLoadTitle);
    expect(jest.mocked(HomeRightRail).mock.calls.at(-1)?.[0].latestReadError).toBe(true);
  });

  test('successful empty response produces a genuine empty state', async () => {
    const { container } = renderHomepage({ initialFreshStories: [] });
    expectNeutralState(container, 'status', messages.categoryPage.noStoriesYet);
    await act(async () => {});
    expectNeutralState(container, 'status', messages.categoryPage.noStoriesYet);
    expect(jest.mocked(HomeRightRail).mock.calls.at(-1)?.[0].latestReadError).toBe(false);
  });

  test('pending read keeps neutral skeletons and resolves to an empty state', async () => {
    let resolveRead!: (result: Awaited<ReturnType<typeof fetchPublicNews>>) => void;
    jest.mocked(fetchPublicNews).mockImplementation((options) => options.homepageRecovery
      ? new Promise(resolve => { resolveRead = resolve; })
      : Promise.resolve(emptyResponse));
    const { container } = renderHomepage();
    await act(async () => {});
    expect(container.querySelector('#top-story .animate-pulse')).not.toBeNull();
    expect(container.querySelector('#top-story h1, #top-story a, #top-story [role="alert"]')).toBeNull();
    await act(async () => { resolveRead(emptyResponse); });
    expectNeutralState(container, 'status', messages.categoryPage.noStoriesYet);
  });

  test('background failure after an empty success becomes unavailable without creating a story', async () => {
    const { container } = renderHomepage({ initialFreshStories: [] });
    await act(async () => {});
    expectNeutralState(container, 'status', messages.categoryPage.noStoriesYet);
    jest.mocked(fetchPublicNews).mockImplementation(async (options) => options.homepageRecovery
      ? { ...emptyResponse, error: 'API 503', status: 503 }
      : emptyResponse);
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expectNeutralState(container, 'alert', messages.categoryPage.unableToLoadTitle);
  });

  test('renders same-ID localized edits and images without changing publication time or article URL', async () => {
    const localized = {
      title: `${topicNames[lang]} original`,
      summary: `${topicNames[lang]} original summary`,
      content: `<p>${topicNames[lang]} original body</p>`,
    };
    const current = {
      ...story, sourceLanguage: lang === 'en' ? 'gu' : 'en',
      translationStatus: { [lang]: 'APPROVED' }, translations: { [lang]: localized },
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/original-home-cover.jpg',
    };
    const changedFields = {
      title: `${topicNames[lang]} edited`,
      summary: `${topicNames[lang]} edited summary`,
      content: `<p>${topicNames[lang]} edited body</p>`,
    };
    let currentRead = current;
    jest.mocked(fetchPublicNews).mockImplementation(async (options) =>
      options.homepageRecovery ? { ...emptyResponse, items: [currentRead] } : emptyResponse
    );
    const { container } = renderHomepage({ initialTopStory: current, initialFreshStories: [current] });
    await act(async () => {});
    expect(container.querySelector('#top-story h1')?.textContent).toContain(localized.title);
    currentRead = {
      ...current, translations: { [lang]: changedFields },
      imageUrl: 'https://res.cloudinary.com/demo/image/upload/edited-home-cover.jpg',
    };
    await act(async () => { refreshHomepage(); });
    expect(container.querySelector('#top-story h1')?.textContent).toContain(changedFields.title);
    expect(container.querySelector('#top-story')?.textContent).toContain(changedFields.summary);
    expect(container.querySelector('#top-story img')?.getAttribute('src')).toContain('edited-home-cover.jpg');
    expect(container.querySelector(`#top-story a[href="${storyHref}"]`)).not.toBeNull();
    expect(currentRead.publishedAt).toBe(story.publishedAt);
  });

  test('malformed initial refresh retains SSR content, but authoritative empty recovery withdraws it', async () => {
    const actualNews = jest.requireActual<typeof import('../../lib/publicNewsApi')>('../../lib/publicNewsApi');
    let malformed = true;
    jest.mocked(global.fetch).mockImplementation(async () => new Response(JSON.stringify({
      items: malformed ? [{ _id: story._id }] : [],
    })));
    jest.mocked(fetchPublicNews).mockImplementation(async (options) =>
      options.homepageRecovery ? actualNews.fetchPublicNews(options) : emptyResponse
    );
    const { container } = renderHomepage({ initialTopStory: story, initialFreshStories: [story] });
    await act(async () => {});
    expect(container.querySelector('#top-story h1')?.textContent).toBe(story.title);
    expect(container.querySelector('#top-story [role="alert"]')?.textContent).toContain(messages.errors.showingPreviousStories);
    malformed = false;
    await act(async () => { await jest.advanceTimersByTimeAsync(5_000); });
    expectNeutralState(container, 'status', messages.categoryPage.noStoriesYet);
    expect(container.querySelector(`#top-story a[href="${storyHref}"]`)).toBeNull();
  });

  test.each(['HTTP 503', 'network', 'malformed'])('Spotlight and section content survive %s, recover with new content, then genuine empty clears them', async (failure) => {
    const spotlight = { ...story, _id: `spotlight-${lang}`, slug: `spotlight-${lang}`, title: `Spotlight report ${lang}` };
    const section = { ...story, _id: `web-${lang}`, slug: `web-${lang}`, title: `Web report ${lang}`, category: 'web-stories' };
    const actualNews = jest.requireActual<typeof import('../../lib/publicNewsApi')>('../../lib/publicNewsApi');
    let mode: 'content' | 'failure' | 'recovered' | 'empty' = 'content';
    jest.mocked(global.fetch).mockImplementation(async () => {
      if (failure === 'network') throw new Error('synthetic-private-network');
      return new Response(JSON.stringify(failure === 'malformed'
        ? { items: [{ _id: 'incomplete' }] } : { error: 'synthetic-private-upstream' }),
      { status: failure === 'HTTP 503' ? 503 : 200 });
    });
    jest.mocked(fetchPublicNews).mockImplementation(async (options) => {
      const featured = options.extraQuery?.spotlight === '1' ? spotlight : options.category === 'web-stories' ? section : null;
      if (!featured || mode === 'empty') return emptyResponse;
      if (mode === 'failure') return actualNews.fetchPublicNews(options);
      if (mode === 'recovered') return {
        ...emptyResponse, items: [{ ...featured, title: `${featured.title} updated`, content: '<p>Updated public report</p>' }],
      };
      return { ...emptyResponse, items: [featured] };
    });
    const { container } = renderHomepage({ initialFreshStories: [] });
    await act(async () => {});
    expect(container.querySelector('.spotlight-section')?.textContent).toContain(spotlight.title);
    expect(screen.queryByText(section.title)).not.toBeNull();

    mode = 'failure';
    await act(async () => { refreshHomepage(); });
    expect(container.querySelector('.spotlight-section')?.textContent).toContain(spotlight.title);
    expect(screen.queryByText(section.title)).not.toBeNull();
    const alerts = screen.getAllByRole('alert');
    expect(alerts).toHaveLength(2);
    for (const alert of alerts) {
      expect(alert.textContent).toContain(messages.categoryPage.unableToLoadTitle);
      expect(alert.textContent).toContain(messages.errors.showingPreviousStories);
      expect(alert.textContent).not.toContain('synthetic-private');
    }

    mode = 'recovered';
    await act(async () => { refreshHomepage(); });
    expect(container.querySelector('.spotlight-section')?.textContent).toContain(`${spotlight.title} updated`);
    expect(screen.queryByText(`${section.title} updated`)).not.toBeNull();
    expect(screen.queryByText(spotlight.title)).toBeNull();
    expect(screen.queryByText(section.title)).toBeNull();
    expect(screen.queryAllByRole('alert')).toHaveLength(0);

    mode = 'empty';
    await act(async () => { refreshHomepage(); });
    expect(screen.queryByText(`${spotlight.title} updated`)).toBeNull();
    expect(screen.queryByText(`${section.title} updated`)).toBeNull();
    expect(container.querySelector('.spotlight-section')).toBeNull();
    expect(screen.queryAllByRole('alert')).toHaveLength(0);
  });

  test.each(['Spotlight', 'section'])('partial %s failure does not prevent the other successful empty from applying', async (failed) => {
    const spotlight = { ...story, _id: 'featured', slug: 'featured', title: 'Featured report' };
    const section = { ...story, _id: 'web', slug: 'web', title: 'Web report', category: 'web-stories' };
    let refreshing = false;
    jest.mocked(fetchPublicNews).mockImplementation(async (options) => {
      const kind = options.extraQuery?.spotlight === '1' ? 'Spotlight' : options.category === 'web-stories' ? 'section' : null;
      if (!kind) return emptyResponse;
      if (refreshing) return kind === failed ? { ...emptyResponse, error: 'API 503' } : emptyResponse;
      return { ...emptyResponse, items: [kind === 'Spotlight' ? spotlight : section] };
    });
    renderHomepage({ initialFreshStories: [] });
    await act(async () => {});
    refreshing = true;
    await act(async () => { refreshHomepage(); });
    expect(screen.queryByText(failed === 'Spotlight' ? spotlight.title : section.title)).not.toBeNull();
    expect(screen.queryByText(failed === 'Spotlight' ? section.title : spotlight.title)).toBeNull();
    expect(screen.getAllByRole('alert')).toHaveLength(1);
  });

  test('cold Spotlight and section failures expose unavailable state without invented content', async () => {
    jest.mocked(fetchPublicNews).mockImplementation(async (options) =>
      options.extraQuery?.spotlight === '1' || options.category === 'web-stories'
        ? { ...emptyResponse, error: 'Invalid news list response' } : emptyResponse
    );
    const { container } = renderHomepage({ initialFreshStories: [] });
    await act(async () => {});
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(container.querySelector('.spotlight-section')?.textContent).toContain(messages.categoryPage.unableToLoadTitle);
    expect(container.querySelector('.spotlight-section a')).toBeNull();
    expect(container.textContent).not.toContain(messages.errors.showingPreviousStories);
  });

  test('a locale switch and late/unmounted Spotlight requests cannot resurrect previous-locale content', async () => {
    const nextLang = lang === 'en' ? 'hi' : lang === 'hi' ? 'gu' : 'en';
    const featured = { ...story, _id: 'featured', slug: 'featured', title: `Previous locale ${lang}` };
    type NewsResult = Awaited<ReturnType<typeof fetchPublicNews>>;
    const late: Array<(result: NewsResult) => void> = [];
    const signals: AbortSignal[] = [];
    let holding = false;
    jest.mocked(fetchPublicNews).mockImplementation(async (options) => {
      if (options.signal && (options.extraQuery?.spotlight === '1' || options.category === 'web-stories')) signals.push(options.signal);
      if (options.extraQuery?.spotlight !== '1') return emptyResponse;
      if (holding) return new Promise(resolve => { late.push(resolve); });
      return { ...emptyResponse, items: [featured] };
    });
    const tree = (routeLang: typeof lang) => (
      <i18n.LanguageProvider initialLang={routeLang}>
        <PublicSettingsProvider initialSettings={published()}>
          <HomePage {...props} />
        </PublicSettingsProvider>
      </i18n.LanguageProvider>
    );
    const { container, rerender, unmount } = render(tree(lang));
    await act(async () => {});
    expect(container.querySelector('.spotlight-section')?.textContent).toContain(featured.title);
    holding = true;
    await act(async () => { refreshHomepage(); });
    await act(async () => { rerender(tree(nextLang)); });
    expect(screen.queryByText(featured.title)).toBeNull();
    await act(async () => { late[0]({ ...emptyResponse, items: [featured] }); });
    expect(screen.queryByText(featured.title)).toBeNull();
    await act(async () => { late[1]({ ...emptyResponse, error: 'API 503' }); });
    expect(screen.queryByText(featured.title)).toBeNull();
    expect(container.querySelector('.spotlight-section')?.textContent).toContain(actualI18n.getMessagesForLang(nextLang).categoryPage.unableToLoadTitle);
    await act(async () => { refreshHomepage(); });
    unmount();
    expect(signals.every(signal => signal.aborted)).toBe(true);
    await act(async () => { late.slice(2).forEach(resolve => resolve({ ...emptyResponse, items: [featured] })); });
    expect(container.childElementCount).toBe(0);
  });

  test('real stories and neutral image placeholders survive a clearly labelled failed refresh and recovery', async () => {
    let readFailed = false;
    jest.mocked(fetchPublicNews).mockImplementation(async (options) => {
      if (!options.homepageRecovery) return emptyResponse;
      return readFailed
        ? { ...emptyResponse, error: 'API 503', status: 503 }
        : { ...emptyResponse, items: [story] };
    });
    const { container } = renderHomepage({ initialTopStory: story, initialFreshStories: [story] });
    await act(async () => {});
    expect(container.querySelector('#top-story h1')?.textContent).toBe(story.title);
    expect(container.querySelector(`#top-story a[href="${storyHref}"]`)).not.toBeNull();
    expect(container.querySelector('#top-story .select-none')?.textContent).toBe('News Pulse');
    expect(container.querySelector('#top-story [role="alert"]')).toBeNull();
    expect(jest.mocked(fetchPublicNews).mock.calls.some(([options]) => options.category === 'breaking')).toBe(false);

    readFailed = true;
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    const notice = container.querySelector('#top-story [role="alert"]');
    expect(notice?.textContent).toContain(messages.categoryPage.unableToLoadTitle);
    expect(notice?.textContent).toContain(messages.errors.showingPreviousStories);
    expect(notice?.closest('a')).toBeNull();
    expect(container.querySelector('#top-story h1')?.textContent).toBe(story.title);
    expect(container.querySelector(`#top-story a[href="${storyHref}"]`)).not.toBeNull();
    expect(container.querySelector('#top-story')?.textContent).not.toMatch(/News Pulse Front Page|Live now|Updated/);
    expect(jest.mocked(HomeRightRail).mock.calls.at(-1)?.[0].latestReadError).toBe(true);

    readFailed = false;
    await act(async () => { await jest.advanceTimersByTimeAsync(5_000); });
    expect(container.querySelector('#top-story h1')?.textContent).toBe(story.title);
    expect(container.querySelector('#top-story [role="alert"]')).toBeNull();
    expect(jest.mocked(HomeRightRail).mock.calls.at(-1)?.[0].latestReadError).toBe(false);
  });
});

describe('homepage Broadcast-only ticker ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(fetchPublicSettings).mockResolvedValue(published());
  });

  function renderSnapshot(settings: ReturnType<typeof published> | null = published()) {
    const html = renderToString(<PublicSettingsProvider initialSettings={settings}><HomePage {...props} /></PublicSettingsProvider>);
    return new DOMParser().parseFromString(html, 'text/html');
  }

  function tracks(document: Document) {
    return Array.from(document.querySelectorAll<HTMLElement>('.ticker-wrapper .np-tickerTrack'));
  }

  test.each([
    [true, true],
    [true, false],
    [false, true],
    [false, false],
  ])('Broadcast visibility breaking=%s/live=%s ignores both Public Settings enabled values', (breakingEnabled, liveEnabled) => {
    jest.mocked(usePublicBroadcastTicker).mockReturnValue(broadcastState({ breakingEnabled, liveEnabled }));
    for (const publicEnabled of [false, true]) {
      const settings = published();
      settings.tickers.breaking.enabled = publicEnabled;
      settings.tickers.live.enabled = publicEnabled;
      const document = renderSnapshot(settings);
      expect(document.body.textContent?.includes('Breaking fixture')).toBe(breakingEnabled);
      expect(document.body.textContent?.includes('Live fixture')).toBe(liveEnabled);
      expect(tracks(document)).toHaveLength(Number(breakingEnabled) + Number(liveEnabled));
    }
  });

  test('resolved Broadcast renders independently of missing or failed Public Settings', async () => {
    jest.mocked(usePublicBroadcastTicker).mockReturnValue(broadcastState({ breakingEnabled: true }));
    expect(tracks(renderSnapshot(null))).toHaveLength(2);
    jest.mocked(fetchPublicSettings).mockRejectedValueOnce(new Error('settings unavailable'));
    const { container } = render(<PublicSettingsProvider><HomePage {...props} /></PublicSettingsProvider>);
    await act(async () => {});
    expect(container.querySelectorAll('.ticker-wrapper .np-tickerTrack')).toHaveLength(2);
    expect(container.querySelector('.category-nav-shell')).toBeNull();
  });

  test('initial Broadcast loading never flashes enabled defaults or a subsequently disabled ticker', async () => {
    jest.mocked(usePublicBroadcastTicker).mockReturnValue(broadcastState({
      isLoading: true, breakingEnabled: null, liveEnabled: null, breakingSpeedSec: null, liveSpeedSec: null,
    }));
    expect(tracks(renderSnapshot())).toHaveLength(0);
    const homepage = <PublicSettingsProvider initialSettings={published()}><HomePage {...props} /></PublicSettingsProvider>;
    const { container, rerender } = render(homepage);
    await act(async () => {});
    expect(container.querySelector('.ticker-wrapper')).toBeNull();
    jest.mocked(usePublicBroadcastTicker).mockReturnValue(broadcastState({ breakingEnabled: false, liveEnabled: true }));
    rerender(<PublicSettingsProvider initialSettings={published()}><HomePage {...props} /></PublicSettingsProvider>);
    expect(container.querySelectorAll('.ticker-wrapper .np-tickerTrack')).toHaveLength(1);
    expect(container.querySelector('.ticker-wrapper')?.textContent).not.toContain('Breaking fixture');
    expect(container.querySelector('.ticker-wrapper')?.textContent).toContain('Live fixture');
  });

  test('SAFE_MODE still hides both tickers and disables existing fetch hooks', () => {
    jest.mocked(isSafeMode).mockReturnValue(true);
    jest.mocked(usePublicBroadcastTicker).mockReturnValue(broadcastState({ breakingEnabled: true }));
    expect(tracks(renderSnapshot())).toHaveLength(0);
    expect(usePublicBroadcastTicker).toHaveBeenCalledWith({ lang: 'en', enableSse: true, enabled: false });
    for (const channel of ['breaking', 'live']) {
      expect(usePublicTickerAds).toHaveBeenCalledWith({ lang: 'en', channel, enabled: false, refreshIntervalMs: 15_000 });
    }
  });

  test.each([
    { base: 20, expected: ['20s', '24s'] },
    { base: 35, expected: ['35s', '35s'] },
    { base: 10, expected: ['18s', '24s'] },
    { base: null, expected: ['18s', '24s'] },
  ])('Broadcast base $base and existing minima ignore Public Settings speed', ({ base, expected }) => {
    jest.mocked(usePublicBroadcastTicker).mockReturnValue(broadcastState({
      breakingEnabled: true, breakingSpeedSec: base, liveSpeedSec: base, breakingTexts: ['B'], liveTexts: ['L'],
    }));
    for (const publicSpeed of [5, 24, 180]) {
      const settings = published();
      settings.tickers.breaking.speedSec = publicSpeed;
      settings.tickers.live.speedSec = publicSpeed;
      expect(tracks(renderSnapshot(settings)).map((track) => track.style.animationDuration)).toEqual(expected);
    }
  });

  test.each([
    { breakingLength: 900, liveLength: 800, expected: '100s' },
    { breakingLength: 3600, liveLength: 3200, expected: '300s' },
  ])('preserves text-length adjustment and final clamp: $expected', ({ breakingLength, liveLength, expected }) => {
    jest.mocked(usePublicBroadcastTicker).mockReturnValue(broadcastState({
      breakingEnabled: true, breakingSpeedSec: 20, liveSpeedSec: 20,
      breakingTexts: ['B'.repeat(breakingLength)], liveTexts: ['L'.repeat(liveLength)],
    }));
    expect(tracks(renderSnapshot()).map((track) => track.style.animationDuration)).toEqual([expected, expected]);
  });

  test('resolved content-only Broadcast uses existing defaults, not Public Settings configuration', () => {
    jest.mocked(usePublicBroadcastTicker).mockReturnValue(broadcastState({
      broadcast: normalizePublicBroadcast({ items: { breaking: [], live: [] } }),
      breakingEnabled: null, liveEnabled: null, breakingSpeedSec: null, liveSpeedSec: null,
      breakingTexts: ['B'], liveTexts: ['L'],
    }));
    const settings = published();
    settings.tickers.breaking.enabled = false;
    settings.tickers.live.enabled = false;
    settings.tickers.breaking.speedSec = 90;
    settings.tickers.live.speedSec = 120;
    expect(tracks(renderSnapshot(settings)).map((track) => track.style.animationDuration)).toEqual(['18s', '24s']);
  });

  test('does not introduce FORCE_ON/FORCE_OFF rendering semantics', () => {
    jest.mocked(usePublicBroadcastTicker).mockReturnValue(broadcastState({
      broadcast: normalizePublicBroadcast({
        settings: { breaking: { enabled: false, mode: 'FORCE_ON' }, live: { enabled: true, mode: 'FORCE_OFF' } },
      }),
    }));
    const document = renderSnapshot();
    expect(tracks(document)).toHaveLength(1);
    expect(document.querySelector('.ticker-wrapper')?.textContent).toContain('Live fixture');
  });

  test('preserves 12/15 editorial caps and real paid-scroll insertion, links, and channel calls', () => {
    jest.mocked(usePublicBroadcastTicker).mockReturnValue(broadcastState({
      breakingEnabled: true,
      breakingTexts: Array.from({ length: 20 }, (_, index) => `B${index + 1}`),
      liveTexts: Array.from({ length: 20 }, (_, index) => `L${index + 1}`),
    }));
    jest.mocked(usePublicTickerAds).mockImplementation(({ channel }) => ({
      ads: [{ id: `paid-${channel}`, text: `Paid ${channel}`, channel, url: `#paid-${channel}`, frequency: 3, priority: 1, raw: {} }],
      isLoading: false, error: null, lastUpdatedAt: null, refetch: jest.fn(),
    }));
    const document = renderSnapshot();
    const sequences = tracks(document).map((track) =>
      Array.from(track.querySelectorAll('.np-tickerSeq')[0].querySelectorAll('.tickerText'))
        .map((node) => node.textContent?.replace(/^.*Ad: /, 'Ad: '))
    );
    expect(sequences).toEqual([
      ['B1', 'B2', 'B3', 'Ad: Paid breaking', 'B4', 'B5', 'B6', 'Ad: Paid breaking', 'B7', 'B8', 'B9', 'Ad: Paid breaking', 'B10', 'B11', 'B12'],
      ['L1', 'L2', 'L3', 'Ad: Paid live', 'L4', 'L5', 'L6', 'Ad: Paid live', 'L7', 'L8', 'L9', 'Ad: Paid live', 'L10', 'L11', 'L12', 'Ad: Paid live', 'L13', 'L14', 'L15'],
    ]);
    for (const channel of ['breaking', 'live']) {
      expect(usePublicTickerAds).toHaveBeenCalledWith({ lang: 'en', channel, enabled: true, refreshIntervalMs: 15_000 });
      const link = document.querySelector(`a[href="#paid-${channel}"]`);
      expect(link?.getAttribute('target')).toBe('_blank');
      expect(link?.getAttribute('rel')).toBe('sponsored noopener noreferrer');
    }
    expect(tracks(document).every((track) => track.querySelectorAll('.np-tickerSeq').length === 2)).toBe(true);
  });

  test('keeps Breaking before Live even when published order values are reversed', () => {
    jest.mocked(usePublicBroadcastTicker).mockReturnValue(broadcastState({ breakingEnabled: true }));
    const settings = published();
    settings.tickers.breaking.order = 30;
    settings.tickers.live.order = 10;
    const document = renderSnapshot(settings);
    const text = document.querySelector('.ticker-wrapper')!.textContent!;
    expect(text.indexOf('Breaking fixture')).toBeLessThan(text.indexOf('Live fixture'));
    expect(document.querySelector('.header-shell')!.compareDocumentPosition(document.querySelector('.category-nav-shell')!))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(document.querySelector('.ticker-wrapper')!.compareDocumentPosition(document.querySelector('.trending-shell')!))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(document.querySelector('.trending-shell')!.compareDocumentPosition(document.querySelector('.home-grid')!))
      .toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  });
});