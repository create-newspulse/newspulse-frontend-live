import React from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import GujaratPage from '../../pages/regional/gujarat';
import { compactRegionalInitialStories } from '../../lib/regionalListingStories';
import { getStateName, toLanguageKey } from '../../utils/localizedNames';

let mockLocale: 'en' | 'hi' | 'gu' = 'en';
jest.mock('next/router', () => ({ useRouter: () => ({ asPath: '/regional/gujarat', locale: mockLocale, query: {}, push: jest.fn(async () => true) }) }));
jest.mock('../../utils/LanguageContext', () => ({ useLanguage: () => ({ language: mockLocale }) }));
jest.mock('../../src/i18n/LanguageProvider', () => ({ normalizeLang: (locale: string) => locale || 'en', useI18n: () => ({ t: (key: string) => key }) }));
jest.mock('../../components/NewsPulseCategoryShell', () => ({ __esModule: true, default: ({ children, topContent, afterColumns }: { children: React.ReactNode; topContent?: React.ReactNode; afterColumns?: React.ReactNode }) => <>{topContent}<div data-testid="category-columns"><main>{children}</main></div><section data-testid="category-after-columns">{afterColumns}</section></> }));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ href, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a href={href} {...props}>{children}</a>,
}));
jest.mock('../../src/components/story/StoryImage', () => ({
  __esModule: true,
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
  TopStoryImage: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

function dataset(language: 'en' | 'hi' | 'gu', total = 100) {
  return Array.from({ length: total }, (_, index) => ({
    _id: `${language}-story-${index}`,
    slug: `${language}-story-${index}`,
    title: index ? `Regional ${language} story ${index}` : `October bridge ${language}`,
    summary: `Regional preview ${index}`,
    content: `Regional body ${index}`,
    category: 'regional',
    language,
    sourceLanguage: language,
    status: 'published',
    publishedAt: new Date(Date.parse('2026-10-03T20:15:33.097Z') - index * 86400000).toISOString(),
  }));
}

function pageResponse(items: ReturnType<typeof dataset>, page: number) {
  return new Response(JSON.stringify({
    items: items.slice((page - 1) * 30, page * 30),
    pagination: { page, limit: 30, total: items.length, totalPages: Math.ceil(items.length / 30), hasMore: page * 30 < items.length },
  }));
}

function initialProps(items: ReturnType<typeof dataset>, language: 'en' | 'hi' | 'gu') {
  return {
    initialStories: compactRegionalInitialStories(items.slice(0, 30), language),
    initialLocale: language,
    initialPagination: { page: 1, limit: 30, total: items.length, totalPages: Math.ceil(items.length / 30), hasMore: items.length > 30 },
  };
}

function renderedIds(): string[] {
  return [...new Set(screen.getAllByRole('link').map((link) => link.getAttribute('href')?.match(/\/news\/((?:en|hi|gu)-story-\d+)$/)?.[1]).filter((id): id is string => Boolean(id)))];
}

function loadMoreButton() {
  return screen.getByRole('button', { name: /^Load More .+ Stories$/ });
}

async function clickLoadMore() {
  await act(async () => { fireEvent.click(loadMoreButton()); });
}

async function revealLocalStories(count: number) {
  for (let attempt = 0; renderedIds().length < count && attempt < 20; attempt += 1) {
    await clickLoadMore();
  }
  expect(renderedIds()).toHaveLength(count);
}

describe('Regional fixed-page client loading', () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
  beforeEach(() => {
    mockLocale = 'en';
    fetchMock.mockReset();
    fetchMock.mockRejectedValue(new Error('Unexpected Regional request'));
    global.fetch = fetchMock;
  });
  afterEach(() => {
    cleanup();
    jest.useRealTimers();
    jest.restoreAllMocks();
    global.fetch = originalFetch;
  });

  test.each(['en', 'hi', 'gu'] as const)('%s displays the current ten-story batch and correct caught-up state without hydration fetches', (locale) => {
    mockLocale = locale;
    const items = dataset(locale, 10);
    render(<GujaratPage {...initialProps(items, locale)} />);
    expect(renderedIds()).toEqual(items.map((item) => item._id));
    const completion = screen.getByText(/all caught up/i);
    const continuation = screen.getByTestId('category-after-columns');
    const footer = continuation.querySelector('footer')!;
    expect(continuation.contains(completion)).toBe(true);
    expect(completion.closest('main')).toBeNull();
    expect(footer.closest('main')).toBeNull();
    expect(footer.textContent).toContain('regionalGujaratPage.regionalPulse');
    expect(footer.textContent).toContain(getStateName(toLanguageKey(locale), 'gujarat'));
    expect(footer.className).toBe('border-t border-slate-200 bg-white');
    expect(completion.compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('category-columns').compareDocumentPosition(footer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Load More .+ Stories$/ })).toBeNull();
    expect(screen.getByText(`October bridge ${locale}`)).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test.each(['en', 'hi', 'gu'] as const)('%s keeps the footer after columns on other tabs and resets local reveal on returning to Feed', async (locale) => {
    mockLocale = locale;
    const items = dataset(locale, 20);
    render(<GujaratPage {...initialProps(items, locale)} />);
    await revealLocalStories(20);
    expect(screen.getByText(/all caught up/i)).toBeTruthy();
    for (const tab of ['regionalUI.tabDistricts', 'regionalUI.tabMap']) {
      fireEvent.click(screen.getByText(tab));
      expect(screen.queryByText(/all caught up/i)).toBeNull();
      expect(screen.getByTestId('category-after-columns').querySelector('footer')).toBeTruthy();
      expect(screen.getByRole('main').querySelector('footer')).toBeNull();
    }
    fireEvent.click(screen.getByText('regionalUI.tabFeed'));
    expect(renderedIds()).toEqual(items.slice(0, 13).map((item) => item._id));
    expect(screen.queryByText(/all caught up/i)).toBeNull();
    expect(loadMoreButton().closest('main')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test.each(['en', 'hi', 'gu'] as const)('%s loads only pages 2, 3 and 4 with limit 30 and retains all 100 stories in order', async (locale) => {
    mockLocale = locale;
    const items = dataset(locale);
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input), 'https://frontend.test');
      expect(url.pathname).toBe('/api/public/regional');
      expect(url.searchParams.get('lang')).toBe(locale);
      expect(url.searchParams.get('limit')).toBe('30');
      return pageResponse(items, Number(url.searchParams.get('page')));
    });
    render(<GujaratPage {...initialProps(items, locale)} />);
    await revealLocalStories(30);
    expect(fetchMock).not.toHaveBeenCalled();
    for (const page of [2, 3, 4]) {
      await clickLoadMore();
      await waitFor(() => expect(loadMoreButton().getAttribute('disabled')).toBeNull());
      expect(fetchMock).toHaveBeenCalledTimes(page - 1);
      expect(new URL(String(fetchMock.mock.calls[page - 2][0]), 'https://frontend.test').searchParams.get('page')).toBe(String(page));
      expect(screen.queryByText(/all caught up/i)).toBeNull();
      await revealLocalStories(Math.min(page * 30, 100));
      expect(fetchMock).toHaveBeenCalledTimes(page - 1);
      expect(renderedIds()).toEqual(items.slice(0, page * 30).map((item) => item._id));
    }
    expect(screen.getByText(/all caught up/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Load More .+ Stories$/ })).toBeNull();
    expect(screen.getByText(`October bridge ${locale}`)).toBeTruthy();
  }, 15000);

  test('uses backend hasMore even when the selected first page has fewer than 30 stories', async () => {
    const items = dataset('en', 31);
    const props = initialProps(items, 'en');
    props.initialStories = compactRegionalInitialStories([items[0]], 'en');
    fetchMock.mockResolvedValueOnce(pageResponse(items, 2));
    render(<GujaratPage {...props} />);
    expect(screen.queryByText(/all caught up/i)).toBeNull();
    await clickLoadMore();
    await screen.findByText('Regional en story 30');
    expect(renderedIds()).toEqual([items[0]._id, items[30]._id]);
    expect(screen.getByText(/all caught up/i)).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(new URL(String(fetchMock.mock.calls[0][0]), 'https://frontend.test').searchParams.get('page')).toBe('2');
  });

  test('body-only search still fetches full matching records after compact initial props', async () => {
    const items = dataset('en', 1);
    items[0].content = 'A bodyonlykeyword that is not in the title, summary or excerpt.';
    const props = initialProps(items, 'en');
    expect(props.initialStories[0]).not.toHaveProperty('content');
    fetchMock.mockResolvedValueOnce(pageResponse(items, 1));
    render(<GujaratPage {...props} />);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'bodyonlykeyword' } });
    await screen.findByText('October bridge en');
    const url = new URL(String(fetchMock.mock.calls[0][0]), 'https://frontend.test');
    expect(url.searchParams.get('q')).toBe('bodyonlykeyword');
    expect(url.searchParams.get('page')).toBe('1');
    expect(url.searchParams.get('limit')).toBe('30');
    expect(renderedIds()).toEqual([items[0]._id]);
  });

  test('refreshes the loaded range as fixed pages without losing older loaded stories', async () => {
    jest.useFakeTimers();
    const items = dataset('en');
    fetchMock.mockImplementation(async (input) => pageResponse(items, Number(new URL(String(input), 'https://frontend.test').searchParams.get('page'))));
    render(<GujaratPage {...initialProps(items, 'en')} />);
    await revealLocalStories(30);
    await clickLoadMore();
    await waitFor(() => expect(loadMoreButton().getAttribute('disabled')).toBeNull());
    await revealLocalStories(60);
    items[0].title = 'Refreshed October bridge';
    await act(async () => { await jest.advanceTimersByTimeAsync(60_000); });
    expect(screen.getByText('Refreshed October bridge')).toBeTruthy();
    expect(screen.getByText('Regional en story 59')).toBeTruthy();
    expect(renderedIds()).toEqual(items.slice(0, 60).map((item) => item._id));
    const urls = fetchMock.mock.calls.map(([input]) => new URL(String(input), 'https://frontend.test'));
    expect(urls.map((url) => url.searchParams.get('page'))).toEqual(['2', '1', '2']);
    expect(urls.every((url) => url.searchParams.get('limit') === '30')).toBe(true);
  });

  test('keeps existing stories on a failed next page and retries that same page', async () => {
    const log = jest.spyOn(console, 'error').mockImplementation(() => {});
    const items = dataset('en');
    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 503 })).mockResolvedValueOnce(pageResponse(items, 2));
    render(<GujaratPage {...initialProps(items, 'en')} />);
    await revealLocalStories(30);
    await clickLoadMore();
    await screen.findByText('Regional feed unavailable (503)');
    expect(log).toHaveBeenCalled();
    expect(renderedIds()).toEqual(items.slice(0, 30).map((item) => item._id));
    expect(screen.queryByText(/all caught up/i)).toBeNull();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry' })); });
    await waitFor(() => expect(loadMoreButton().getAttribute('disabled')).toBeNull());
    await revealLocalStories(60);
    expect(fetchMock.mock.calls.map(([input]) => new URL(String(input), 'https://frontend.test').searchParams.get('page'))).toEqual(['2', '2']);
  });

  test('discards a stale Load More response after switching locale', async () => {
    const en = dataset('en');
    const hi = dataset('hi', 10);
    let finishOldRequest: ((response: Response) => void) | undefined;
    fetchMock.mockImplementationOnce(() => new Promise<Response>((resolve) => { finishOldRequest = resolve; }))
      .mockResolvedValueOnce(pageResponse(hi, 1));
    const props = initialProps(en, 'en');
    const view = render(<GujaratPage {...props} />);
    await revealLocalStories(30);
    await clickLoadMore();
    mockLocale = 'hi';
    view.rerender(<GujaratPage {...props} />);
    await screen.findByText('October bridge hi');
    const finish = finishOldRequest;
    if (!finish) throw new Error('Expected an in-flight English page');
    await act(async () => { finish(pageResponse(en, 2)); });
    expect(renderedIds()).toEqual(hi.map((item) => item._id));
    expect(screen.queryByText('October bridge en')).toBeNull();
    expect(screen.getByText(/all caught up/i)).toBeTruthy();
    const urls = fetchMock.mock.calls.map(([input]) => new URL(String(input), 'https://frontend.test'));
    expect(urls.map((url) => [url.searchParams.get('lang'), url.searchParams.get('page')])).toEqual([['en', '2'], ['hi', '1']]);
  });
});
