import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HomeTrendingStrip } from '../../components/home/HomeSharedFeatureModules';
import { LanguageProvider, getMessagesForLang } from '../../src/i18n/LanguageProvider';
import { DEFAULT_TRENDING_TOPICS } from '../../src/config/trendingTopics';
import { jsonResponse, topicNames } from '../fixtures/editorialTopics';
import type { RouteLocale } from '../../lib/localizedArticleFields';
import { dispatchPublicDataRefresh } from '../../lib/publicDataRefresh';
import { EDITORIAL_TOPICS_TIMEOUT_MS } from '../../lib/publicEditorialTopics';

const mockRouter = { locale: 'en', push: jest.fn(async () => true) };
jest.mock('next/router', () => ({ useRouter: () => mockRouter }));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}));

const originalFetch = global.fetch;
const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
function editorial(lang: RouteLocale, key = 'navratri-2026') {
  return { key, label: topicNames[lang], href: `/topic/${key}`, colorKey: 'sports', source: 'editorial' };
}
beforeEach(() => {
  fetchMock.mockReset();
  mockRouter.push.mockClear();
  global.fetch = fetchMock;
});
afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test.each(['en', 'hi', 'gu'] as const)('shared %s strip prepends backend labels and preserves dictionary shortcuts and markup', async (lang) => {
  const interval = jest.spyOn(global, 'setInterval');
  fetchMock.mockResolvedValue(jsonResponse({ items: [editorial(lang), ...DEFAULT_TRENDING_TOPICS] }));
  let view!: ReturnType<typeof render>;
  await act(async () => { view = render(<LanguageProvider initialLang={lang}><HomeTrendingStrip /></LanguageProvider>); });
  const { container, rerender } = view;
  const link = screen.getByRole('link', { name: topicNames[lang] });
  const links = Array.from(container.querySelectorAll('a'));
  expect(links.map((item) => item.getAttribute('href'))).toEqual(['/topic/navratri-2026', ...DEFAULT_TRENDING_TOPICS.map((item) => item.href)]);
  const dictionary = getMessagesForLang(lang);
  expect(links[1].textContent).toBe(dictionary.trending.breaking);
  expect(links[2].textContent).toBe(dictionary.trending.sports);
  expect(container.querySelectorAll('a[href="/business"]')).toHaveLength(3);
  expect(container.querySelector('.trending-shell .trending-shell-inner .trending-surface')).not.toBeNull();
  expect(container.querySelector('.np-no-scrollbar.w-full.overflow-x-auto')).not.toBeNull();
  expect(link.className).toBe(links[2].className);
  expect(container.querySelectorAll('svg.lucide-flame')).toHaveLength(1);
  rerender(<LanguageProvider initialLang={lang}><HomeTrendingStrip /></LanguageProvider>);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock.mock.calls[0][0]).toBe(`/api/public/trending-topics?lang=${lang}`);
  expect(interval).not.toHaveBeenCalled();
  fireEvent.click(link);
  expect(mockRouter.push).toHaveBeenCalledWith('/topic/navratri-2026');
});

test('shared strip remains the original nine shortcuts when no editorial topics exist', async () => {
  fetchMock.mockResolvedValue(jsonResponse({ items: DEFAULT_TRENDING_TOPICS }));
  const { container } = render(<LanguageProvider initialLang="en"><HomeTrendingStrip /></LanguageProvider>);
  await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  expect(Array.from(container.querySelectorAll('a')).map((link) => link.getAttribute('href'))).toEqual(DEFAULT_TRENDING_TOPICS.map((topic) => topic.href));
});

test('an editorial topic using a known legacy key still displays its backend label', async () => {
  fetchMock.mockResolvedValue(jsonResponse({ items: [editorial('gu', 'sports'), ...DEFAULT_TRENDING_TOPICS] }));
  render(<LanguageProvider initialLang="gu"><HomeTrendingStrip /></LanguageProvider>);
  expect((await screen.findByRole('link', { name: topicNames.gu })).getAttribute('href')).toBe('/topic/sports');
});

test('changing language fetches once for the new locale and discards a late old-locale response', async () => {
  let finishEnglish!: (response: Response) => void;
  fetchMock.mockImplementation((input) => String(input).endsWith('lang=en')
    ? new Promise((resolve) => { finishEnglish = resolve; })
    : Promise.resolve(jsonResponse({ items: [editorial('hi'), ...DEFAULT_TRENDING_TOPICS] })));
  const { rerender } = render(<LanguageProvider initialLang="en"><HomeTrendingStrip /></LanguageProvider>);
  rerender(<LanguageProvider initialLang="hi"><HomeTrendingStrip /></LanguageProvider>);
  await screen.findByRole('link', { name: topicNames.hi });
  await act(async () => { finishEnglish(jsonResponse({ items: [editorial('en')] })); });
  expect(screen.queryByRole('link', { name: topicNames.en })).toBeNull();
  expect(screen.getByRole('link', { name: topicNames.hi })).not.toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(fetchMock.mock.calls[0][1]?.signal?.aborted).toBe(true);
});

function versionEvent(version = 'mounted-change') {
  dispatchPublicDataRefresh({ version, previousVersion: null, source: 'test' });
}

describe.each(['en', 'hi', 'gu'] as const)('%s mounted Trending lifecycle', (lang) => {
  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock.mockResolvedValue(jsonResponse({ items: [editorial(lang), ...DEFAULT_TRENDING_TOPICS] }));
  });

  test('refreshes current-locale labels and ordered membership without polling', async () => {
    const interval = jest.spyOn(global, 'setInterval');
    let view!: ReturnType<typeof render>;
    await act(async () => { view = render(<LanguageProvider initialLang={lang}><HomeTrendingStrip /></LanguageProvider>); });
    expect(screen.getByRole('link', { name: topicNames[lang] })).not.toBeNull();
    const updated = [
      { ...editorial(lang, 'new-topic'), label: `${topicNames[lang]} new` },
      { ...editorial(lang), label: `${topicNames[lang]} edited` },
      ...DEFAULT_TRENDING_TOPICS,
    ];
    fetchMock.mockResolvedValue(jsonResponse({ items: updated }));
    await act(async () => { versionEvent(); });
    expect(Array.from(view.container.querySelectorAll('a')).map((link) => link.getAttribute('href'))).toEqual(updated.map((topic) => topic.href));
    expect(screen.getByRole('link', { name: `${topicNames[lang]} edited` })).not.toBeNull();
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `/api/public/trending-topics?lang=${lang}`, `/api/public/trending-topics?lang=${lang}`,
    ]);
    expect(interval).not.toHaveBeenCalled();
  });

  test.each(['network', '503', 'malformed', 'editorial-fallback', 'timeout'])('%s retains the previous valid list; genuine empty can remove editorial chips', async (failure) => {
    render(<LanguageProvider initialLang={lang}><HomeTrendingStrip /></LanguageProvider>);
    await screen.findByRole('link', { name: topicNames[lang] });
    if (failure === 'timeout') {
      jest.useFakeTimers();
      fetchMock.mockImplementation(() => new Promise(() => {}));
    } else if (failure === 'network') fetchMock.mockRejectedValue(new Error('offline'));
    else if (failure === '503') fetchMock.mockResolvedValue(jsonResponse({}, 503));
    else if (failure === 'malformed') fetchMock.mockResolvedValue(jsonResponse({ items: [null] }));
    else fetchMock.mockResolvedValue(jsonResponse({ items: DEFAULT_TRENDING_TOPICS, editorialReadError: true }));
    await act(async () => {
      versionEvent('failed-refresh');
      if (failure === 'timeout') await jest.advanceTimersByTimeAsync(EDITORIAL_TOPICS_TIMEOUT_MS);
    });
    expect(screen.getByRole('link', { name: topicNames[lang] })).not.toBeNull();
    expect(console.warn).toHaveBeenCalled();
    fetchMock.mockResolvedValue(jsonResponse({ items: [] }));
    await act(async () => { versionEvent('successful-empty'); });
    expect(screen.queryByRole('link', { name: topicNames[lang] })).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(DEFAULT_TRENDING_TOPICS.length);
  });

  test('a superseded response cannot undo newer authoritative membership', async () => {
    render(<LanguageProvider initialLang={lang}><HomeTrendingStrip /></LanguageProvider>);
    await screen.findByRole('link', { name: topicNames[lang] });
    let finishOld!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }));
    await act(async () => { versionEvent('older'); });
    const oldSignal = fetchMock.mock.calls[1][1]?.signal;
    fetchMock.mockResolvedValue(jsonResponse({ items: [{ ...editorial(lang), label: `${topicNames[lang]} newest` }] }));
    await act(async () => { versionEvent('newer'); });
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => { finishOld(jsonResponse({ items: [] })); });
    expect(screen.getByRole('link', { name: `${topicNames[lang]} newest` })).not.toBeNull();
  });

  test('locale ownership aborts a lifecycle read and only refreshes the new locale', async () => {
    const nextLang: RouteLocale = lang === 'en' ? 'hi' : lang === 'hi' ? 'gu' : 'en';
    const view = render(<LanguageProvider initialLang={lang}><HomeTrendingStrip /></LanguageProvider>);
    await screen.findByRole('link', { name: topicNames[lang] });
    let finishOld!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { finishOld = resolve; }));
    await act(async () => { versionEvent('old-locale'); });
    const oldSignal = fetchMock.mock.calls[1][1]?.signal;
    fetchMock.mockResolvedValue(jsonResponse({ items: [editorial(nextLang)] }));
    view.rerender(<LanguageProvider initialLang={nextLang}><HomeTrendingStrip /></LanguageProvider>);
    await screen.findByRole('link', { name: topicNames[nextLang] });
    await act(async () => { finishOld(jsonResponse({ items: [editorial(lang)] })); versionEvent('new-locale'); });
    expect(oldSignal?.aborted).toBe(true);
    expect(screen.queryByRole('link', { name: topicNames[lang] })).toBeNull();
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `/api/public/trending-topics?lang=${lang}`, `/api/public/trending-topics?lang=${lang}`,
      `/api/public/trending-topics?lang=${nextLang}`, `/api/public/trending-topics?lang=${nextLang}`,
    ]);
  });

  test('unmount aborts the request and removes the version subscription', async () => {
    const view = render(<LanguageProvider initialLang={lang}><HomeTrendingStrip /></LanguageProvider>);
    await screen.findByRole('link', { name: topicNames[lang] });
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
    await act(async () => { versionEvent(); });
    const signal = fetchMock.mock.calls[1][1]?.signal;
    view.unmount();
    await act(async () => { finish(jsonResponse({ items: [editorial(lang)] })); versionEvent('after-unmount'); });
    expect(signal?.aborted).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(view.container.innerHTML).toBe('');
  });
});
