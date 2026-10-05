import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CategoryFeedPage from '../../components/CategoryFeedPage';
import NationalPage from '../../pages/national';
import { ORDINARY_PAGINATION_HEADER } from '../../lib/ordinaryCategoryPagination';

type Locale = 'en' | 'hi' | 'gu';
const routes = [
  ['national', 'national', 20], ['international', 'international', 30], ['business', 'business', 30],
  ['science-technology', 'tech', 30], ['tech-gadgets', 'tech-gadgets', 30],
  ['sports', 'sports', 30], ['lifestyle', 'lifestyle', 30], ['glamour', 'glamour', 30],
] as const;
let mockLocale: Locale = 'en';
const mockReplace = jest.fn(async () => true);
let mockQuery: Record<string, string> = {};
const mockT = (key: string) => ({
  'topics.all': 'All', 'topics.politics': 'Politics', 'topics.crime': 'Crime',
  'nationalPage.searchPlaceholder': 'Search National',
  'nationalPage.filterByStateOrUt': 'Filter state',
  'nationalPage.sortStories': 'Sort stories',
  'nationalPage.sortLatest': 'Latest',
  'nationalPage.sortMostRead': 'Most Read',
}[key] || key);

jest.mock('next/router', () => ({
  useRouter: () => ({ locale: mockLocale, isReady: true, query: mockQuery, pathname: '/national', asPath: '/national', replace: mockReplace }),
}));
jest.mock('../../lib/publicApiBase', () => ({ getPublicApiBaseUrl: () => '' }));
jest.mock('../../utils/LanguageContext', () => ({ useLanguage: () => ({ language: mockLocale }) }));
jest.mock('../../src/i18n/LanguageProvider', () => ({ normalizeLang: (locale: string) => locale || 'en', useI18n: () => ({ t: mockT }) }));
jest.mock('../../components/NewsPulseCategoryShell', () => ({
  __esModule: true,
  default: ({ children, topContent }: { children: React.ReactNode; topContent?: React.ReactNode }) => <main>{topContent}{children}</main>,
}));
jest.mock('../../components/regional/BreakingTicker', () => ({ __esModule: true, default: () => null }));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));
jest.mock('../../src/components/story/StoryImage', () => ({
  __esModule: true,
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
  TopStoryImage: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

function dataset(category: string, language: Locale, total = 100) {
  const titlePrefix = language === 'hi' ? '\u0938\u092e\u093e\u091a\u093e\u0930' : language === 'gu' ? '\u0ab8\u0aae\u0abe\u0a9a\u0abe\u0ab0' : 'Story';
  return Array.from({ length: total }, (_, index) => ({
    _id: `${language}-${category}-${index}`, slug: `${language}-${category}-${index}`,
    title: `${titlePrefix} ${language}-${category}-${index}`, summary: `Summary ${index}`, content: `Body ${index}`,
    language, category, status: 'published', topic: index % 2 ? 'Crime' : 'Politics',
    location: index % 2 ? 'Mumbai, Maharashtra' : 'New Delhi, Delhi',
    publishedAt: new Date(Date.parse('2026-09-30T12:00:00.000Z') - index * 86400000).toISOString(),
    updatedAt: '2026-10-01T12:00:00.000Z', reads: index,
  }));
}

type Stories = ReturnType<typeof dataset>;

function pageResponse(items: Stories, page: number, limit: number) {
  return new Response(JSON.stringify({
    items: items.slice((page - 1) * limit, page * limit), page, limit,
    total: items.length, totalPages: Math.max(1, Math.ceil(items.length / limit)),
  }));
}

function pageElement(route: string, items: Stories, locale: Locale, limit: number) {
  const pagination = { page: 1, limit, total: items.length, totalPages: Math.max(1, Math.ceil(items.length / limit)), hasMore: items.length > limit };
  return route === 'national'
    ? <NationalPage lang={locale} data={items.slice(0, limit)} initialPagination={pagination} />
    : <CategoryFeedPage title={route} categoryKey={route} useCategoryShell initialItems={items.slice(0, limit)} initialLocale={locale} initialPagination={pagination} />;
}

function renderedIds() {
  return [...new Set(screen.queryAllByRole('link').map((link) => link.getAttribute('href')?.match(/\/news\/([^/?#]+)$/)?.[1])
    .filter((id): id is string => Boolean(id && /^(en|hi|gu)-/.test(id))))];
}

function moreButton() {
  return screen.getByRole('button', { name: /^Load More .+ Stories$/ });
}

async function clickMore() {
  await act(async () => { fireEvent.click(moreButton()); });
}

async function reveal(count: number) {
  for (let attempt = 0; renderedIds().length < count && attempt < 25; attempt += 1) await clickMore();
  expect(renderedIds()).toHaveLength(count);
}

describe('ordinary category page loading', () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
  const newsCalls = () => fetchMock.mock.calls.filter(([input]) => String(input).includes('/api/public/news?'));
  beforeEach(() => {
    mockLocale = 'en';
    mockQuery = {};
    mockReplace.mockClear();
    fetchMock.mockReset();
    global.fetch = fetchMock;
    jest.spyOn(console, 'debug').mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    global.fetch = originalFetch;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function serve(items: Stories, category: string, limit: number) {
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'https://frontend.test');
      if (url.pathname.startsWith('/api/ticker/')) return new Response(JSON.stringify({ items: [{ _id: 'live', title: 'Live' }] }));
      expect(url.pathname).toBe('/api/public/news');
      expect(url.searchParams.get('category')).toBe(category);
      expect(url.searchParams.get('lang')).toBe(mockLocale);
      expect(url.searchParams.get('language')).toBe(mockLocale);
      expect(url.searchParams.get('limit')).toBe(String(limit));
      expect(url.searchParams.get('strictLocale')).toBe(category === 'national' ? null : '1');
      expect(new Headers(init?.headers).get(ORDINARY_PAGINATION_HEADER)).toBe('1');
      return pageResponse(items, Number(url.searchParams.get('page')), limit);
    });
  }

  describe.each(routes)('/%s (%s, batch %i)', (route, category, limit) => {
    test.each(['en', 'hi', 'gu'] as const)('%s appends 100 stories with no cumulative limit, gaps, duplicates or Top Story changes', async (locale) => {
      mockLocale = locale;
      const items = dataset(category, locale);
      serve(items, category, limit);
      await act(async () => { render(pageElement(route, items, locale, limit)); });
      await reveal(limit);
      expect(newsCalls()).toHaveLength(0);
      for (let page = 2; page <= Math.ceil(100 / limit); page += 1) {
        await clickMore();
        await waitFor(() => expect(moreButton().getAttribute('disabled')).toBeNull());
        expect(newsCalls()).toHaveLength(page - 1);
        await reveal(Math.min(page * limit, 100));
        expect(renderedIds()).toEqual(items.slice(0, page * limit).map((item) => item._id));
        expect(screen.getByText(items[0].title)).toBeTruthy();
        expect(Boolean(screen.queryByText(/all caught up/i))).toBe(page * limit >= 100);
      }
      expect(newsCalls().map(([input]) => new URL(String(input), 'https://frontend.test').searchParams.get('page'))).toEqual(
        Array.from({ length: Math.ceil(100 / limit) - 1 }, (_, index) => String(index + 2))
      );
    }, 20000);

    test('a known small or empty initial dataset has correct exhaustion without a duplicate request', async () => {
      const total = category === 'national' ? 17 : category === 'international' ? 7 : category === 'business' ? 2
        : category === 'sports' || category === 'glamour' ? 1 : 0;
      const items = dataset(category, 'en', total);
      serve(items, category, limit);
      await act(async () => { render(pageElement(route, items, 'en', limit)); });
      if (total) {
        await reveal(total);
        expect(screen.getByText(/all caught up/i)).toBeTruthy();
      }
      expect(newsCalls()).toHaveLength(0);
      expect(screen.queryByRole('button', { name: /^Load More .+ Stories$/ })).toBeNull();
    });
  });

  test.each(['business', 'national'])('%s advances after an entirely filtered page and retains the actual page number', async (category) => {
    const limit = category === 'national' ? 20 : 30;
    const items = dataset(category, 'en', limit * 2 + 1);
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input), 'https://frontend.test');
      if (url.pathname.startsWith('/api/ticker/')) return new Response(JSON.stringify({ items: [{ _id: 'live' }] }));
      const page = Number(url.searchParams.get('page'));
      const response = items.slice((page - 1) * limit, page * limit).map((item) => page === 2 ? { ...item, status: 'draft' } : item);
      return new Response(JSON.stringify({ items: response, page, limit, total: items.length, totalPages: 3 }));
    });
    await act(async () => { render(pageElement(category, items, 'en', limit)); });
    await reveal(limit);
    await clickMore();
    await reveal(limit + 1);
    expect(newsCalls().map(([input]) => new URL(String(input), 'https://frontend.test').searchParams.get('page'))).toEqual(['2', '3']);
    expect(renderedIds()).toEqual([...items.slice(0, limit), items[limit * 2]].map((item) => item._id));
    expect(screen.getByText(/all caught up/i)).toBeTruthy();
  });

  test.each(['business', 'national'])('%s dedupes page overlap without losing distinct stories', async (category) => {
    const limit = category === 'national' ? 20 : 30;
    const items = dataset(category, 'en', limit + 2);
    const backend = [...items.slice(0, limit), items[limit - 1], ...items.slice(limit)];
    serve(backend, category, limit);
    await act(async () => { render(pageElement(category, backend, 'en', limit)); });
    await reveal(limit);
    await clickMore();
    await reveal(items.length);
    expect(renderedIds()).toEqual(items.map((item) => item._id));
    expect(screen.getByText(/all caught up/i)).toBeTruthy();
  });

  test.each(['business', 'national'])('%s retains loaded stories and retries the same page after a failure', async (category) => {
    const limit = category === 'national' ? 20 : 30;
    const items = dataset(category, 'en', limit + 1);
    serve(items, category, limit);
    await act(async () => { render(pageElement(category, items, 'en', limit)); });
    await reveal(limit);
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ error: 'Temporary failure' }), { status: 503 }));
    await clickMore();
    expect(renderedIds()).toEqual(items.slice(0, limit).map((item) => item._id));
    expect(screen.getByText(/Temporary failure/)).toBeTruthy();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry' })); });
    await reveal(items.length);
    expect(newsCalls().map(([input]) => new URL(String(input), 'https://frontend.test').searchParams.get('page'))).toEqual(['2', '2']);
  });

  test.each(['business', 'national'])('%s aborts an old locale page and never appends it to the new feed', async (category) => {
    const limit = category === 'national' ? 20 : 30;
    const english = dataset(category, 'en');
    const hindi = dataset(category, 'hi', 5);
    serve(english, category, limit);
    let finish!: (response: Response) => void;
    const view = render(pageElement(category, english, 'en', limit));
    await reveal(limit);
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await clickMore();
    const oldSignal = newsCalls()[0][1]?.signal;
    mockLocale = 'hi';
    serve(hindi, category, limit);
    await act(async () => {
      view.rerender(category === 'national'
        ? <NationalPage lang="en" data={english.slice(0, limit)} />
        : <CategoryFeedPage title={category} categoryKey={category} useCategoryShell initialItems={english.slice(0, limit)} initialLocale="en" />);
    });
    await screen.findByText(hindi[0].title);
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => { finish(pageResponse(english, 2, limit)); });
    expect(renderedIds()).toEqual(hindi.map((item) => item._id));
  });

  test.each(['business', 'national'])('%s does not send duplicate requests for concurrent Load More clicks', async (category) => {
    const limit = category === 'national' ? 20 : 30;
    const items = dataset(category, 'en', limit + 1);
    serve(items, category, limit);
    await act(async () => { render(pageElement(category, items, 'en', limit)); });
    await reveal(limit);
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    const button = moreButton();
    await act(async () => { fireEvent.click(button); fireEvent.click(button); });
    expect(newsCalls()).toHaveLength(1);
    await act(async () => { finish(pageResponse(items, 2, limit)); });
    await reveal(items.length);
  });

  test.each(['business', 'national'])('%s initial search uses one page request and the existing local predicate', async (category) => {
    const limit = category === 'national' ? 20 : 30;
    const items = dataset(category, 'en', 10);
    mockQuery = { search: `${category}-0` };
    serve(items, category, limit);
    await act(async () => {
      render(category === 'national'
        ? <NationalPage lang="en" data={null} />
        : <CategoryFeedPage title={category} categoryKey={category} useCategoryShell />);
    });
    await screen.findByText(items[0].title);
    expect(renderedIds()).toEqual([items[0]._id]);
    expect(newsCalls()).toHaveLength(1);
    expect(new URL(String(newsCalls()[0][0]), 'https://frontend.test').searchParams.get('page')).toBe('1');
  });

  test.each(['business', 'national'])('%s refreshes the loaded range in bounded pages without dropping older loaded stories', async (category) => {
    jest.useFakeTimers();
    const limit = category === 'national' ? 20 : 30;
    const items = dataset(category, 'en', limit * 2);
    serve(items, category, limit);
    await act(async () => { render(pageElement(category, items, 'en', limit)); });
    await reveal(limit);
    await clickMore();
    await reveal(limit * 2);
    await act(async () => { await jest.advanceTimersByTimeAsync(category === 'national' ? 45000 : 60000); });
    await reveal(limit * 2);
    expect(renderedIds()).toEqual(items.map((item) => item._id));
    expect(newsCalls().map(([input]) => new URL(String(input), 'https://frontend.test').searchParams.get('page'))).toEqual(['2', '1', '2']);
  });

  test.each(['business', 'national'])('%s superseded refresh cannot continue skipping filtered pages after Load More', async (category) => {
    jest.useFakeTimers();
    const limit = category === 'national' ? 20 : 30;
    const items = dataset(category, 'en', limit * 3);
    serve(items, category, limit);
    await act(async () => { render(pageElement(category, items, 'en', limit)); });
    await reveal(limit);
    let finishRefresh!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { finishRefresh = resolve; }));
    await act(async () => { await jest.advanceTimersByTimeAsync(category === 'national' ? 45000 : 60000); });
    await clickMore();
    await reveal(limit * 2);
    await act(async () => {
      finishRefresh(pageResponse(items.map((item) => ({ ...item, status: 'draft' })), 1, limit));
    });
    expect(newsCalls().map(([input]) => new URL(String(input), 'https://frontend.test').searchParams.get('page'))).toEqual(['1', '2']);
    expect(renderedIds()).toEqual(items.slice(0, limit * 2).map((item) => item._id));
  });

  test('shared route search resets page 1 and cannot append the old page 2 response', async () => {
    const items = dataset('business', 'en');
    serve(items, 'business', 30);
    const initial = items.slice(0, 30);
    const props = { title: 'Business', categoryKey: 'business', useCategoryShell: true, initialItems: initial, initialLocale: 'en' };
    const view = render(<CategoryFeedPage {...props} />);
    await reveal(30);
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await clickMore();
    mockQuery = { search: 'business-0' };
    await act(async () => { view.rerender(<CategoryFeedPage {...props} />); });
    await waitFor(() => expect(newsCalls()).toHaveLength(2));
    await act(async () => { finish(pageResponse(items, 2, 30)); });
    expect(renderedIds()).toEqual([items[0]._id]);
    expect(newsCalls().map(([input]) => new URL(String(input), 'https://frontend.test').searchParams.get('page'))).toEqual(['2', '1']);
    mockQuery = {};
    await act(async () => { view.rerender(<CategoryFeedPage {...props} />); });
    await waitFor(() => expect(newsCalls()).toHaveLength(3));
    await reveal(30);
    expect(renderedIds()).toEqual(initial.map((item) => item._id));
  });

  test('changing a shared category rejects its old page and restarts the new category at page 1', async () => {
    const business = dataset('business', 'en');
    const gadgets = dataset('tech-gadgets', 'en', 3);
    const initial = business.slice(0, 30);
    const props = { title: 'Business', categoryKey: 'business', useCategoryShell: true, initialItems: initial, initialLocale: 'en' };
    serve(business, 'business', 30);
    const view = render(<CategoryFeedPage {...props} />);
    await reveal(30);
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await clickMore();
    const oldSignal = newsCalls()[0][1]?.signal;
    serve(gadgets, 'tech-gadgets', 30);
    await act(async () => { view.rerender(<CategoryFeedPage {...props} categoryKey="tech-gadgets" />); });
    await screen.findByText(gadgets[0].title);
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => { finish(pageResponse(business, 2, 30)); });
    expect(renderedIds()).toEqual(gadgets.map((item) => item._id));
    expect(newsCalls().map(([input]) => {
      const url = new URL(String(input), 'https://frontend.test');
      return [url.searchParams.get('category'), url.searchParams.get('page')];
    })).toEqual([['business', '2'], ['tech-gadgets', '1']]);
  });

  test.each(['topic', 'state', 'search'])('National %s change resets page 1 and rejects an old page response', async (control) => {
    const items = dataset('national', 'en');
    serve(items, 'national', 20);
    await act(async () => { render(pageElement('national', items, 'en', 20)); });
    await reveal(20);
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await clickMore();
    const oldSignal = newsCalls()[0][1]?.signal;
    await act(async () => {
      if (control === 'topic') fireEvent.click(screen.getByRole('button', { name: 'Politics' }));
      if (control === 'state') fireEvent.change(screen.getByRole('combobox', { name: 'Filter state' }), { target: { value: 'delhi' } });
      if (control === 'search') fireEvent.change(screen.getByPlaceholderText('Search National'), { target: { value: 'national-0' } });
    });
    await waitFor(() => expect(newsCalls()).toHaveLength(2));
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => { finish(pageResponse(items, 2, 20)); });
    const expected = control === 'search' ? [items[0]] : items.slice(0, 20).filter((_, index) => index % 2 === 0);
    expect(renderedIds()).toEqual(expected.map((item) => item._id));
    expect(newsCalls().map(([input]) => new URL(String(input), 'https://frontend.test').searchParams.get('page'))).toEqual(['2', '1']);
  });

  test('National retains its user-selected Most Read view without a new feed request', async () => {
    const items = dataset('national', 'en', 10);
    serve(items, 'national', 20);
    await act(async () => { render(pageElement('national', items, 'en', 20)); });
    fireEvent.change(screen.getByRole('combobox', { name: 'Sort stories' }), { target: { value: 'most-read' } });
    expect(renderedIds()[0]).toBe(items[9]._id);
    expect(newsCalls()).toHaveLength(0);
  });
});
