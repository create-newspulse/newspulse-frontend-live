import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';

import ExploreCategories from '../../components/ExploreCategories';
import LanguageSelector from '../../components/LanguageSelector';
import NewsPulseCategoryShell from '../../components/NewsPulseCategoryShell';
import CategoryFeedPage from '../../components/CategoryFeedPage';
import CategoryStoryHierarchy from '../../components/category/CategoryStoryHierarchy';
import { articleToHomeRightRailFeedItem, HomeRightRailLatestNews } from '../../components/home/HomeRightRail';
import RegionalHomeStorySections from '../../components/regional/RegionalHomeStorySections';
import NationalPage from '../../pages/national';
import { resolveHomepageLatestStories, SiteFooter } from '../../pages/index';
import { fetchPublicNews, parsePublicNewsArticle, type Article } from '../../lib/publicNewsApi';
import { getLocalizedArticleFields, STRICT_LOCALE_POLICY, type RouteLocale } from '../../lib/localizedArticleFields';
import { compactRegionalInitialStories } from '../../lib/regionalListingStories';
import { getMessagesForLang, LanguageProvider } from '../../src/i18n/LanguageProvider';

const locales = ['gu', 'hi', 'en'] as const;
const copy = {
  gu: { title: 'સ્થાનિક પરિવહનના સમાચાર', summary: 'સ્થાનિક બસ સેવાની માહિતી.', content: '<p>સ્થાનિક બસ સેવાની નવી માહિતી.</p>' },
  hi: { title: 'स्थानीय परिवहन समाचार', summary: 'स्थानीय बस सेवा की जानकारी।', content: '<p>स्थानीय बस सेवा की नई जानकारी।</p>' },
  en: { title: 'Local transport news', summary: 'Information about the local bus service.', content: '<p>New information about the local bus service.</p>' },
};
let mockLocale: RouteLocale = 'en';
const mockReplace = jest.fn(async () => true);
const mockOpenPreferences = jest.fn();

jest.mock('next/router', () => ({
  useRouter: () => ({
    isReady: true, locale: mockLocale, defaultLocale: 'en',
    pathname: '/national', asPath: `${mockLocale === 'en' ? '' : `/${mockLocale}`}/national`,
    query: {}, replace: mockReplace,
  }),
}));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, locale: _locale, prefetch: _prefetch, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { locale?: string | false; prefetch?: boolean }) => <a href={href} {...props}>{children}</a>,
}));
jest.mock('../../src/components/story/StoryImage', () => ({
  __esModule: true,
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
  TopStoryImage: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
jest.mock('../../src/components/ads/AdSlot', () => ({ __esModule: true, default: () => null }));
jest.mock('../../src/context/PublicSettingsContext', () => ({
  usePublicSettings: () => ({ settings: null, isModuleEnabled: () => false, moduleOrder: () => 0 }),
}));
jest.mock('../../hooks/usePublicFounderToggles', () => ({
  usePublicFounderToggles: () => ({ toggles: { communityReporterClosed: false } }),
}));
jest.mock('../../components/home/HomeSharedFeatureModules', () => ({
  HomeTrendingStrip: () => null, HomeSpotlightCarousel: () => null,
}));
jest.mock('../../components/home/HomeLeftRailUtilities', () => ({
  HomeLeftRailLiveTvCard: () => null, HomeLeftRailSnapshotsCard: () => null,
}));
jest.mock('../../lib/homeSpotlight', () => ({
  ...jest.requireActual('../../lib/homeSpotlight'),
  fetchHomeSpotlightArticles: jest.fn(async () => []),
}));
jest.mock('../../features/youthPulse/useYouthPulse', () => ({
  useYouthPulse: () => ({ topics: [], trending: [], loading: false, error: null }),
}));
jest.mock('../../components/regional/BreakingTicker', () => ({ __esModule: true, default: () => null }));
jest.mock('../../src/consent/CookieConsentProvider', () => ({
  ...jest.requireActual('../../src/consent/CookieConsentProvider'),
  useCookieConsent: () => ({ openPreferences: mockOpenPreferences }),
}));

function article(locale: RouteLocale, id = 'story', category = 'national') {
  return {
    _id: id, slug: `persisted-${id}`, translationGroupId: `group-${id}`,
    language: locale, lang: locale, status: 'published', category,
    ...copy[locale], title: `${copy[locale].title} ${id}`,
    publishedAt: '2025-01-01T10:00:00.000Z', updatedAt: '2025-01-02T10:00:00.000Z',
  };
}

function cachedArticle(locale: RouteLocale, status = 'APPROVED') {
  const source = locale === 'gu' ? 'hi' : 'gu';
  return {
    ...article(source, 'cached', 'regional'),
    sourceLanguage: source,
    translationStatus: { [locale]: status },
    translations: { [locale]: { ...copy[locale], slug: 'persisted-cached-translation' } },
  };
}

function response(items: Article[]) {
  return new Response(JSON.stringify({ items }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

function localized(locale: RouteLocale, children: React.ReactNode) {
  return <LanguageProvider initialLang={locale}>{children}</LanguageProvider>;
}

let fetchMock: jest.SpyInstance;
beforeEach(() => {
  mockReplace.mockClear();
  mockOpenPreferences.mockClear();
  fetchMock = jest.spyOn(global, 'fetch').mockImplementation(async (input) => {
    const url = new URL(String(input), 'http://localhost');
    if (url.pathname === '/api/public/news') {
      const locale = url.searchParams.get('lang');
      if (locale !== 'gu' && locale !== 'hi' && locale !== 'en') throw new Error('Missing fixture request locale');
      expect(url.searchParams.get('language')).toBe(locale);
      return response([article(locale, 'latest')]);
    }
    if (url.pathname === '/api/public/viral-videos') return response([]);
    if (url.pathname.startsWith('/api/ticker/')) return response([article(mockLocale, 'ticker')]);
    throw new Error(`Unexpected request in local multilingual fixture: ${url.pathname}`);
  });
});
afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
});

describe.each(locales)('%s public language contract', (locale) => {
  const messages = getMessagesForLang(locale);
  const prefix = locale === 'en' ? '' : `/${locale}`;
  beforeEach(() => { mockLocale = locale; });

  test('requests both locale parameters and preserves the backend-selected native record', async () => {
    const result = await fetchPublicNews({ language: locale, limit: 40 });
    expect(result.error).toBeUndefined();
    expect(result.items[0]).toMatchObject({ _id: 'latest', language: locale, title: article(locale, 'latest').title });
    expect(new URL(result.endpoint, 'http://localhost').searchParams.get('language')).toBe(locale);
  });

  test('keeps backend-selected cached top-level text even when availability flags are false', () => {
    const dto = { ...article(locale), originalLang: 'gu', isTranslated: true, translations: { gu: false, hi: false, en: false } };
    expect(parsePublicNewsArticle(dto)).not.toBeNull();
    expect(articleToHomeRightRailFeedItem(dto, locale)).toMatchObject({
      _id: dto._id, slug: dto.slug, lang: locale, title: dto.title, desc: dto.summary,
      titleIsOriginal: false,
    });
    expect(dto.translations).toEqual({ gu: false, hi: false, en: false });
  });

  test('selects actual approved content and never borrows a source summary', () => {
    const cached = cachedArticle(locale);
    expect(articleToHomeRightRailFeedItem(cached, locale)).toMatchObject({
      _id: cached._id, lang: locale, title: copy[locale].title, desc: copy[locale].summary,
      slug: 'persisted-cached-translation',
    });
    const { summary: _summary, ...withoutSummary } = cached.translations[locale];
    expect(articleToHomeRightRailFeedItem({ ...cached, translations: { [locale]: withoutSummary } }, locale).desc).toBe('');
  });

  test.each(['ready', 'pending', 'blocked', 'rejected', 'draft', 'invalid'])('strict global Latest does not restore source text for a %s cached variant', (status) => {
    const cached = cachedArticle(locale, status);
    const item = articleToHomeRightRailFeedItem(cached, locale);
    expect(item.title).toBe('');
    expect(item.desc).toBe('');
    render(localized(locale, <HomeRightRailLatestNews items={[item]} lang={locale} />));
    expect(screen.getByText(messages.home.latest)).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe(messages.categoryPage.noStoriesYet);
    expect(screen.queryByText(cached.title)).toBeNull();
  });

  test('ignores non-text translation metadata without weakening the article-response validation fix', () => {
    const invalid = { ...article(locale === 'gu' ? 'hi' : 'gu'), translations: { [locale]: { title: true, content: true } } };
    expect(getLocalizedArticleFields(invalid, locale, STRICT_LOCALE_POLICY).isVisible).toBe(false);
    expect(parsePublicNewsArticle({ ...article(locale), translations: { [locale]: 'invalid-container' } })).toBeNull();
    const metadataOnly = { ...article(locale === 'gu' ? 'hi' : 'gu'), translations: { [locale]: true } };
    expect(getLocalizedArticleFields(metadataOnly, locale, STRICT_LOCALE_POLICY).isVisible).toBe(false);
  });

  test('localizes Latest controls/badges, preserves categories and canonical links, and filters without refetching', () => {
    const items = ['regional', 'national', 'international', 'tech', 'tech-gadgets'].map((category) => article(locale, category, category));
    const { container } = render(localized(locale, <HomeRightRailLatestNews items={items} lang={locale} />));
    expect(screen.getByRole('link', { name: messages.common.viewAll }).getAttribute('href')).toBe(`${prefix}/latest`);
    expect(screen.getByText(messages.categories.scienceTechnology)).toBeTruthy();
    expect(screen.getByText(messages.categories.techGadgets)).toBeTruthy();
    expect(messages.categories.scienceTechnology).not.toBe(messages.categories.techGadgets);
    for (const item of items) {
      expect(container.querySelector(`a[href="${prefix}/news/${item.slug}"]`)).not.toBeNull();
    }
    fireEvent.click(screen.getByRole('button', { name: messages.categories.regional }));
    expect(screen.getByText(items[0].title)).toBeTruthy();
    expect(screen.queryByText(items[1].title)).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: messages.categories.international }));
    expect(screen.getByText(items[2].title)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: messages.topics.all }));
    expect(screen.getByText(items[1].title)).toBeTruthy();
    expect(items.map((item) => item.category)).toEqual(['regional', 'national', 'international', 'tech', 'tech-gadgets']);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('uses category-object slug identity rather than an English or translated display name', () => {
    const item = { ...article(locale), category: { slug: 'tech-gadgets', title: messages.categories.scienceTechnology } };
    render(localized(locale, <HomeRightRailLatestNews items={[item]} lang={locale} />));
    expect(screen.getByText(messages.categories.techGadgets)).toBeTruthy();
    expect(screen.queryByText(messages.categories.scienceTechnology)).toBeNull();
  });

  test('localizes sidebar descriptions and keeps Science & Technology separate from Tech & Gadgets', () => {
    render(localized(locale, <ExploreCategories pathname="/national" />));
    expect(screen.getByText(messages.home.exploreCategories)).toBeTruthy();
    expect(screen.getByText(messages.home.tapToFilter)).toBeTruthy();
    expect(screen.getByText(messages.home.newsDesk)).toBeTruthy();
    expect(screen.getByText(messages.categoryDescriptions.national)).toBeTruthy();
    expect(screen.getByText(messages.categoryDescriptions.international)).toBeTruthy();
    expect(screen.getByRole('link', { name: new RegExp(messages.categories.scienceTechnology) }).getAttribute('href')).toBe('/science-technology');
    expect(screen.getByRole('link', { name: new RegExp(messages.categories.techGadgets) }).getAttribute('href')).toBe('/tech-gadgets');
  });

  test('homepage Top Story and Latest select the same intended representation without reordering', async () => {
    const newest = article(locale, 'newest');
    const older = { ...article(locale, 'older'), publishedAt: '2024-12-31T10:00:00.000Z' };
    const wrongLocale = article(locale === 'gu' ? 'hi' : 'gu', 'untranslated');
    fetchMock.mockResolvedValueOnce(response([older, wrongLocale, newest]));
    const result = await resolveHomepageLatestStories(locale);
    expect(result.topStory?._id).toBe(newest._id);
    expect(result.freshStories?.map((item) => item._id)).toEqual([newest._id, older._id]);
    expect(result.freshStories?.map((item) => item.title)).toEqual([newest.title, older.title]);
    expect(result.freshStories?.every((item) => item.lang === locale)).toBe(true);
  });

  test('National main stories, shared Latest and interface labels agree on the route locale', async () => {
    const data = Array.from({ length: 5 }, (_, index) => article(locale, `national-${index}`));
    render(localized(locale, <NationalPage lang={locale} data={data} initialPagination={{ page: 1, limit: 20, total: 5, totalPages: 1, hasMore: false }} />));
    expect(screen.getByRole('heading', { name: messages.categoryDesks.national.title })).toBeTruthy();
    expect(screen.getByText(messages.categoryPage.hierarchyDescription)).toBeTruthy();
    expect(screen.getByText(messages.nationalPage.keyStories)).toBeTruthy();
    expect(screen.getAllByText(data[0].title).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: messages.common.listen })).toBeTruthy();
    expect(screen.getByRole('button', { name: messages.common.share })).toBeTruthy();
    const read = screen.getByRole('link', { name: messages.common.read });
    expect(read.getAttribute('href')).toBe(`${prefix}/news/${data[0].slug}`);
    await waitFor(() => expect(screen.getByText(article(locale, 'latest').title)).toBeTruthy());
  });

  test('International main stories and shared Latest use the same route locale', async () => {
    const item = article(locale, 'international-main', 'international');
    render(localized(locale, <CategoryFeedPage title="International" categoryKey="international" useCategoryShell initialLocale={locale} initialItems={[item]} initialPagination={{ page: 1, limit: 30, total: 1, totalPages: 1, hasMore: false }} />));
    expect(screen.getByRole('heading', { name: messages.categoryDesks.international.title })).toBeTruthy();
    expect(screen.getByText(messages.categoryDesks.international.description)).toBeTruthy();
    expect(screen.getByText(messages.categoryPage.hierarchyDescription)).toBeTruthy();
    expect(screen.getAllByText(item.title).length).toBeGreaterThan(0);
    await waitFor(() => expect(screen.getByText(article(locale, 'latest').title)).toBeTruthy());
  });

  test('Regional native cards preserve identity and localize hierarchy labels', () => {
    const item = article(locale, 'regional-main', 'regional');
    render(localized(locale, <RegionalHomeStorySections stories={[item]} requestedLang={locale} stateName="Gujarat" categoryLabel={messages.categories.regional} emptyTitle={messages.regionalUI.emptyTitle} readMoreLabel={messages.common.read} fallbackCategoryLabel={messages.categories.regional} />));
    expect(screen.getByText(messages.regionalGujaratPage.topStory)).toBeTruthy();
    expect(screen.getByText(messages.categoryPage.hierarchyDescription)).toBeTruthy();
    expect(screen.getByText(item.title)).toBeTruthy();
    expect(screen.getAllByRole('link').some((link) => link.getAttribute('href') === `${prefix}/news/${item._id}`)).toBe(true);
  });

  test.each([true, false])('shared hierarchy keeps its localized description while loading=%s', (loading) => {
    render(localized(locale, <CategoryStoryHierarchy
      items={loading ? [] : [{ id: 'hierarchy-story', title: copy[locale].title, titleText: copy[locale].title }]}
      categoryLabel={messages.categories.national}
      description={messages.categoryPage.hierarchyDescription}
      loadMoreLabel={messages.nationalPage.loadMoreStories}
      emptyTitle={messages.categoryPage.noStoriesYet}
      loading={loading}
    />));
    expect(screen.getByText(messages.categoryPage.hierarchyDescription)).toBeTruthy();
    if (locale !== 'en') expect(screen.queryByText(getMessagesForLang('en').categoryPage.hierarchyDescription)).toBeNull();
  });
});

describe('existing homepage footer', () => {
  const expectedCopy = {
    en: { about: 'About News Pulse', guide: 'Community Reporter Guide', unavailable: '{{label}} is not available right now.' },
    hi: { about: 'News Pulse के बारे में', guide: 'कम्युनिटी रिपोर्टर मार्गदर्शिका', unavailable: '{{label}} अभी उपलब्ध नहीं है।' },
    gu: { about: 'News Pulse વિશે', guide: 'કોમ્યુનિટી રિપોર્ટર માર્ગદર્શિકા', unavailable: '{{label}} હાલમાં ઉપલબ્ધ નથી.' },
  };

  function footer(locale: RouteLocale, onToast = jest.fn()) {
    return localized(locale, <SiteFooter
      theme={{ mode: 'light', accent: '#F59E0B', accent2: '#22D3EE' }}
      onToast={onToast}
      lang={locale}
    />);
  }

  test.each(locales)('%s footer localizes all copy and preserves every link destination and order', (locale) => {
    const messages = getMessagesForLang(locale);
    const { container } = render(footer(locale));
    const expectedLinks = [
      [expectedCopy[locale].about, '/about-us'],
      [messages.common.contact, '/contact'],
      [messages.footer.careers, '/careers'],
      [messages.common.communityReporter, '/community-reporter'],
      [expectedCopy[locale].guide, '/community-reporter/guidelines'],
      [messages.footer.journalistDesk, '/journalist-desk'],
      [messages.footer.editorialPolicy, '/editorial-policy'],
      [messages.footer.digitalCodeOfEthics, '/digital-code-of-ethics'],
      [messages.footer.privacyPolicy, '/privacy-policy'],
      [messages.footer.cookiePolicy, '/cookie-policy'],
      [messages.footer.termsOfService, '/terms-of-service'],
      [messages.footer.copyrightPolicy, '/copyright-policy'],
      [messages.footer.grievanceRedressal, '/grievance-redressal'],
      [messages.footer.privacyRequest, '/privacy-request'],
      [messages.footer.monthlyCompliance, '/monthly-compliance'],
      [messages.footer.advertiseWithUs, '/advertise-with-us'],
      [messages.footer.advertisingPolicy, '/advertising-policy'],
      [messages.footer.partnerships, '/contact'],
      [messages.footer.licensing, '/contact'],
    ];
    const prefix = locale === 'en' ? '' : `/${locale}`;
    expect(screen.getAllByRole('link').map((link) => [link.textContent, link.getAttribute('href')]))
      .toEqual(expectedLinks.map(([label, path]) => [label, `${prefix}${path}`]));
    for (const text of [
      messages.footer.description, messages.footer.legalComplianceTitle, messages.footer.businessTitle,
      messages.footer.copyright, messages.common.availableIn3Languages, messages.common.mobileAndWeb,
      messages.common.secureAndPrivate,
    ]) expect(screen.getByText(text)).toBeTruthy();
    expect(container.querySelector('.text-3xl')?.textContent?.trim()).toBe('News Pulse');
    expect(container.textContent).toContain('News Pulse Media');
    if (locale === 'en') {
      expect(container.textContent).not.toMatch(/[\u0900-\u097f\u0a80-\u0aff]/);
    } else {
      expect(container.textContent?.replace(/News\s*Pulse(?: Media)?/g, '')).not.toMatch(/[a-z]/i);
    }
  });

  test.each(locales)('%s footer keeps accessible icon labels, localized feedback and the existing consent action', (locale) => {
    const messages = getMessagesForLang(locale);
    const onToast = jest.fn();
    render(footer(locale, onToast));
    for (const label of [messages.footer.iconCommunity, messages.common.videos, messages.common.live, messages.footer.iconWorld]) {
      const button = screen.getByRole('button', { name: label });
      expect(button.getAttribute('title')).toBe(label);
      fireEvent.click(button);
      expect(onToast).toHaveBeenLastCalledWith(expectedCopy[locale].unavailable.replace('{{label}}', label));
    }
    fireEvent.click(screen.getByRole('button', { name: messages.footer.cookieSettings }));
    expect(mockOpenPreferences).toHaveBeenCalledTimes(1);
    expect(onToast).toHaveBeenCalledTimes(4);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('switching EN to HI to GU to EN updates the same footer immediately without stale text or links', () => {
    const { container, rerender } = render(footer('en'));
    const root = container.firstElementChild;
    let previousLocale: RouteLocale = 'en';
    for (const locale of ['hi', 'gu', 'en'] as const) {
      rerender(footer(locale));
      const messages = getMessagesForLang(locale);
      const prefix = locale === 'en' ? '' : `/${locale}`;
      expect(container.firstElementChild).toBe(root);
      expect(screen.getAllByRole('link')).toHaveLength(19);
      expect(screen.getByRole('link', { name: expectedCopy[locale].about }).getAttribute('href')).toBe(`${prefix}/about-us`);
      expect(screen.getByRole('link', { name: expectedCopy[locale].guide }).getAttribute('href')).toBe(`${prefix}/community-reporter/guidelines`);
      expect(screen.queryByRole('link', { name: expectedCopy[previousLocale].about })).toBeNull();
      expect(screen.queryByRole('link', { name: expectedCopy[previousLocale].guide })).toBeNull();
      expect(screen.getByText(messages.footer.description)).toBeTruthy();
      expect(screen.getByText(messages.footer.copyright)).toBeTruthy();
      expect(screen.queryByText(getMessagesForLang(previousLocale).footer.description)).toBeNull();
      expect(screen.queryByText(getMessagesForLang(previousLocale).footer.copyright)).toBeNull();
      previousLocale = locale;
    }
  });
});

test.each(['hi', 'en'] as const)('Regional %s ready title/summary survive compaction and rendering without widening the Home policy', (locale) => {
  const cached = cachedArticle(locale, 'ready');
  const compact = compactRegionalInitialStories([cached], locale);
  const props = {
    requestedLang: locale, stateName: 'Gujarat', categoryLabel: 'Regional',
    emptyTitle: 'No stories', readMoreLabel: 'Read', fallbackCategoryLabel: 'Regional',
  };
  const { container, rerender } = render(localized(locale, <RegionalHomeStorySections {...props} stories={[cached]} />));
  expect(screen.getByText(copy[locale].title)).toBeTruthy();
  expect(screen.getByText(copy[locale].summary)).toBeTruthy();
  expect(screen.queryByText(cached.title)).toBeNull();
  const originalHtml = container.innerHTML;
  rerender(localized(locale, <RegionalHomeStorySections {...props} stories={compact} />));
  expect(container.innerHTML).toBe(originalHtml);
  expect(articleToHomeRightRailFeedItem(cached, locale).title).toBe('');
});

test('changing locale without reloading immediately removes old Latest text and updates controls', () => {
  const { rerender } = render(localized('gu', <HomeRightRailLatestNews items={[article('gu')]} lang="gu" />));
  expect(screen.getByText(article('gu').title)).toBeTruthy();
  rerender(localized('hi', <HomeRightRailLatestNews items={[article('gu')]} lang="hi" />));
  expect(screen.queryByText(article('gu').title)).toBeNull();
  expect(screen.getByRole('button', { name: getMessagesForLang('hi').categories.national })).toBeTruthy();
  rerender(localized('en', <HomeRightRailLatestNews items={[article('en')]} lang="en" />));
  expect(screen.getByText(article('en').title)).toBeTruthy();
  expect(screen.queryByRole('button', { name: getMessagesForLang('hi').categories.national })).toBeNull();
});

test('navigation keeps the current route, uses GU/HI/EN control order and discards late previous-locale reads', async () => {
  mockLocale = 'gu';
  let finishPrevious!: (value: Response) => void;
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = new URL(String(input), 'http://localhost');
    if (url.pathname !== '/api/public/news') return response([]);
    if (url.searchParams.get('lang') === 'gu') return new Promise<Response>((resolve) => { finishPrevious = resolve; });
    return response([article('hi', 'new-route')]);
  });
  const page = (locale: RouteLocale) => localized(locale, <>
    <LanguageSelector compact />
    <NewsPulseCategoryShell activeCategory="national" latestItems={[]} lang={locale}>Main stories</NewsPulseCategoryShell>
  </>);
  const { rerender } = render(page('gu'));
  const select = screen.getByRole('combobox');
  expect(within(select).getAllByRole('option').map((option) => option.getAttribute('value'))).toEqual(['gu', 'hi', 'en']);
  fireEvent.change(select, { target: { value: 'hi' } });
  expect(mockReplace).toHaveBeenLastCalledWith('/hi/national', '/hi/national', { locale: 'hi', shallow: false, scroll: false });
  mockLocale = 'hi';
  rerender(page('hi'));
  await waitFor(() => expect(screen.getByText(article('hi', 'new-route').title)).toBeTruthy());
  await act(async () => { finishPrevious(response([article('gu', 'late-response')])); });
  expect(screen.queryByText(article('gu', 'late-response').title)).toBeNull();
  expect(screen.getByText(article('hi', 'new-route').title)).toBeTruthy();
  const previousRequest = fetchMock.mock.calls.find(([input]) => String(input).includes('/api/public/news?lang=gu'));
  expect(previousRequest?.[1]?.signal.aborted).toBe(true);
});
