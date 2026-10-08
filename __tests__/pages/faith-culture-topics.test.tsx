import React from 'react';
import type { LinkProps } from 'next/link';
import { format } from 'url';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import FaithCulturePage from '../../pages/faith-culture';
import CategoryFeedPage from '../../components/CategoryFeedPage';
import type { CategoryPageProps } from '../../lib/categoryPageProps';
import type { RouteLocale } from '../../lib/localizedArticleFields';
import { FAITH_CULTURE_PAGINATION_HEADER } from '../../lib/faithCulturePagination';
import { FAITH_CULTURE_TOPICS, type FaithCultureTopic } from '../../lib/faithCultureTopics';
import { ORDINARY_PAGINATION_HEADER } from '../../lib/ordinaryCategoryPagination';
import { LanguageProvider } from '../../src/i18n/LanguageProvider';
import en from '../../src/i18n/en.json';
import hi from '../../src/i18n/hi.json';
import gu from '../../src/i18n/gu.json';
import { faithPage, faithStories, type FaithStory } from '../fixtures/faithCulture';

let mockLocale: RouteLocale = 'en';
let mockQuery: Record<string, string | string[]> = {};
let mockIsReady = true;
const mockNavigate = jest.fn<void, [string, Pick<LinkProps, 'locale' | 'shallow' | 'scroll'>]>();
const dictionaries = { en, hi, gu };
const living: FaithCultureTopic = 'living-heritage';
const food: FaithCultureTopic = 'food-agricultural-heritage';

jest.mock('next/router', () => ({
  useRouter: () => ({ locale: mockLocale, isReady: mockIsReady, query: mockQuery, pathname: '/faith-culture', asPath: '/faith-culture' }),
}));
jest.mock('../../lib/publicApiBase', () => ({ getPublicApiBaseUrl: () => '' }));
jest.mock('../../utils/LanguageContext', () => ({ useLanguage: () => ({ language: mockLocale }) }));
jest.mock('../../components/NewsPulseCategoryShell', () => ({
  __esModule: true,
  default: ({ children, topContent, afterColumns }: { children: React.ReactNode; topContent?: React.ReactNode; afterColumns?: React.ReactNode }) => <><main>{topContent}{children}</main><section data-testid="category-after-columns">{afterColumns}</section></>,
}));
type TestLinkProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & Pick<LinkProps, 'href' | 'locale' | 'shallow' | 'scroll' | 'prefetch'>;
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, locale, shallow, scroll, prefetch, ...props }: TestLinkProps) => {
    const path = typeof href === 'string' ? href : format(href);
    const localizedPath = locale && locale !== 'en' ? `/${locale}${path}` : path;
    return <a {...props} href={localizedPath} onClick={(event) => {
      if (!shallow) return;
      event.preventDefault();
      mockNavigate(localizedPath, { locale, shallow, scroll });
    }}>{children}</a>;
  },
}));
jest.mock('../../src/components/story/StoryImage', () => ({
  __esModule: true,
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
  TopStoryImage: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

function topicStories(topic: FaithCultureTopic, locale: RouteLocale = mockLocale, total = 100): FaithStory[] {
  return faithStories(locale, total).map((story) => ({
    ...story, topic,
    _id: `${story._id}-${topic}`, slug: `${story.slug}-${topic}`, title: `${story.title} ${topic}`,
  }));
}

function seed(stories: FaithStory[], locale: RouteLocale = mockLocale): CategoryPageProps {
  const { items, ...initialPagination } = faithPage(stories, 1);
  return { messages: {}, locale, initialItems: items, initialPagination };
}

function openPage(props: CategoryPageProps = { messages: {}, locale: mockLocale, initialItems: [] }) {
  const element = () => <LanguageProvider initialLang={mockLocale}><FaithCulturePage {...props} /></LanguageProvider>;
  const view = render(element());
  const rerender = () => view.rerender(element());
  mockNavigate.mockImplementation((href) => {
    mockQuery = Object.fromEntries(new URL(href, 'http://localhost').searchParams);
    rerender();
  });
  return { rerender };
}

function filterLinks() {
  return within(screen.getByRole('navigation', { name: dictionaries[mockLocale].faithCulture.filterLabel })).getAllByRole('link');
}

function activeTopicLabel() {
  const active = filterLinks().filter(link => link.getAttribute('aria-current') === 'true');
  expect(active).toHaveLength(1);
  return active[0].textContent;
}

function renderedIds() {
  return [...new Set(screen.queryAllByRole('link').map(link => link.getAttribute('href')?.match(/\/news\/([^/?#]+)$/)?.[1])
    .filter((id): id is string => Boolean(id && /^(en|hi|gu)-faith-/.test(id))))];
}

async function chooseTopic(topic?: FaithCultureTopic) {
  const label = dictionaries[mockLocale].faithCulture.topics[topic || 'all'];
  await act(async () => { fireEvent.click(screen.getByRole('link', { name: label })); });
}

async function clickMore() {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Load More Faith & Culture Stories' })); });
}

async function reveal(count: number) {
  for (let attempt = 0; renderedIds().length < count && attempt < 20; attempt += 1) await clickMore();
  expect(renderedIds()).toHaveLength(count);
}

describe('Faith-only public topic filters', () => {
  const originalFetch = global.fetch;
  const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
  const requests = () => fetchMock.mock.calls.map(([input]) => new URL(String(input), 'http://localhost'));
  const requestedPages = () => requests().map(url => url.searchParams.get('page'));

  beforeEach(() => {
    mockLocale = 'en';
    mockQuery = {};
    mockIsReady = true;
    mockNavigate.mockReset();
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

  function serve(feeds: Record<string, FaithStory[]>) {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input), 'http://localhost');
      const topic = url.searchParams.get('topic') || 'all';
      const stories = feeds[topic];
      if (!stories) throw new Error(`Missing fixture for ${topic}`);
      return new Response(JSON.stringify(faithPage(stories, Number(url.searchParams.get('page')))));
    });
  }

  function expectContract(topic: FaithCultureTopic | undefined, locale: RouteLocale = mockLocale) {
    for (const [input, init] of fetchMock.mock.calls) {
      const url = new URL(String(input), 'http://localhost');
      expect(url.pathname).toBe('/api/public/news');
      expect(Object.fromEntries(url.searchParams)).toEqual({
        category: 'faith-culture', lang: locale, language: locale, page: expect.any(String), limit: '30',
        strictLocale: '1', ...(topic ? { topic } : {}),
      });
      expect(new Headers(init?.headers).get(FAITH_CULTURE_PAGINATION_HEADER)).toBe('1');
      expect(new Headers(init?.headers).has(ORDINARY_PAGINATION_HEADER)).toBe(false);
    }
  }

  test.each(['en', 'hi', 'gu'] as const)('%s shows All and exactly seven localized, stable-code topic links', (locale) => {
    mockLocale = locale;
    openPage(seed([]));
    expect(filterLinks().map(link => link.textContent)).toEqual([
      dictionaries[locale].faithCulture.topics.all,
      ...FAITH_CULTURE_TOPICS.map(topic => dictionaries[locale].faithCulture.topics[topic]),
    ]);
    expect(activeTopicLabel()).toBe(dictionaries[locale].faithCulture.topics.all);
    for (const [index, link] of filterLinks().entries()) {
      const url = new URL(link.getAttribute('href') || '', 'http://localhost');
      expect(url.pathname).toBe(`${locale === 'en' ? '' : `/${locale}`}/faith-culture`);
      expect(url.searchParams.get('topic')).toBe(index ? FAITH_CULTURE_TOPICS[index - 1] : null);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('keyboard focus reveals the whole chip without changing the selected topic', () => {
    openPage(seed([]));
    const link = filterLinks().at(-1)!;
    const scrollIntoView = jest.fn();
    Object.defineProperty(link, 'scrollIntoView', { value: scrollIntoView });
    fireEvent.focus(link);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' });
    expect(activeTopicLabel()).toBe('All');
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test.each([
    'national', 'international', 'business', 'science-technology', 'tech-gadgets', 'sports', 'lifestyle', 'glamour',
    'regional', 'editorial', 'web-stories', 'viral-videos', 'pulse-dialogue', 'youth-pulse', 'inspiration-hub', 'community-reporter', 'home',
  ])('%s does not receive Faith topic controls even with a topic URL', async (category) => {
    mockQuery = { topic: living };
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ items: [], total: 0 })));
    await act(async () => {
      render(<LanguageProvider initialLang="en"><CategoryFeedPage title={category} categoryKey={category} useCategoryShell {...seed([])} /></LanguageProvider>);
    });
    expect(screen.queryByRole('navigation', { name: en.faithCulture.filterLabel })).toBeNull();
    for (const url of requests()) expect(url.searchParams.has('topic')).toBe(false);
  });

  test.each(FAITH_CULTURE_TOPICS)('selecting %s uses its stable code and starts one backend page', async (topic) => {
    const stories = topicStories(topic, 'en', 3);
    serve({ [topic]: stories });
    openPage(seed(faithStories('en', 3)));
    await chooseTopic(topic);
    await screen.findByText(stories[0].title);
    expect(mockNavigate).toHaveBeenCalledWith(`/faith-culture?topic=${topic}`, { locale: 'en', shallow: true, scroll: false });
    expect(mockQuery.topic).toBe(topic);
    expect(activeTopicLabel()).toBe(en.faithCulture.topics[topic]);
    expect(requestedPages()).toEqual(['1']);
    expectContract(topic);
    expect(renderedIds()).toEqual(stories.map(story => story._id));
  });

  test('a valid topic deep link excludes the All ISR seed while the selected page is pending', async () => {
    mockQuery = { topic: living };
    const all = faithStories('en', 3);
    const selected = topicStories(living, 'en', 3);
    let finish!: (response: Response) => void;
    fetchMock.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    openPage(seed(all));
    expect(activeTopicLabel()).toBe('Living Heritage & Traditions');
    expect(screen.queryByText(all[0].title)).toBeNull();
    expect(screen.getByTestId('category-story-loading')).toBeTruthy();
    expect(requestedPages()).toEqual(['1']);
    await act(async () => { finish(new Response(JSON.stringify(faithPage(selected, 1)))); });
    expect(renderedIds()).toEqual(selected.map(story => story._id));
    expectContract(living);
  });

  test('router hydration cannot label the static All seed as the selected topic', async () => {
    mockIsReady = false;
    const all = faithStories('en', 3);
    const selected = topicStories(living, 'en', 3);
    let finish!: (response: Response) => void;
    fetchMock.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
    const view = openPage(seed(all));
    expect(activeTopicLabel()).toBe('All');
    expect(fetchMock).not.toHaveBeenCalled();
    mockIsReady = true;
    mockQuery = { topic: living };
    await act(async () => { view.rerender(); });
    expect(activeTopicLabel()).toBe('Living Heritage & Traditions');
    expect(renderedIds()).toEqual([]);
    expect(screen.getByTestId('category-story-loading')).toBeTruthy();
    await act(async () => { finish(new Response(JSON.stringify(faithPage(selected, 1)))); });
    expect(renderedIds()).toEqual(selected.map(story => story._id));
  });

  test.each<{ topic: string | string[] }>([
    { topic: 'unknown-value' }, { topic: 'Living Heritage & Traditions' }, { topic: 'LIVING-HERITAGE' },
    { topic: ' living-heritage ' }, { topic: '' }, { topic: [living, food] },
  ])('invalid topic $topic safely selects All without forwarding or redirecting', async ({ topic }) => {
    mockQuery = { topic };
    const all = faithStories('en', 3);
    serve({ all });
    openPage();
    await screen.findByText(all[0].title);
    expect(activeTopicLabel()).toBe('All');
    expect(new URL(filterLinks()[0].getAttribute('href') || '', 'http://localhost').searchParams.has('topic')).toBe(false);
    expectContract(undefined);
    expect(requestedPages()).toEqual(['1']);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  test('default All omits topic and returning to All restores its ISR seed', async () => {
    const all = faithStories('en', 3);
    const selected = topicStories(living, 'en', 3);
    serve({ all, [living]: selected });
    openPage();
    await screen.findByText(all[0].title);
    expectContract(undefined);
    cleanup();
    fetchMock.mockClear();
    openPage(seed(all));
    await chooseTopic(living);
    await screen.findByText(selected[0].title);
    await chooseTopic();
    expect(mockQuery.topic).toBeUndefined();
    expect(mockNavigate).toHaveBeenLastCalledWith('/faith-culture', { locale: 'en', shallow: true, scroll: false });
    expect(renderedIds()).toEqual(all.map(story => story._id));
    expect(requestedPages()).toEqual(['1']);
  });

  test.each(['en', 'hi', 'gu'] as const)('%s selected-topic archive loads 100 IDs as 30/30/30/10 with no fifth request', async (locale) => {
    mockLocale = locale;
    mockQuery = { topic: living };
    const stories = topicStories(living, locale);
    serve({ [living]: stories });
    openPage(seed(faithStories(locale)));
    await screen.findByText(stories[0].title);
    for (const page of [1, 2, 3, 4]) {
      if (page > 1) await clickMore();
      await reveal(Math.min(page * 30, 100));
      expect(renderedIds()).toEqual(stories.slice(0, page * 30).map(story => story._id));
      expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(stories[0].title);
      expect(fetchMock).toHaveBeenCalledTimes(page);
      for (const story of stories.slice(0, page * 30)) expect(screen.getAllByText(story.title)).toHaveLength(1);
    }
    expect(requestedPages()).toEqual(['1', '2', '3', '4']);
    expectContract(living, locale);
    expect(screen.queryByRole('button', { name: 'Load More Faith & Culture Stories' })).toBeNull();
    expect(screen.getByText(/all caught up/i).closest('main')).toBeNull();
  }, 20000);

  test('changing topic after page 3 discards all appended pages and resets the Top Story', async () => {
    mockQuery = { topic: living };
    const oldStories = topicStories(living);
    const nextStories = topicStories(food, 'en', 3);
    serve({ [living]: oldStories, [food]: nextStories });
    openPage();
    await screen.findByText(oldStories[0].title);
    await reveal(30);
    await clickMore();
    await reveal(60);
    await clickMore();
    await reveal(90);
    await chooseTopic(food);
    await screen.findByText(nextStories[0].title);
    expect(renderedIds()).toEqual(nextStories.map(story => story._id));
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(nextStories[0].title);
    expect(requests().map(url => [url.searchParams.get('topic'), url.searchParams.get('page')]))
      .toEqual([[living, '1'], [living, '2'], [living, '3'], [food, '1']]);
  });

  test.each([1, 2])('a stale old-topic page %i cannot replace or append to the new topic', async (page) => {
    mockQuery = { topic: living };
    const oldStories = topicStories(living);
    const nextStories = topicStories(food, 'en', 3);
    serve({ [living]: oldStories, [food]: nextStories });
    let finish!: (response: Response) => void;
    if (page === 1) fetchMock.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    openPage();
    if (page === 2) {
      await screen.findByText(oldStories[0].title);
      await reveal(30);
      fetchMock.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
      await clickMore();
    }
    const oldSignal = fetchMock.mock.calls.at(-1)?.[1]?.signal;
    await chooseTopic(food);
    await screen.findByText(nextStories[0].title);
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => { finish(new Response(JSON.stringify(faithPage(oldStories, page)))); });
    expect(renderedIds()).toEqual(nextStories.map(story => story._id));
    expect(requests().at(-1)?.searchParams.get('page')).toBe('1');
    expect(requests().at(-1)?.searchParams.get('topic')).toBe(food);
  });

  test('empty topic results use filtered copy, while empty All retains the existing empty state', async () => {
    mockQuery = { topic: living };
    serve({ [living]: [] });
    openPage(seed(faithStories('en', 3)));
    await screen.findByText(en.faithCulture.noMatches);
    expect(screen.queryByText(en.categoryPage.noStoriesYet)).toBeNull();
    expect(renderedIds()).toEqual([]);
    expect(screen.queryByRole('button', { name: 'Load More Faith & Culture Stories' })).toBeNull();
    cleanup();
    mockQuery = {};
    fetchMock.mockClear();
    openPage(seed([]));
    expect(screen.getByText(en.categoryPage.noStoriesYet)).toBeTruthy();
    expect(screen.queryByText(en.faithCulture.noMatches)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  test('search stays local to selected-topic pages and survives a topic change', async () => {
    mockQuery = { topic: living, q: 'unique-match' };
    const oldStories = topicStories(living, 'en', 61);
    oldStories[60].summary = 'unique-match';
    const nextStories = topicStories(food, 'en', 3);
    nextStories[1].summary = 'unique-match';
    serve({ [living]: oldStories, [food]: nextStories });
    openPage(seed(faithStories('en')));
    await screen.findByText(en.faithCulture.noMatches);
    expect(renderedIds()).toEqual([]);
    expect(requestedPages()).toEqual(['1']);
    await clickMore();
    expect(renderedIds()).toEqual([]);
    await clickMore();
    await screen.findByText(oldStories[60].title);
    expect(renderedIds()).toEqual([oldStories[60]._id]);
    expect(requestedPages()).toEqual(['1', '2', '3']);
    expectContract(living);
    await chooseTopic(food);
    await screen.findByText(nextStories[1].title);
    expect(mockQuery).toEqual({ q: 'unique-match', topic: food });
    expect(renderedIds()).toEqual([nextStories[1]._id]);
    expect(requestedPages()).toEqual(['1', '2', '3', '1']);
    expect(requests().at(-1)?.searchParams.get('topic')).toBe(food);
    for (const url of requests()) expect(url.searchParams.has('q')).toBe(false);
  });

  test('changing q cancels old selected-topic pagination without falling back to All', async () => {
    mockQuery = { topic: living };
    const stories = topicStories(living);
    serve({ [living]: stories });
    const view = openPage();
    await screen.findByText(stories[0].title);
    await reveal(30);
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await clickMore();
    const oldSignal = fetchMock.mock.calls.at(-1)?.[1]?.signal;
    mockQuery = { topic: living, q: stories[0].title };
    await act(async () => { view.rerender(); });
    await waitFor(() => expect(requestedPages()).toEqual(['1', '2', '1']));
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => { finish(new Response(JSON.stringify(faithPage(stories, 2)))); });
    expect(renderedIds()).toEqual([stories[0]._id]);
    expectContract(living);
  });

  test.each([['en', 'hi'], ['hi', 'gu'], ['gu', 'en']] as const)('%s to %s retains the stable topic and rejects old-locale pages', async (from, to) => {
    mockLocale = from;
    mockQuery = { topic: living };
    const oldStories = topicStories(living, from);
    const nextStories = topicStories(living, to, 3);
    serve({ [living]: oldStories });
    const view = openPage();
    await screen.findByText(oldStories[0].title);
    await reveal(30);
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    await clickMore();
    const oldSignal = fetchMock.mock.calls.at(-1)?.[1]?.signal;
    mockLocale = to;
    serve({ [living]: nextStories });
    await act(async () => { view.rerender(); });
    await screen.findByText(nextStories[0].title);
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => { finish(new Response(JSON.stringify(faithPage(oldStories, 2)))); });
    expect(renderedIds()).toEqual(nextStories.map(story => story._id));
    expect(activeTopicLabel()).toBe(dictionaries[to].faithCulture.topics[living]);
    expect(Object.fromEntries(requests().at(-1)!.searchParams)).toEqual({
      category: 'faith-culture', lang: to, language: to, topic: living, page: '1', limit: '30', strictLocale: '1',
    });
    for (const url of requests()) expect(url.searchParams.get('topic')).toBe(living);
  });

  test('60-second refresh keeps the topic on each fixed page and preserves the loaded range', async () => {
    jest.useFakeTimers();
    mockQuery = { topic: living };
    const stories = topicStories(living, 'en', 60);
    serve({ [living]: stories });
    openPage();
    await screen.findByText(stories[0].title);
    await reveal(30);
    await clickMore();
    await reveal(60);
    await act(async () => { await jest.advanceTimersByTimeAsync(60000); });
    await reveal(60);
    expect(renderedIds()).toEqual(stories.map(story => story._id));
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(stories[0].title);
    expect(requestedPages()).toEqual(['1', '2', '1', '2']);
    expectContract(living);
  });
});
