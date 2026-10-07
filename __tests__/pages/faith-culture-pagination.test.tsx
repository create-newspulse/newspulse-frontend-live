import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import FaithCulturePage from '../../pages/faith-culture';
import type { RouteLocale } from '../../lib/localizedArticleFields';
import { FAITH_CULTURE_PAGINATION_HEADER } from '../../lib/faithCulturePagination';
import { ORDINARY_PAGINATION_HEADER } from '../../lib/ordinaryCategoryPagination';
import { faithPage, faithStories, type FaithStory } from '../fixtures/faithCulture';

let mockLocale: RouteLocale = 'en';
let mockQuery: Record<string, string> = {};
const mockT = (key: string) => key;
jest.mock('next/router', () => ({
  useRouter: () => ({ locale: mockLocale, isReady: true, query: mockQuery, pathname: '/faith-culture', asPath: '/faith-culture' }),
}));
jest.mock('../../lib/publicApiBase', () => ({ getPublicApiBaseUrl: () => '' }));
jest.mock('../../utils/LanguageContext', () => ({ useLanguage: () => ({ language: mockLocale }) }));
jest.mock('../../src/i18n/LanguageProvider', () => ({ normalizeLang: (locale: string) => locale || 'en', useI18n: () => ({ t: mockT }) }));
jest.mock('../../components/NewsPulseCategoryShell', () => ({
  __esModule: true,
  default: ({ children, topContent }: { children: React.ReactNode; topContent?: React.ReactNode }) => <main>{topContent}{children}</main>,
}));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));
jest.mock('../../src/components/story/StoryImage', () => ({
  __esModule: true,
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
  TopStoryImage: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

function seed(stories: FaithStory[], locale: RouteLocale = mockLocale) {
  const { items, ...initialPagination } = faithPage(stories, 1);
  return { messages: {}, locale, initialItems: items, initialPagination };
}

function renderedIds() {
  return [...new Set(screen.queryAllByRole('link').map(link => link.getAttribute('href')?.match(/\/news\/([^/?#]+)$/)?.[1])
    .filter((id): id is string => Boolean(id && /^(en|hi|gu)-faith-/.test(id))))];
}

function moreButton() {
  return screen.getByRole('button', { name: 'Load More Faith & Culture Stories' });
}

async function clickMore() {
  await act(async () => { fireEvent.click(moreButton()); });
}

async function reveal(count: number) {
  for (let attempt = 0; renderedIds().length < count && attempt < 20; attempt += 1) await clickMore();
  expect(renderedIds()).toHaveLength(count);
}

describe('Faith route pagination without UI redesign', () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
  const requestedPages = () => fetchMock.mock.calls.map(([input]) => new URL(String(input), 'https://frontend.test').searchParams.get('page'));
  beforeEach(() => {
    mockLocale = 'en';
    mockQuery = {};
    fetchMock.mockReset();
    global.fetch = fetchMock;
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    cleanup();
    global.fetch = originalFetch;
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  function serve(stories: FaithStory[]) {
    fetchMock.mockImplementation(async (input, init) => {
      const url = new URL(String(input), 'https://frontend.test');
      expect(url.pathname).toBe('/api/public/news');
      expect(url.searchParams.get('category')).toBe('faith-culture');
      expect(url.searchParams.get('lang')).toBe(mockLocale);
      expect(url.searchParams.get('language')).toBe(mockLocale);
      expect(url.searchParams.get('limit')).toBe('30');
      expect(url.searchParams.get('strictLocale')).toBe('1');
      expect(new Headers(init?.headers).get(FAITH_CULTURE_PAGINATION_HEADER)).toBe('1');
      expect(new Headers(init?.headers).has(ORDINARY_PAGINATION_HEADER)).toBe(false);
      return new Response(JSON.stringify(faithPage(stories, Number(url.searchParams.get('page')))));
    });
  }

  test.each(['en', 'hi', 'gu'] as const)('%s loads 100 stories as 30/30/30/10 and keeps the same Top Story', async (locale) => {
    mockLocale = locale;
    const all = faithStories(locale);
    serve(all);
    render(<FaithCulturePage messages={{}} locale={locale} initialItems={[]} />);
    await screen.findByText(all[0].title);
    for (const page of [1, 2, 3, 4]) {
      if (page > 1) await clickMore();
      await reveal(Math.min(page * 30, 100));
      expect(renderedIds()).toEqual(all.slice(0, page * 30).map(item => item._id));
      expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(all[0].title);
      expect(fetchMock).toHaveBeenCalledTimes(page);
      for (const story of all.slice(0, page * 30)) expect(screen.getAllByText(story.title)).toHaveLength(1);
    }
    expect(requestedPages()).toEqual(['1', '2', '3', '4']);
    expect(screen.queryByRole('button', { name: 'Load More Faith & Culture Stories' })).toBeNull();
    expect(screen.getByText(/all caught up/i)).toBeTruthy();
  }, 20000);

  test.each([0, 3, 17])('an exhausted ISR seed of %i stories does not refetch after hydration', async (total) => {
    const all = faithStories('en', total);
    serve(all);
    render(<FaithCulturePage {...seed(all)} />);
    if (total) await reveal(total);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Load More Faith & Culture Stories' })).toBeNull();
  });

  test('overlapping pages append unique IDs and preserve distinct stories', async () => {
    const all = faithStories('en', 32);
    const backend = [...all.slice(0, 30), all[29], ...all.slice(30)];
    serve(backend);
    render(<FaithCulturePage {...seed(backend)} />);
    await reveal(30);
    await clickMore();
    await reveal(32);
    expect(renderedIds()).toEqual(all.map(item => item._id));
    expect(screen.getAllByText(all[29].title)).toHaveLength(1);
    expect(requestedPages()).toEqual(['2']);
  });

  test('empty search matches retain hasMore and each click reads only the next page', async () => {
    const all = faithStories('en', 61);
    all[60].summary = 'unique-search-match';
    mockQuery = { search: 'unique-search-match' };
    serve(all);
    render(<FaithCulturePage messages={{}} locale="en" initialItems={[]} />);
    await waitFor(() => expect(moreButton().getAttribute('disabled')).toBeNull());
    expect(requestedPages()).toEqual(['1']);
    await clickMore();
    expect(requestedPages()).toEqual(['1', '2']);
    expect(renderedIds()).toHaveLength(0);
    await clickMore();
    await screen.findByText(all[60].title);
    expect(requestedPages()).toEqual(['1', '2', '3']);
    expect(renderedIds()).toEqual([all[60]._id]);
    expect(screen.queryByRole('button', { name: 'Load More Faith & Culture Stories' })).toBeNull();
  });

  test.each([['en', 'hi'], ['hi', 'gu'], ['gu', 'en']] as const)('%s to %s resets page 1 and rejects a late old-locale page', async (from, to) => {
    mockLocale = from;
    const oldStories = faithStories(from);
    const nextStories = faithStories(to, 3);
    const initial = seed(oldStories, from);
    serve(oldStories);
    const view = render(<FaithCulturePage {...initial} />);
    await reveal(30);
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await clickMore();
    const oldSignal = fetchMock.mock.calls[0][1]?.signal;
    mockLocale = to;
    serve(nextStories);
    await act(async () => { view.rerender(<FaithCulturePage {...initial} />); });
    await screen.findByText(nextStories[0].title);
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => { finish(new Response(JSON.stringify(faithPage(oldStories, 2)))); });
    expect(renderedIds()).toEqual(nextStories.map(item => item._id));
    expect(requestedPages()).toEqual(['2', '1']);
  });

  test('search changes reset page 1 and cannot append a stale page 2', async () => {
    const all = faithStories('en');
    const initial = seed(all);
    serve(all);
    const view = render(<FaithCulturePage {...initial} />);
    await reveal(30);
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await clickMore();
    const oldSignal = fetchMock.mock.calls[0][1]?.signal;
    mockQuery = { search: all[0].title };
    await act(async () => { view.rerender(<FaithCulturePage {...initial} />); });
    await waitFor(() => expect(requestedPages()).toEqual(['2', '1']));
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => { finish(new Response(JSON.stringify(faithPage(all, 2)))); });
    expect(renderedIds()).toEqual([all[0]._id]);
  });

  test('503 preserves existing cards and retries the same page without showing private diagnostics', async () => {
    const all = faithStories('en', 31);
    serve(all);
    render(<FaithCulturePage {...seed(all)} />);
    await reveal(30);
    fetchMock.mockResolvedValueOnce(new Response('private database diagnostics', { status: 503 }));
    await clickMore();
    expect(renderedIds()).toEqual(all.slice(0, 30).map(item => item._id));
    expect(screen.getByText('errors.fetchFailed')).toBeTruthy();
    expect(screen.queryByText(/private database/)).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry' })); });
    await reveal(31);
    expect(requestedPages()).toEqual(['2', '2']);
  });

  test('an initial 503 is an explicit error, not an empty successful feed', async () => {
    fetchMock.mockResolvedValue(new Response('private database diagnostics', { status: 503 }));
    render(<FaithCulturePage messages={{}} locale="en" initialItems={[]} />);
    await screen.findByText('categoryPage.unableToLoadTitle');
    expect(screen.getByText('errors.fetchFailed')).toBeTruthy();
    expect(screen.queryByText('categoryPage.noStoriesYet')).toBeNull();
    expect(requestedPages()).toEqual(['1']);
  });

  test('concurrent Load More clicks share one next-page request', async () => {
    const all = faithStories('en', 31);
    serve(all);
    render(<FaithCulturePage {...seed(all)} />);
    await reveal(30);
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const button = moreButton();
    await act(async () => { fireEvent.click(button); fireEvent.click(button); });
    expect(requestedPages()).toEqual(['2']);
    await act(async () => { finish(new Response(JSON.stringify(faithPage(all, 2)))); });
    await reveal(31);
  });

  test.each([false, true])('60-second refresh uses fixed pages and retains the loaded range (failure=%s)', async (fail) => {
    jest.useFakeTimers();
    const all = faithStories('en', 60);
    serve(all);
    render(<FaithCulturePage {...seed(all)} />);
    await reveal(30);
    await clickMore();
    await reveal(60);
    if (fail) {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(faithPage(all, 1))));
      fetchMock.mockResolvedValueOnce(new Response('unavailable', { status: 503 }));
    }
    await act(async () => { await jest.advanceTimersByTimeAsync(60000); });
    await reveal(60);
    expect(renderedIds()).toEqual(all.map(item => item._id));
    expect(requestedPages()).toEqual(['2', '1', '2']);
  });
});
