import React from 'react';
import type { GetServerSidePropsContext } from 'next';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { render, screen, waitFor } from '@testing-library/react';
import TopicPage, { getServerSideProps, type TopicPageProps } from '../../pages/topic/[slug]';
import SeoAlternates from '../../components/SeoAlternates';
import { LanguageProvider, getMessagesForLang } from '../../src/i18n/LanguageProvider';
import { fetchPublicNews } from '../../lib/publicNewsApi';
import { normalizeRouteLocale, type RouteLocale } from '../../lib/localizedArticleFields';
import { editorialTopicPath } from '../../lib/publicEditorialTopics';
import { jsonResponse, storyFixture, storyPageFixture, topicDescriptions, topicFixture, topicNames } from '../fixtures/editorialTopics';

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
jest.mock('../../lib/publicApiBase', () => ({ getPublicApiBaseUrl: () => 'http://localhost:3010' }));
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
function mount(props: TopicPageProps) {
  const seo = props.mode === 'editorial' ? props.seo : undefined;
  return render(
    <LanguageProvider initialLang={props.locale}>
      <SeoAlternates canonicalUrl={seo?.canonicalUrl} alternates={seo?.alternates} disabled={props.mode === 'unavailable' && props.seo.disableAlternates} />
      <TopicPage {...props} />
    </LanguageProvider>
  );
}

beforeEach(() => {
  jest.replaceProperty(process, 'env', { ...process.env, NEXT_PUBLIC_SITE_URL: siteUrl });
  jest.spyOn(console, 'error').mockImplementation(() => {});
  global.fetch = fetchMock;
  fetchMock.mockReset().mockImplementation(async (input) => {
    const url = new URL(String(input));
    const lang = normalizeRouteLocale(url.searchParams.get('lang'));
    if (url.pathname.endsWith('/articles')) return jsonResponse(storyPageFixture(lang, Number(url.searchParams.get('page'))));
    return jsonResponse({ ok: true, lang, topic: topicFixture(lang), pinnedArticle: storyFixture(100, lang) });
  });
  jest.mocked(fetchPublicNews).mockReset().mockResolvedValue({ items: [], meta: {}, endpoint: '/api/public/news' });
});
afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
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

describe('legacy keyword/tag compatibility', () => {
  test.each(['en', 'hi', 'gu'] as const)('an unknown %s topic keeps its current keyword page', async (locale) => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: false }, 404));
    const props = await load(context(locale, 'old-news-tag'));
    expect(props.mode).toBe('legacy');
    mount(props);
    await waitFor(() => expect(fetchPublicNews).toHaveBeenCalledWith(expect.objectContaining({ q: 'old news tag', language: locale, limit: 30 })));
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

  test.each(['future-topic', 'hidden-topic'])('a backend 404 for %s cannot expose an editorial archive', async (slug) => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: false, code: 'TOPIC_NOT_FOUND' }, 404));
    const props = await load(context('en', slug));
    expect(props.mode).toBe('legacy');
    expect(props).not.toHaveProperty('pinnedArticle');
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
