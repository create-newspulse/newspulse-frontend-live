import React from 'react';
import type { GetServerSidePropsContext } from 'next';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { act, render, screen, waitFor, within } from '@testing-library/react';
import TopicPage, { getServerSideProps, type TopicPageProps } from '../../pages/topic/[slug]';
import SeoAlternates from '../../components/SeoAlternates';
import { LanguageProvider, getMessagesForLang } from '../../src/i18n/LanguageProvider';
import { fetchPublicNews } from '../../lib/publicNewsApi';
import { normalizeRouteLocale, type RouteLocale } from '../../lib/localizedArticleFields';
import { editorialTopicPath, EDITORIAL_TOPICS_TIMEOUT_MS } from '../../lib/publicEditorialTopics';
import { getPublicApiBaseUrl } from '../../lib/publicApiBase';
import { dispatchPublicDataRefresh } from '../../lib/publicDataRefresh';
import { getCategoryQueryKey, getCategoryRouteKey } from '../../lib/categoryKeys';
import { jsonResponse, storyFixture, storyPageFixture, topicDescriptions, topicFixture, topicNames, topicStoryCategories } from '../fixtures/editorialTopics';

const mockRouter: { locale: RouteLocale; defaultLocale: string; asPath: string; query: Record<string, string | string[]> } = {
  locale: 'en', defaultLocale: 'en', asPath: '/topic/navratri-2026', query: { slug: 'navratri-2026' },
};
jest.mock('next/router', () => ({ useRouter: () => mockRouter }));
jest.mock('next/head', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ locale, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { locale?: false }) => <a {...props}>{children}</a>,
}));
jest.mock('../../src/components/story/StoryImage', () => ({
  __esModule: true, default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
jest.mock('../../lib/publicApiBase', () => ({ getPublicApiBaseUrl: jest.fn(() => 'http://localhost:3010') }));
jest.mock('../../lib/getMessages', () => ({ getMessages: async () => ({}) }));
jest.mock('../../lib/publicNewsApi', () => ({ fetchPublicNews: jest.fn() }));

const originalFetch = global.fetch;
const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
const siteUrl = 'https://www.newspulse.co.in';

function context(locale: RouteLocale = 'en', slug = 'navratri-2026', query: Record<string, string | string[]> = {}): GetServerSidePropsContext {
  const path = editorialTopicPath(slug, locale);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    for (const item of Array.isArray(value) ? value : [value]) params.append(key, item);
  }
  const asPath = `${path}${params.size ? `?${params}` : ''}`;
  Object.assign(mockRouter, { locale, asPath, query: { slug, ...query } });
  const req = Object.assign(new IncomingMessage(new Socket()), { cookies: {} });
  req.headers.host = 'localhost:3000';
  const res = new ServerResponse(req);
  jest.spyOn(res, 'setHeader');
  return {
    locale, params: { slug }, query, resolvedUrl: asPath,
    req, res,
  };
}

async function load(ctx: GetServerSidePropsContext): Promise<TopicPageProps> {
  const result = await getServerSideProps(ctx);
  if (!('props' in result)) throw new Error('Expected page props');
  return result.props;
}
async function loadEditorial(ctx: GetServerSidePropsContext) {
  const props = await load(ctx);
  if (props.mode !== 'editorial') throw new Error('Expected editorial page');
  return props;
}
function pageTree(props: TopicPageProps) {
  const seo = props.mode === 'editorial' ? props.seo : undefined;
  return (
    <LanguageProvider initialLang={props.locale}>
      <SeoAlternates canonicalUrl={seo?.canonicalUrl} alternates={seo?.alternates} disabled={props.mode === 'unavailable' && props.seo.disableAlternates} />
      <TopicPage {...props} />
    </LanguageProvider>
  );
}
function mount(props: TopicPageProps) {
  return render(pageTree(props));
}

function topicResponse(input: Parameters<typeof fetch>[0], suffix = '') {
  const url = new URL(String(input), 'http://localhost:3000');
  const lang = normalizeRouteLocale(url.searchParams.get('lang'));
  if (url.pathname.endsWith('/articles')) {
    const page = storyPageFixture(lang, Number(url.searchParams.get('page')));
    page.items = page.items.map((story) => ({ ...story, title: `${story.title}${suffix}`, summary: `${story.summary}${suffix}` }));
    return jsonResponse(page);
  }
  const slug = decodeURIComponent(url.pathname.split('/').pop() || '');
  return jsonResponse({
    ok: true, lang,
    topic: topicFixture(lang, {
      slug, label: `${topicNames[lang]}${suffix}`,
      description: { ...topicDescriptions, [lang]: `${topicDescriptions[lang]}${suffix}` },
    }),
    pinnedArticle: { ...storyFixture(100, lang), title: `${storyFixture(100, lang).title}${suffix}` },
  });
}

beforeEach(() => {
  jest.replaceProperty(process, 'env', { ...process.env, NEXT_PUBLIC_SITE_URL: siteUrl });
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.mocked(getPublicApiBaseUrl).mockReturnValue('http://localhost:3010');
  global.fetch = fetchMock;
  fetchMock.mockReset().mockImplementation(async (input) => topicResponse(input));
  jest.mocked(fetchPublicNews).mockReset().mockResolvedValue({ items: [], meta: {}, endpoint: '/api/public/news' });
});
afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
  jest.useRealTimers();
  document.head.innerHTML = '';
});

describe('authoritative editorial topic archives', () => {
  test.each(['en', 'hi', 'gu'] as const)('%s route renders localized metadata, one pin, and cross-category stories', async (locale) => {
    const props = await loadEditorial(context(locale));
    const { container } = mount(props);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(topicNames[locale]);
    expect(screen.getByText(topicDescriptions[locale])).not.toBeNull();
    expect(screen.getAllByRole('heading', { name: storyFixture(100, locale).title })).toHaveLength(1);
    expect(container.querySelectorAll('article')).toHaveLength(13);
    expect(props.items.map((item) => item.id)).toEqual(storyPageFixture(locale).items.map((item) => item._id));
    expect(props.pinnedArticle?.href).toBe(`${locale === 'en' ? '' : `/${locale}`}/news/story-100`);
    expect(fetchPublicNews).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `http://localhost:3010/api/public/topics/navratri-2026?lang=${locale}`,
      `http://localhost:3010/api/public/topics/navratri-2026/articles?lang=${locale}&page=1&limit=12`,
    ]);
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(topicDescriptions[locale]);
    expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(`${siteUrl}${editorialTopicPath('navratri-2026', locale)}`);
    expect(props.seo.alternates.map((alternate) => alternate.hrefLang)).toEqual(['en', 'hi', 'gu', 'x-default']);
    expect(JSON.parse(document.querySelector('script[type="application/ld+json"]')!.textContent || '{}')).toMatchObject({
      '@type': 'CollectionPage', name: topicNames[locale], inLanguage: locale,
    });
  });

  test.each(['en', 'hi', 'gu'] as const)('%s previous/next links and canonicals follow fixed page 1/page 2', async (locale) => {
    const first = await loadEditorial(context(locale));
    const view = mount(first);
    const copy = getMessagesForLang(locale).topicPage;
    expect(screen.getByRole('link', { name: copy.next }).getAttribute('href')).toBe(editorialTopicPath('navratri-2026', locale, 2));
    expect(screen.queryByRole('link', { name: copy.previous })).toBeNull();
    view.unmount();
    const second = await loadEditorial(context(locale, 'navratri-2026', { page: '2', utm_source: 'test' }));
    mount(second);
    expect(second.items).toHaveLength(1);
    expect(second.pagination).toEqual({ page: 2, totalPages: 2, hasNextPage: false });
    expect(screen.getByRole('link', { name: copy.previous }).getAttribute('href')).toBe(editorialTopicPath('navratri-2026', locale));
    expect(screen.queryByRole('link', { name: copy.next })).toBeNull();
    expect(second.seo.canonicalUrl).toBe(`${siteUrl}${editorialTopicPath('navratri-2026', locale, 2)}`);
    expect(second.seo.alternates.every((alternate) => alternate.href.endsWith('?page=2'))).toBe(true);
    expect(fetchMock.mock.calls[3][0]).toBe(`http://localhost:3010/api/public/topics/navratri-2026/articles?lang=${locale}&page=2&limit=12`);
  });

  test.each(['same-id', 'same-group'])('does not repeat a %s pin accidentally included in ordinary results', async (collision) => {
    fetchMock.mockImplementation(async (input) => {
      if (!String(input).includes('/articles?')) return jsonResponse({ ok: true, lang: 'en', topic: topicFixture(), pinnedArticle: storyFixture(100) });
      const page = storyPageFixture();
      page.items[0] = collision === 'same-id' ? storyFixture(100)
        : { ...storyFixture(101), translationKey: storyFixture(100).translationKey };
      return jsonResponse(page);
    });
    const props = await loadEditorial(context());
    mount(props);
    expect(props.items).toHaveLength(11);
    expect(screen.getAllByRole('heading', { name: storyFixture(100).title })).toHaveLength(1);
    expect(props.pagination.hasNextPage).toBe(true);
  });

  test('without a pin the normal grid starts immediately', async () => {
    fetchMock.mockImplementation(async (input) => String(input).includes('/articles?')
      ? jsonResponse(storyPageFixture()) : jsonResponse({ ok: true, lang: 'en', topic: topicFixture(), pinnedArticle: null }));
    const props = await loadEditorial(context());
    const { container } = mount(props);
    expect(props.pinnedArticle).toBeNull();
    expect(container.querySelector('#topic-featured-story')).toBeNull();
    expect(container.querySelectorAll('article')).toHaveLength(12);
  });

  test('an empty registered topic remains an editorial empty state, not a keyword search', async () => {
    fetchMock.mockImplementation(async (input) => String(input).includes('/articles?')
      ? jsonResponse(storyPageFixture('en', 1, 0)) : jsonResponse({ ok: true, lang: 'en', topic: topicFixture(), pinnedArticle: null }));
    mount(await loadEditorial(context()));
    expect(screen.getByText('No stories yet.')).not.toBeNull();
    expect(fetchPublicNews).not.toHaveBeenCalled();
  });

  test.each(['en', 'hi', 'gu'] as const)('%s mixed-category cards retain real categories, localized labels and normal canonical article links', async (locale) => {
    const props = await loadEditorial(context(locale));
    mount(props);
    const labelKeys = [
      'regional', 'national', 'international', 'business', 'lifestyle', 'sports',
      'glamour', 'editorial', 'faithCulture', 'pulseDialogue', 'scienceTechnology', 'techGadgets',
    ];
    const body = storyPageFixture(locale);
    expect(props.items.map((item) => item.category)).toEqual(topicStoryCategories);
    expect(props.pinnedArticle?.category).toBe('regional');
    for (const [index, item] of props.items.entries()) {
      const heading = screen.getByRole('heading', { name: item.titleText });
      const card = heading.closest('article')!;
      expect(within(card).getByText(getMessagesForLang(locale).categories[labelKeys[index]])).not.toBeNull();
      expect(heading.closest('a')?.getAttribute('href')).toBe(
        `${locale === 'en' ? '' : `/${locale}`}/news/${body.items[index].slug}`,
      );
      expect(heading.closest('a')?.getAttribute('href')).not.toMatch(/^\/en\/|\/topic\//);
    }
    const pinned = screen.getByRole('heading', { name: storyFixture(100, locale).title }).closest('article')!;
    expect(within(pinned).getByText(getMessagesForLang(locale).categories.regional)).not.toBeNull();
    const science = props.items.find((item) => item.category === 'tech')!;
    const gadgets = props.items.find((item) => item.category === 'tech-gadgets')!;
    expect(getCategoryRouteKey(science.category)).toBe('science-technology');
    expect(getCategoryQueryKey('science-technology')).toBe('tech');
    expect(getCategoryRouteKey(gadgets.category)).toBe('tech-gadgets');
    expect(getCategoryQueryKey(gadgets.category)).toBe('tech-gadgets');
    expect(science.href).not.toBe(gadgets.href);
  });

  test.each(['en', 'hi', 'gu'] as const)('%s archive with one ordinary member and no pin displays only that member', async (locale) => {
    fetchMock.mockImplementation(async (input) => String(input).includes('/articles?')
      ? jsonResponse(storyPageFixture(locale, 1, 1))
      : jsonResponse({ ok: true, lang: locale, topic: topicFixture(locale), pinnedArticle: null }));
    const props = await loadEditorial(context(locale));
    mount(props);
    expect(props.items).toHaveLength(1);
    expect(document.querySelectorAll('article')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: storyFixture(1, locale).title })).not.toBeNull();
    expect(screen.queryByText(getMessagesForLang(locale).topicPage.noStoriesYet)).toBeNull();
    expect(screen.queryByRole('navigation', { name: getMessagesForLang(locale).topicPage.pagination })).toBeNull();
    expect(fetchPublicNews).not.toHaveBeenCalled();
  });

  test.each(['en', 'hi', 'gu'] as const)('%s next-page navigation reaches all 37 members in backend order with a separate pin', async (locale) => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));
      return url.pathname.endsWith('/articles')
        ? jsonResponse(storyPageFixture(locale, Number(url.searchParams.get('page')), 37))
        : topicResponse(input);
    });
    const ids: string[] = [];
    const copy = getMessagesForLang(locale).topicPage;
    for (let page = 1; page <= 4; page++) {
      const props = await loadEditorial(context(locale, 'navratri-2026', page === 1 ? {} : { page: String(page) }));
      const view = mount(props);
      ids.push(...props.items.map((item) => item.id));
      expect(props.pagination).toEqual({ page, totalPages: 4, hasNextPage: page < 4 });
      expect(document.querySelectorAll('article')).toHaveLength((page === 4 ? 1 : 12) + 1);
      expect(screen.getAllByRole('heading', { name: storyFixture(100, locale).title })).toHaveLength(1);
      if (page < 4) expect(screen.getByRole('link', { name: copy.next }).getAttribute('href')).toBe(editorialTopicPath('navratri-2026', locale, page + 1));
      else expect(screen.queryByRole('link', { name: copy.next })).toBeNull();
      if (page > 1) expect(screen.getByRole('link', { name: copy.previous }).getAttribute('href')).toBe(editorialTopicPath('navratri-2026', locale, page - 1));
      view.unmount();
    }
    expect(ids).toEqual(Array.from({ length: 37 }, (_, index) => storyFixture(37 - index, locale)._id));
    expect(new Set(ids).size).toBe(37);
    expect(fetchMock).toHaveBeenCalledTimes(8);
  });

  test.each(['en', 'hi', 'gu'] as const)('%s presentation deduplicates IDs and logical-story identities without sorting or changing pagination', async (locale) => {
    const stories = [
      storyFixture(4, locale), storyFixture(4, locale),
      { ...storyFixture(3, locale), translationKey: 'logical-translations' },
      { ...storyFixture(2, locale), translationKey: 'logical-translations' },
      { ...storyFixture(1, locale), translationKey: null, translationGroupId: 'logical-translations' },
      storyFixture(5, locale),
    ];
    fetchMock.mockImplementation(async (input) => String(input).includes('/articles?')
      ? jsonResponse({ ...storyPageFixture(locale, 1, stories.length), items: stories })
      : jsonResponse({ ok: true, lang: locale, topic: topicFixture(locale), pinnedArticle: null }));
    const props = await loadEditorial(context(locale));
    mount(props);
    expect(props.items.map((item) => item.id)).toEqual([4, 3, 5].map((index) => storyFixture(index, locale)._id));
    expect(document.querySelectorAll('article')).toHaveLength(3);
    expect(props.pagination).toEqual({ page: 1, totalPages: 1, hasNextPage: false });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('a valid pin with zero ordinary members is content, not an empty archive or an invented member', async () => {
    fetchMock.mockImplementation(async (input) => String(input).includes('/articles?')
      ? jsonResponse(storyPageFixture('en', 1, 0)) : topicResponse(input));
    const props = await loadEditorial(context());
    mount(props);
    expect(props.items).toEqual([]);
    expect(document.querySelectorAll('article')).toHaveLength(1);
    expect(screen.queryByText('No stories yet.')).toBeNull();
    expect(screen.queryByRole('navigation', { name: 'Pagination' })).toBeNull();
    expect(fetchPublicNews).not.toHaveBeenCalled();
  });

  test('a category without an existing dictionary label remains its real category, never Trending', async () => {
    const story = storyFixture(1, 'en', 'special-desk');
    fetchMock.mockImplementation(async (input) => String(input).includes('/articles?')
      ? jsonResponse({ ...storyPageFixture('en', 1, 1), items: [story] })
      : jsonResponse({ ok: true, lang: 'en', topic: topicFixture(), pinnedArticle: null }));
    const props = await loadEditorial(context());
    mount(props);
    expect(props.items[0].category).toBe('special-desk');
    expect(screen.getByText('special-desk')).not.toBeNull();
    expect(screen.queryByText('Trending')).toBeNull();
  });

  test('backend-returned expired active archive remains accessible', async () => {
    fetchMock.mockImplementation(async (input) => String(input).includes('/articles?')
      ? jsonResponse(storyPageFixture()) : jsonResponse({
        ok: true, lang: 'en', topic: topicFixture('en', { expiresAt: '2020-01-02T00:00:00.000Z' }), pinnedArticle: null,
      }));
    expect((await load(context())).mode).toBe('editorial');
  });

  test.each([{ page: '0' }, { page: '1.5' }, { page: '10001' }, { page: ['1', '2'] }])('invalid page $page redirects to the canonical first page', async (query) => {
    expect(await getServerSideProps(context('gu', 'navratri-2026', query))).toEqual({
      redirect: { destination: '/gu/topic/navratri-2026', permanent: false },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe.each(['en', 'hi', 'gu'] as const)('%s mounted editorial lifecycle', (lang) => {
  const event = () => dispatchPublicDataRefresh({ version: 'topic-change', previousVersion: null, source: 'test' });
  const heading = (index: number, suffix = '') => screen.queryByRole('heading', { name: `${storyFixture(index, lang).title}${suffix}` });
  async function seeded(page = 1) {
    const props = await loadEditorial(context(lang, 'navratri-2026', page > 1 ? { page: String(page), utm_source: 'test' } : {}));
    const view = mount(props);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    fetchMock.mockClear();
    jest.mocked(getPublicApiBaseUrl).mockReturnValue('');
    return { ...view, props };
  }

  test('updates metadata, same-ID cards and the pin without replacing SSR or resetting on a parent render', async () => {
    const view = await seeded();
    fetchMock.mockImplementation(async (input) => topicResponse(input, ' edited'));
    await act(async () => { event(); });
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(`${topicNames[lang]} edited`);
    expect(heading(13, ' edited')).not.toBeNull();
    expect(heading(100, ' edited')).not.toBeNull();
    expect(heading(13)).toBeNull();
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(`${topicDescriptions[lang]} edited`);
    expect(JSON.parse(document.querySelector('script[type="application/ld+json"]')!.textContent || '{}').name).toBe(`${topicNames[lang]} edited`);
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      `/api/public/topics/navratri-2026?lang=${lang}`,
      `/api/public/topics/navratri-2026/articles?lang=${lang}&page=1&limit=12`,
    ]);
    view.rerender(pageTree({ ...view.props }));
    expect(heading(13, ' edited')).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchPublicNews).not.toHaveBeenCalled();
  });

  test('withdrawal/deletion removes cards and pins; published restoration uses only the authoritative page', async () => {
    await seeded();
    fetchMock.mockImplementation(async (input) => String(input).includes('/articles?')
      ? jsonResponse(storyPageFixture(lang, 1, 12))
      : jsonResponse({ ok: true, lang, topic: topicFixture(lang), pinnedArticle: null }));
    await act(async () => { event(); });
    expect(heading(13)).toBeNull();
    expect(heading(100)).toBeNull();
    expect(document.querySelector('#topic-featured-story')).toBeNull();
    expect(document.querySelectorAll('article')).toHaveLength(12);
    fetchMock.mockImplementation(async (input) => topicResponse(input));
    await act(async () => { event(); });
    expect(heading(13)).not.toBeNull();
    expect(heading(100)).not.toBeNull();
    expect(document.querySelectorAll('article')).toHaveLength(13);
  });

  test.each(['removed', 'updated', 'changed'])('authoritative %s pin survives a failed archive-page read without duplicate or invented pins', async (kind) => {
    await seeded();
    const pin = kind === 'removed' ? null : {
      ...storyFixture(kind === 'updated' ? 100 : 13, lang),
      title: `${storyFixture(kind === 'updated' ? 100 : 13, lang).title} new-pin`,
      translationKey: kind === 'changed' ? storyFixture(12, lang).translationKey : storyFixture(100, lang).translationKey,
    };
    fetchMock.mockImplementation(async (input) => String(input).includes('/articles?')
      ? jsonResponse({}, 503)
      : jsonResponse({ ok: true, lang, topic: topicFixture(lang, { label: `${topicNames[lang]} new-metadata` }), pinnedArticle: pin }));
    await act(async () => { event(); });
    expect(heading(100)).toBeNull();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(`${topicNames[lang]} new-metadata`);
    if (kind === 'removed') {
      expect(document.querySelector('#topic-featured-story')).toBeNull();
      expect(document.querySelectorAll('article')).toHaveLength(12);
    } else {
      expect(screen.getAllByRole('heading', { name: pin!.title })).toHaveLength(1);
      expect(document.querySelectorAll('article')).toHaveLength(kind === 'changed' ? 11 : 13);
    }
    if (kind === 'changed') {
      expect(heading(13)).toBeNull();
      expect(heading(12)).toBeNull();
      fetchMock.mockImplementation(async (input) => String(input).includes('/articles?')
        ? jsonResponse({}, 503)
        : jsonResponse({ ok: true, lang, topic: topicFixture(lang), pinnedArticle: null }));
      await act(async () => { event(); });
      expect(heading(13)).toBeNull();
      expect(heading(13, ' new-pin')).toBeNull();
      expect(document.querySelectorAll('article')).toHaveLength(10);
    } else expect(heading(13)).not.toBeNull();
    expect(screen.getByRole('alert')).not.toBeNull();
  });

  test.each(['updated', 'empty'])('metadata failure retains the pin but does not block an authoritative %s page', async (kind) => {
    await seeded();
    fetchMock.mockImplementation(async (input) => !String(input).includes('/articles?')
      ? jsonResponse({}, 503)
      : kind === 'empty' ? jsonResponse(storyPageFixture(lang, 1, 0)) : topicResponse(input, ' edited-page'));
    await act(async () => { event(); });
    expect(heading(100)).not.toBeNull();
    expect(heading(13)).toBeNull();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(topicNames[lang]);
    expect(document.querySelectorAll('article')).toHaveLength(kind === 'empty' ? 1 : 13);
    if (kind === 'updated') expect(heading(13, ' edited-page')).not.toBeNull();
    expect(screen.getByRole('alert')).not.toBeNull();
  });

  test.each(['Draft', 'Scheduled-before-eligible', 'Unpublished', 'Deleted'])('does not invent %s restoration omitted from the authoritative result', async () => {
    await seeded();
    fetchMock.mockImplementation(async (input) => String(input).includes('/articles?')
      ? jsonResponse(storyPageFixture(lang, 1, 0))
      : jsonResponse({ ok: true, lang, topic: topicFixture(lang), pinnedArticle: null }));
    await act(async () => { event(); });
    expect(document.querySelectorAll('article')).toHaveLength(0);
    expect(screen.getByText(getMessagesForLang(lang).topicPage.noStoriesYet)).not.toBeNull();
    expect(fetchPublicNews).not.toHaveBeenCalled();
  });

  test('attachment adds an unrelated mixed-category story and detachment removes it through the existing refresh event', async () => {
    await seeded();
    const attached = {
      ...storyFixture(200, lang, 'tech-gadgets'),
      title: 'A newly attached story without matching topic keywords',
      translationKey: 'attached-logical-story',
    };
    fetchMock.mockImplementation(async (input) => {
      if (!String(input).includes('/articles?')) return topicResponse(input);
      const body = storyPageFixture(lang);
      body.items[0] = attached;
      return jsonResponse(body);
    });
    await act(async () => { event(); });
    const heading = screen.getByRole('heading', { name: attached.title });
    expect(within(heading.closest('article')!).getByText(getMessagesForLang(lang).categories.techGadgets)).not.toBeNull();
    expect(heading.closest('a')?.getAttribute('href')).toBe(`${lang === 'en' ? '' : `/${lang}`}/news/story-200`);
    expect(screen.queryByRole('heading', { name: storyFixture(13, lang).title })).toBeNull();
    fetchMock.mockImplementation(async (input) => topicResponse(input));
    await act(async () => { event(); });
    expect(screen.queryByRole('heading', { name: attached.title })).toBeNull();
    expect(screen.getByRole('heading', { name: storyFixture(13, lang).title })).not.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(4);
    expect(fetchPublicNews).not.toHaveBeenCalled();
  });

  test('a same-ID category edit refreshes the real label without changing the canonical article URL', async () => {
    await seeded();
    fetchMock.mockImplementation(async (input) => {
      if (!String(input).includes('/articles?')) return topicResponse(input);
      const body = storyPageFixture(lang);
      body.items[0] = { ...body.items[0], category: 'tech' };
      return jsonResponse(body);
    });
    await act(async () => { event(); });
    const story = screen.getByRole('heading', { name: storyFixture(13, lang).title });
    const card = story.closest('article')!;
    expect(within(card).getByText(getMessagesForLang(lang).categories.scienceTechnology)).not.toBeNull();
    expect(within(card).queryByText(getMessagesForLang(lang).categories.regional)).toBeNull();
    expect(story.closest('a')?.getAttribute('href')).toBe(`${lang === 'en' ? '' : `/${lang}`}/news/story-13`);
  });

  test('failed refresh of an empty seed is an error, not a new successful empty result', async () => {
    fetchMock.mockImplementation(async (input) => String(input).includes('/articles?')
      ? jsonResponse(storyPageFixture(lang, 1, 0))
      : jsonResponse({ ok: true, lang, topic: topicFixture(lang), pinnedArticle: null }));
    await seeded();
    expect(screen.getByText(getMessagesForLang(lang).topicPage.noStoriesYet)).not.toBeNull();
    fetchMock.mockRejectedValue(new Error('offline'));
    await act(async () => { event(); });
    expect(screen.getByRole('alert')).not.toBeNull();
    expect(screen.queryByText(getMessagesForLang(lang).topicPage.noStoriesYet)).toBeNull();
    expect(fetchPublicNews).not.toHaveBeenCalled();
  });

  test('unmounting is not required to deduplicate repeated logical members from a refreshed page', async () => {
    await seeded();
    fetchMock.mockImplementation(async (input) => {
      if (!String(input).includes('/articles?')) return topicResponse(input);
      const body = storyPageFixture(lang);
      body.items[1] = { ...body.items[1], translationKey: body.items[0].translationKey };
      return jsonResponse(body);
    });
    await act(async () => { event(); });
    expect(heading(13)).not.toBeNull();
    expect(heading(12)).toBeNull();
    expect(document.querySelectorAll('article')).toHaveLength(12);
    expect(screen.getByRole('link', { name: getMessagesForLang(lang).topicPage.next }).getAttribute('href')).toBe(editorialTopicPath('navratri-2026', lang, 2));
  });

  test.each(['same-id', 'same-group'])('a new authoritative pin replaces the old pin once, retaining %s deduplication', async (collision) => {
    await seeded();
    fetchMock.mockImplementation(async (input) => {
      if (!String(input).includes('/articles?')) return jsonResponse({
        ok: true, lang, topic: topicFixture(lang), pinnedArticle: storyFixture(101, lang),
      });
      const page = storyPageFixture(lang);
      page.items[0] = collision === 'same-id' ? storyFixture(101, lang)
        : { ...storyFixture(102, lang), translationKey: storyFixture(101, lang).translationKey };
      return jsonResponse(page);
    });
    await act(async () => { event(); });
    expect(screen.getAllByRole('heading', { name: storyFixture(101, lang).title })).toHaveLength(1);
    expect(heading(100)).toBeNull();
    expect(heading(102)).toBeNull();
    expect(document.querySelectorAll('article')).toHaveLength(12);
  });

  test('refreshes exactly page 2 and keeps route/query/page ownership when that page becomes empty', async () => {
    const view = await seeded(2);
    const oldQuery = { ...mockRouter.query };
    const oldPath = mockRouter.asPath;
    fetchMock.mockImplementation(async (input) => topicResponse(input, ' page-two'));
    await act(async () => { event(); });
    expect(heading(1, ' page-two')).not.toBeNull();
    expect(heading(13, ' page-two')).toBeNull();
    expect(fetchMock.mock.calls[1][0]).toBe(`/api/public/topics/navratri-2026/articles?lang=${lang}&page=2&limit=12`);
    fetchMock.mockImplementation(async (input) => String(input).includes('/articles?')
      ? jsonResponse(storyPageFixture(lang, 2, 0))
      : jsonResponse({ ok: true, lang, topic: topicFixture(lang), pinnedArticle: null }));
    await act(async () => { event(); });
    expect(view.container.querySelectorAll('article')).toHaveLength(0);
    expect(screen.getByRole('link', { name: getMessagesForLang(lang).topicPage.previous }).getAttribute('href')).toBe(editorialTopicPath('navratri-2026', lang));
    expect(mockRouter.query).toEqual(oldQuery);
    expect(mockRouter.asPath).toBe(oldPath);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).includes('/articles?')).map(([url]) => url)).toEqual([
      `/api/public/topics/navratri-2026/articles?lang=${lang}&page=2&limit=12`,
      `/api/public/topics/navratri-2026/articles?lang=${lang}&page=2&limit=12`,
    ]);
  });

  test.each(['network', '503', 'malformed-detail', 'missing-pin', 'malformed-page', 'timeout-detail', 'timeout-page'])('%s retains failed surfaces while applying other authoritative results', async (failure) => {
    await seeded();
    if (failure.startsWith('timeout')) jest.useFakeTimers();
    fetchMock.mockImplementation(async (input) => {
      const articles = String(input).includes('/articles?');
      if (failure === 'network') throw new Error('offline');
      if (failure === '503') return jsonResponse({}, 503);
      if ((failure === 'timeout-detail' && !articles) || (failure === 'timeout-page' && articles)) return new Promise(() => {});
      if ((failure === 'malformed-detail' && !articles) || (failure === 'malformed-page' && articles)) return jsonResponse({ ok: true, lang });
      if (failure === 'missing-pin' && !articles) return jsonResponse({ ok: true, lang, topic: topicFixture(lang) });
      return topicResponse(input, ' partial-update');
    });
    await act(async () => {
      event();
      if (failure.startsWith('timeout')) await jest.advanceTimersByTimeAsync(EDITORIAL_TOPICS_TIMEOUT_MS);
    });
    const pageFailed = ['network', '503', 'malformed-page', 'timeout-page'].includes(failure);
    const detailFailed = ['network', '503', 'malformed-detail', 'missing-pin', 'timeout-detail'].includes(failure);
    expect(heading(13, pageFailed ? '' : ' partial-update')).not.toBeNull();
    expect(heading(100, detailFailed ? '' : ' partial-update')).not.toBeNull();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(`${topicNames[lang]}${detailFailed ? '' : ' partial-update'}`);
    expect(screen.getByRole('alert').textContent).toContain(getMessagesForLang(lang).errors.showingPreviousStories);
    expect(console.error).toHaveBeenCalledWith('[editorial-topics] Mounted archive unavailable', expect.any(Error));
    fetchMock.mockImplementation(async (input) => topicResponse(input, ' recovered'));
    await act(async () => { event(); });
    expect(heading(100, ' recovered')).not.toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  test('authoritative topic absence clears stale content without a keyword fallback, and a later event can restore it', async () => {
    await seeded();
    fetchMock.mockImplementation(async (input) => jsonResponse({}, String(input).includes('/articles?') ? 503 : 404));
    await act(async () => { event(); });
    expect(document.querySelectorAll('article')).toHaveLength(0);
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow');
    expect(fetchPublicNews).not.toHaveBeenCalled();
    fetchMock.mockImplementation(async (input) => topicResponse(input));
    await act(async () => { event(); });
    expect(heading(100)).not.toBeNull();
    expect(document.querySelector('meta[name="robots"]')).toBeNull();
  });

  test.each(['locale', 'topic', 'page', 'superseded', 'unmount'])('%s rejects late old responses and cancels owned requests', async (change) => {
    const initial = await loadEditorial(context(lang));
    const nextLang = change === 'locale' ? (lang === 'en' ? 'hi' : lang === 'hi' ? 'gu' : 'en') : lang;
    const nextSlug = change === 'topic' ? 'nobel-prize' : 'navratri-2026';
    const nextPage = change === 'page' ? 2 : 1;
    const next = await loadEditorial(context(nextLang, nextSlug, { page: String(nextPage) }));
    context(lang);
    const view = mount(initial);
    jest.mocked(getPublicApiBaseUrl).mockReturnValue('');
    const finish: Array<(response: Response) => void> = [];
    fetchMock.mockClear().mockImplementation(() => new Promise((resolve) => { finish.push(resolve); }));
    await act(async () => { event(); });
    const oldCalls = [...fetchMock.mock.calls];
    fetchMock.mockImplementation(async (input) => topicResponse(input, ' newest'));
    if (change === 'unmount') view.unmount();
    else {
      if (change !== 'superseded') {
        context(nextLang, nextSlug, { page: String(nextPage) });
        view.rerender(pageTree(next));
      }
      await act(async () => { event(); });
    }
    expect(oldCalls.every(([, init]) => init?.signal?.aborted)).toBe(true);
    await act(async () => { finish.forEach((resolve, index) => resolve(topicResponse(oldCalls[index][0], ' late-old'))); });
    if (change === 'unmount') {
      await act(async () => { event(); });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(view.container.innerHTML).toBe('');
    } else {
      expect(screen.getByRole('heading', { name: `${storyFixture(100, nextLang).title} newest` })).not.toBeNull();
      expect(screen.queryByRole('heading', { name: `${storyFixture(100, lang).title} late-old` })).toBeNull();
      expect(fetchMock.mock.calls.slice(2).map(([url]) => url)).toEqual([
        `/api/public/topics/${nextSlug}?lang=${nextLang}`,
        `/api/public/topics/${nextSlug}/articles?lang=${nextLang}&page=${nextPage}&limit=12`,
      ]);
    }
  });
});

describe('legacy keyword/tag compatibility', () => {
  test.each(['en', 'hi', 'gu'] as const)('an unknown %s topic cannot invent a keyword archive', async (locale) => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: false }, 404));
    expect(await getServerSideProps(context(locale, 'old-news-tag'))).toEqual({ notFound: true });
    expect(fetchPublicNews).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  test.each(['en', 'hi', 'gu'] as const)('explicit %s article tag q bypasses editorial lookup and keeps one legacy canonical', async (locale) => {
    const props = await load(context(locale, 'navratri-2026', { q: 'existing-tag' }));
    expect(props.mode).toBe('legacy');
    mount(props);
    await waitFor(() => expect(fetchPublicNews).toHaveBeenCalledWith(expect.objectContaining({ q: 'existing-tag', language: locale, limit: 30 })));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(`${siteUrl}${editorialTopicPath('navratri-2026', locale)}?q=existing-tag`);
  });

  test.each(['future-topic', 'active-off-topic'])('a backend 404 for %s cannot expose an editorial or keyword archive', async (slug) => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: false, code: 'TOPIC_NOT_FOUND' }, 404));
    expect(await getServerSideProps(context('en', slug))).toEqual({ notFound: true });
    expect(fetchPublicNews).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

test.each(['network', '503', 'malformed-detail', 'malformed-page'])('temporary %s failures produce an explicit 503/noindex page, not guessed membership', async (failure) => {
  fetchMock.mockImplementation(async (input) => {
    if (failure === 'network') throw new Error('offline');
    if (failure === '503') return jsonResponse({}, 503);
    if (failure === 'malformed-detail' || String(input).includes('/articles?')) return jsonResponse({ ok: true, lang: 'en' });
    return jsonResponse({ ok: true, lang: 'en', topic: topicFixture(), pinnedArticle: null });
  });
  const ctx = context();
  const props = await load(ctx);
  expect(props.mode).toBe('unavailable');
  expect(ctx.res.statusCode).toBe(503);
  expect(ctx.res.setHeader).toHaveBeenCalledWith('Retry-After', '60');
  mount(props);
  expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow');
  expect(document.querySelectorAll('link[rel="canonical"]')).toHaveLength(0);
  expect(fetchPublicNews).not.toHaveBeenCalled();
  expect(console.error).toHaveBeenCalled();
});
