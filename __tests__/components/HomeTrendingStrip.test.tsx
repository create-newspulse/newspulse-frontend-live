import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { HomeTrendingStrip } from '../../components/home/HomeSharedFeatureModules';
import { LanguageProvider, getMessagesForLang } from '../../src/i18n/LanguageProvider';
import { DEFAULT_TRENDING_TOPICS } from '../../src/config/trendingTopics';
import { jsonResponse, topicNames } from '../fixtures/editorialTopics';
import type { RouteLocale } from '../../lib/localizedArticleFields';

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
});
