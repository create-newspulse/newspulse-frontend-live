import React from 'react';
import { act, render, screen, within } from '@testing-library/react';

import LatestPage from '../../pages/latest';
import type { RouteLocale } from '../../lib/localizedArticleFields';
import { LanguageProvider, getMessagesForLang } from '../../src/i18n/LanguageProvider';

let mockLocale: RouteLocale = 'en';

jest.mock('next/router', () => ({
  useRouter: () => ({
    locale: mockLocale,
    asPath: mockLocale === 'en' ? '/latest' : `/${mockLocale}/latest`,
  }),
}));
jest.mock('next/head', () => ({ __esModule: true, default: () => null }));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));
jest.mock('../../src/components/story/StoryImage', () => ({
  __esModule: true,
  default: ({ alt, src }: { alt: string; src?: string }) => <img alt={alt} src={src} />,
}));
jest.mock('../../lib/publicApiBase', () => ({ getPublicApiBaseUrl: () => 'http://127.0.0.1:3010' }));

const locales = ['en', 'hi', 'gu'] as const;
const originalFetch = global.fetch;
const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
let errorLog: jest.SpyInstance;

function story(id: string, language: RouteLocale, overrides: Record<string, unknown> = {}) {
  return {
    _id: id,
    slug: `persisted-${id}`,
    canonicalSlug: `unused-alias-${id}`,
    title: `${getMessagesForLang(language).categories.regional} ${id}`,
    content: `<p>Fixture body ${id}</p>`,
    category: 'regional',
    language,
    status: 'published',
    publishedAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  };
}

function translatedStory(locale: RouteLocale, variant: Record<string, unknown> | boolean) {
  return story('translated-story', locale === 'gu' ? 'en' : 'gu', {
    translations: { [locale]: variant },
  });
}

function response(items: unknown[], meta: Record<string, unknown> = {}) {
  return new Response(JSON.stringify({
    items, page: 1, limit: 40, total: items.length, totalPages: items.length ? 1 : 0, ...meta,
  }), { headers: { 'Content-Type': 'application/json' } });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

async function show(items: unknown[], locale: RouteLocale = 'en', meta: Record<string, unknown> = {}) {
  mockLocale = locale;
  fetchMock.mockResolvedValueOnce(response(items, meta));
  return act(async () => render(<LanguageProvider initialLang={locale}><LatestPage /></LanguageProvider>));
}

function cardLinks() {
  const feed = screen.queryByRole('region', { name: 'Latest stories' });
  return feed ? within(feed).queryAllByRole('link') : [];
}

beforeEach(() => {
  mockLocale = 'en';
  fetchMock.mockReset();
  global.fetch = fetchMock;
  errorLog = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe('Latest scoped editorial window', () => {
  test('reproduces the English older-record fallback without relying on the Original badge', async () => {
    const native = Array.from({ length: 30 }, (_, index) => story(`english-${index}`, 'en'));
    const older = Array.from({ length: 10 }, (_, index) => story(`older-gujarati-${index}`, 'gu', {
      translations: index === 9 ? { en: { categoryLabel: 'Regional' } } : undefined,
    }));
    await show([...native, ...older], 'en', { total: 58, totalPages: 2 });

    expect(cardLinks()).toHaveLength(30);
    expect(cardLinks().map((link) => link.getAttribute('href'))).toEqual(native.map((item) => `/news/${item.slug}`));
    expect(document.body.textContent).not.toContain('older-gujarati');
    expect(screen.queryByText(getMessagesForLang('en').content.original)).toBeNull();
  });

  test('reproduces the Fluidmac paid-article leak while preserving ordinary Business reporting', async () => {
    const paid = story('fluidmac-sponsored', 'en', {
      title: 'Fluidmac sponsored Business article', category: 'business',
      isSponsored: true, isSponsoredArticle: true, campaignStatus: 'expired',
    });
    const editorial = story('business-reporting', 'en', {
      title: 'Independent reporting about Fluidmac', category: 'business',
    });
    await show([paid, editorial]);

    expect(cardLinks().map((link) => link.getAttribute('href'))).toEqual([`/news/${editorial.slug}`]);
    expect(document.body.textContent).not.toContain(paid.title);
    expect(document.body.textContent).toContain(editorial.title);
  });

  test('localizes the raw English Business category identifier', async () => {
    await show([story('business-label', 'en', { category: 'business' })]);
    expect(cardLinks()[0].textContent).toContain(getMessagesForLang('en').categories.business);
    expect(screen.queryByText('business')).toBeNull();
  });

  test.each(locales)('%s remains one cancellable, no-store 40-record request, not a paginated archive', async (locale) => {
    const newer = story('newer', locale, { publishedAt: '2026-10-03T10:00:00.000Z' });
    const older = story('older', locale, { updatedAt: '2026-10-04T10:00:00.000Z' });
    await show([
      newer,
      story('paid', locale, { isSponsored: true }),
      older,
      story('foreign', locale === 'gu' ? 'en' : 'gu'),
    ], locale, { total: 999, totalPages: 25 });

    const [url, init] = fetchMock.mock.calls[0];
    const request = new URL(String(url), 'http://localhost');
    expect(request.pathname).toBe('/api/public/news');
    expect(request.searchParams.get('lang')).toBe(locale);
    expect(request.searchParams.get('language')).toBe(locale);
    expect(request.searchParams.get('limit')).toBe('40');
    expect(request.searchParams.has('page')).toBe(false);
    expect(request.searchParams.has('sponsoredOnly')).toBe(false);
    expect(request.searchParams.has('strictLocale')).toBe(false);
    expect(init?.cache).toBe('no-store');
    expect(init?.signal).toBeInstanceOf(AbortSignal);
    const prefix = locale === 'en' ? '' : `/${locale}`;
    expect(cardLinks().map((link) => link.getAttribute('href'))).toEqual([
      `${prefix}/news/${newer.slug}`, `${prefix}/news/${older.slug}`,
    ]);
    expect(screen.getByRole('link', { name: getMessagesForLang(locale).common.home }).getAttribute('href')).toBe(prefix || '/');
    expect(document.body.textContent).not.toContain('999');
    expect(screen.queryByRole('navigation')).toBeNull();
    act(() => window.dispatchEvent(new Event('scroll')));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(errorLog).not.toHaveBeenCalled();
  });

  describe.each(locales)('%s locale eligibility', (locale) => {
    const title = `${getMessagesForLang(locale).categories.regional} translated headline`;
    const complete = { title, content: '<p>Localized fixture body</p>', slug: `localized-${locale}` };

    test.each([1, 2])('filters an entire first/older batch (legacy envelope page %i), preserving encounter order', async (page) => {
      const native = story(`native-page-${page}`, locale);
      const approved = translatedStory(locale, { ...complete, status: 'APPROVED' });
      await show([
        native,
        story(`foreign-page-${page}`, locale === 'gu' ? 'en' : 'gu'),
        story(`sponsored-page-${page}`, locale, { isSponsoredArticle: true }),
        approved,
        story(`last-foreign-page-${page}`, locale === 'gu' ? 'hi' : 'gu'),
      ], locale, { page, total: 58, totalPages: 2 });

      const prefix = locale === 'en' ? '' : `/${locale}`;
      expect(cardLinks().map((link) => link.getAttribute('href'))).toEqual([
        `${prefix}/news/${native.slug}`, `${prefix}/news/${complete.slug}`,
      ]);
      expect(screen.queryByText(getMessagesForLang(locale).content.original)).toBeNull();
    });

    test.each([
      ['no variant', {}],
      ['availability boolean', true],
      ['category only', { categoryLabel: 'Regional' }],
      ['summary only', { summary: 'Localized summary' }],
      ['slug only', { slug: 'localized-slug' }],
      ['approved title only', { title, status: 'APPROVED' }],
      ['approved body only', { content: complete.content, status: 'APPROVED' }],
      ['ready title only', { title, status: 'READY' }],
      ['ready empty body', { title, content: '  ', status: 'READY' }],
      ['pending complete', { ...complete, status: 'PENDING' }],
      ['blocked complete', { ...complete, status: 'BLOCKED' }],
      ['rejected complete', { ...complete, status: 'REJECTED' }],
    ] as const)('rejects %s and renders a real eligible-empty state instead of a blank list', async (_label, variant) => {
      await show([translatedStory(locale, variant)], locale);
      expect(cardLinks()).toHaveLength(0);
      expect(screen.queryByRole('region', { name: 'Latest stories' })).toBeNull();
      expect(screen.getByText(getMessagesForLang(locale).categoryPage.noStoriesYet)).toBeTruthy();
      expect(errorLog).not.toHaveBeenCalled();
    });

    test.each(['APPROVED', undefined])('accepts a complete %s translation with its persisted localized slug', async (status) => {
      await show([translatedStory(locale, { ...complete, status })], locale);
      expect(cardLinks()).toHaveLength(1);
      expect(cardLinks()[0].textContent).toContain(title);
      expect(cardLinks()[0].getAttribute('href')).toBe(`${locale === 'en' ? '' : `/${locale}`}/news/${complete.slug}`);
    });

    test('uses the existing complete-READY policy for EN/HI, without extending it to GU', async () => {
      await show([translatedStory(locale, { ...complete, status: 'READY' })], locale);
      expect(cardLinks()).toHaveLength(locale === 'gu' ? 0 : 1);
    });

    test('preserves its own published original even when other-language translations are pending', async () => {
      const original = story('own-original', locale, {
        translations: { [locale === 'gu' ? 'en' : 'gu']: { title: 'Pending elsewhere', status: 'PENDING' } },
      });
      await show([original], locale);
      expect(cardLinks()).toHaveLength(1);
      expect(cardLinks()[0].textContent).toContain(original.title);
    });

    test.each([undefined, 'unsupported'])('does not assume a missing/unsupported source locale is English (%s)', async (language) => {
      await show([story('unknown-language', 'en', { language })], locale);
      expect(cardLinks()).toHaveLength(0);
      expect(screen.getByText(getMessagesForLang(locale).categoryPage.noStoriesYet)).toBeTruthy();
    });

    test('respects authoritative sourceLang before the display language alias', async () => {
      await show([story('source-mismatch', locale, { sourceLang: locale === 'gu' ? 'en' : 'gu' })], locale);
      expect(cardLinks()).toHaveLength(0);
    });

    test.each([
      { status: 'draft' }, { status: 'unpublished' }, { status: 'deleted' }, { isDeleted: true },
    ])('preserves the publication lifecycle for %j', async (override) => {
      await show([story('not-public', locale, override)], locale);
      expect(cardLinks()).toHaveLength(0);
      expect(screen.getByText(getMessagesForLang(locale).categoryPage.noStoriesYet)).toBeTruthy();
    });

    test.each([
      { isSponsored: true },
      { isSponsoredArticle: true },
      { isSponsoredArticle: true, campaignStatus: 'expired', campaignEndAt: '2020-01-01T00:00:00.000Z' },
      { isSponsored: true, campaignStatus: 'paused' },
      { articleType: 'sponsored-combo' },
      { sponsorFeatureLinkedId: 'verified-feature-id' },
    ])('excludes authoritative paid identity independently of campaign activity: %j', async (sponsorship) => {
      await show([story('paid-story', locale, sponsorship)], locale);
      expect(cardLinks()).toHaveLength(0);
      expect(screen.getByText(getMessagesForLang(locale).categoryPage.noStoriesYet)).toBeTruthy();
    });

    test.each([
      ['business', 'business'], ['tech', 'scienceTechnology'], ['tech-gadgets', 'techGadgets'],
      ['faith-culture', 'faithCulture'], ['pulse-dialogue', 'pulseDialogue'], ['national', 'national'],
    ])('localizes %s without rewriting its slug or stored category', async (category, labelKey) => {
      const original = story('category-story', locale, { category });
      await show([original], locale);
      const label = within(cardLinks()[0]).getByText(getMessagesForLang(locale).categories[labelKey]);
      expect(label.classList.contains('max-w-full')).toBe(true);
      expect(label.parentElement?.classList.contains('flex-wrap')).toBe(true);
      expect(screen.queryByText(category)).toBeNull();
      expect(original.category).toBe(category);
      expect(cardLinks()[0].getAttribute('href')).toBe(`${locale === 'en' ? '' : `/${locale}`}/news/${original.slug}`);
    });

    test('preserves an explicit localized label for an unknown category', async () => {
      const label = getMessagesForLang(locale).categories.regional;
      await show([story('unknown-category', locale, {
        category: 'unknown-desk', translations: { [locale]: { categoryLabel: label } },
      })], locale);
      expect(within(cardLinks()[0]).getByText(label)).toBeTruthy();
      expect(screen.queryByText('unknown-desk')).toBeNull();
    });

    test('distinguishes a genuine empty successful response from a failure', async () => {
      await show([], locale, { total: 0, totalPages: 0 });
      expect(screen.getByText(getMessagesForLang(locale).categoryPage.noStoriesYet)).toBeTruthy();
      expect(screen.queryByText(getMessagesForLang(locale).categoryPage.unableToLoadTitle)).toBeNull();
      expect(errorLog).not.toHaveBeenCalled();
    });

    test('surfaces HTTP 503 rather than a successful empty feed', async () => {
      mockLocale = locale;
      fetchMock.mockResolvedValueOnce(new Response('Service unavailable', { status: 503 }));
      await act(async () => render(<LanguageProvider initialLang={locale}><LatestPage /></LanguageProvider>));
      expect(screen.getByText(getMessagesForLang(locale).categoryPage.unableToLoadTitle)).toBeTruthy();
      expect(screen.getByText('API 503')).toBeTruthy();
      expect(screen.queryByText(getMessagesForLang(locale).categoryPage.noStoriesYet)).toBeNull();
      expect(errorLog).toHaveBeenCalled();
    });
  });

  test.each(['network', 'malformed'])('surfaces %s failures instead of fabricating an empty response', async (failure) => {
    if (failure === 'network') fetchMock.mockRejectedValueOnce(new TypeError('Fixture network failure'));
    else fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ items: [{ _id: 'incomplete' }] })));
    await act(async () => render(<LanguageProvider initialLang="en"><LatestPage /></LanguageProvider>));
    expect(screen.getByText(getMessagesForLang('en').categoryPage.unableToLoadTitle)).toBeTruthy();
    expect(screen.queryByText(getMessagesForLang('en').categoryPage.noStoriesYet)).toBeNull();
    expect(errorLog).toHaveBeenCalled();
  });

  test.each(['success', 'failure'])('cancels EN/HI reads and ignores their stale %s after switching to GU', async (outcome) => {
    const en = deferred<Response>();
    const hi = deferred<Response>();
    const gu = deferred<Response>();
    fetchMock.mockReturnValueOnce(en.promise).mockReturnValueOnce(hi.promise).mockReturnValueOnce(gu.promise);
    const view = render(<LanguageProvider initialLang="en"><LatestPage /></LanguageProvider>);
    mockLocale = 'hi';
    view.rerender(<LanguageProvider initialLang="en"><LatestPage /></LanguageProvider>);
    mockLocale = 'gu';
    view.rerender(<LanguageProvider initialLang="en"><LatestPage /></LanguageProvider>);

    expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
    expect(fetchMock.mock.calls[1][1]?.signal?.aborted).toBe(true);
    expect(fetchMock.mock.calls[2][1]?.signal?.aborted).toBe(false);
    const current = story('current-gu', 'gu');
    await act(async () => gu.resolve(response([current])));
    await act(async () => {
      en.resolve(outcome === 'success' ? response([story('stale-en', 'en')]) : new Response('', { status: 503 }));
      hi.resolve(outcome === 'success' ? response([story('stale-hi', 'hi')]) : new Response('', { status: 503 }));
    });
    expect(cardLinks().map((link) => link.getAttribute('href'))).toEqual([`/gu/news/${current.slug}`]);
    expect(document.body.textContent).not.toContain('stale-');
    expect(document.body.textContent).not.toContain('API 503');
  });

  test('clears old-locale content while loading and aborts the owned request on unmount', async () => {
    const pending = deferred<Response>();
    const current = story('previous-en', 'en');
    fetchMock.mockResolvedValueOnce(response([current])).mockReturnValueOnce(pending.promise);
    const view = render(<LanguageProvider initialLang="en"><LatestPage /></LanguageProvider>);
    await screen.findByText(current.title);
    mockLocale = 'gu';
    view.rerender(<LanguageProvider initialLang="en"><LatestPage /></LanguageProvider>);
    expect(cardLinks()).toHaveLength(0);
    expect(screen.getByRole('region', { name: 'Loading' })).toBeTruthy();
    const signal = fetchMock.mock.calls[1][1]?.signal;
    expect(signal?.aborted).toBe(false);
    view.unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => pending.resolve(response([story('after-unmount', 'gu')])));
    expect(errorLog).not.toHaveBeenCalled();
  });
});
