import React from 'react';
import type { GetServerSidePropsContext } from 'next';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import SponsoredContentPage, { getServerSideProps, type SponsoredContentPageProps } from '../../pages/sponsored-content';
import { LanguageProvider, getMessagesForLang } from '../../src/i18n/LanguageProvider';
import type { RouteLocale } from '../../lib/localizedArticleFields';
import { dispatchPublicDataRefresh } from '../../lib/publicDataRefresh';
import {
  fetchSponsoredNewsPage, sponsoredContentPath, SponsoredNewsReadError, SPONSORED_NEWS_INVALID_RESPONSE,
  SPONSORED_NEWS_UNAVAILABLE, type SponsoredNewsPage,
} from '../../lib/publicSponsoredNews';
import { sponsoredArticleFixture, sponsoredNewsFixture } from '../fixtures/sponsoredNews';

jest.mock('next/head', () => ({ __esModule: true, default: ({ children }: React.PropsWithChildren) => <>{children}</> }));
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ locale, prefetch, children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { locale?: false; prefetch?: boolean }) => <a {...props}>{children}</a>,
}));
jest.mock('../../src/components/story/StoryImage', () => ({
  __esModule: true, default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));
jest.mock('../../lib/publicSponsoredNews', () => ({
  ...jest.requireActual('../../lib/publicSponsoredNews'),
  fetchSponsoredNewsPage: jest.fn(),
}));

const fetchMock = jest.mocked(fetchSponsoredNewsPage);
const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

function propsFor(locale: RouteLocale = 'en', requestedPage = 1, initialPage: SponsoredNewsPage | null = sponsoredNewsFixture(locale, requestedPage)): SponsoredContentPageProps {
  return {
    locale, requestedPage, initialPage, messages: {},
    seo: { canonicalUrl: `https://www.newspulse.co.in${sponsoredContentPath(locale, requestedPage)}`, alternates: [] },
  };
}

function pageView(props = propsFor(), lang = props.locale) {
  return <LanguageProvider initialLang={lang}><SponsoredContentPage {...props} /></LanguageProvider>;
}

function refresh(version = '2') {
  dispatchPublicDataRefresh({ version, previousVersion: '1', source: 'test' });
}

async function serverRead(locale: RouteLocale = 'en', query: GetServerSidePropsContext['query'] = {}) {
  const res: Partial<GetServerSidePropsContext['res']> = { statusCode: 200, setHeader: jest.fn() };
  const req: Partial<GetServerSidePropsContext['req']> = { headers: { host: 'localhost:3000' }, cookies: {} };
  const context: GetServerSidePropsContext = {
    locale, query, resolvedUrl: sponsoredContentPath(locale),
    req: req as GetServerSidePropsContext['req'], res: res as GetServerSidePropsContext['res'],
  };
  const result = await getServerSideProps(context);
  return { result, res };
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue(sponsoredNewsFixture());
  process.env.NEXT_PUBLIC_SITE_URL = 'https://www.newspulse.co.in';
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  jest.restoreAllMocks();
  if (originalSiteUrl === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
});

test.each(['gu', 'hi', 'en'] as const)('%s route has translated copy, canonical persisted article links, sponsorship and original categories', (lang) => {
  const props = propsFor(lang);
  const { container } = render(pageView(props));
  const copy = getMessagesForLang(lang).sponsoredContent;
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(copy.title);
  expect(document.title).toBe(`${copy.title} | News Pulse`);
  expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(copy.description);
  const cards = container.querySelectorAll('article');
  expect(cards).toHaveLength(12);
  const first = within(cards[0]);
  const story = sponsoredArticleFixture(1, lang);
  expect(first.getByRole('link', { name: story.title }).getAttribute('href')).toBe(`${lang === 'en' ? '' : `/${lang}`}/news/persisted-story-1`);
  expect(first.getByText(copy.label)).toBeTruthy();
  expect(first.getByText(copy.sponsoredBy.replace('{{sponsor}}', 'Example Sponsor 1'))).toBeTruthy();
  expect(first.getByText(getMessagesForLang(lang).categories.business)).toBeTruthy();
  expect(first.getByRole('img').getAttribute('src')).toBe('/fallback.svg');
  expect(cards[0].querySelector('time')?.getAttribute('datetime')).toBe(story.publishedAt);
  expect(container.textContent).not.toContain('expired');
  expect(container.textContent).not.toContain('unused-locale-alias');
  expect(fetchMock).not.toHaveBeenCalled();
});

test('optional summary, sponsor and image are omitted without invented content or promotional CTAs', () => {
  const initial = { ...sponsoredNewsFixture('en', 1, 1), items: [sponsoredArticleFixture(1, 'en', {
    imageUrl: undefined, summary: undefined, sponsorName: undefined,
    sponsorDestinationUrl: 'https://sponsor.test/buy', sponsorCtaLabel: 'Buy now', campaignStatus: 'active',
  })] };
  const { container } = render(pageView(propsFor('en', 1, initial)));
  expect(container.querySelector('article img')).toBeNull();
  expect(screen.queryByText(/Sponsored by/)).toBeNull();
  expect(screen.queryByText('Buy now')).toBeNull();
  expect(container.querySelector('a[href^="https://sponsor.test"]')).toBeNull();
  expect(screen.getByRole('link', { name: 'Sponsored article 1' }).getAttribute('href')).toBe('/news/persisted-story-1');
});

test.each([1, 2, 3])('page %s preserves backend counts and accessible Previous/Next boundaries', (page) => {
  const { container } = render(pageView(propsFor('en', page)));
  const nav = screen.getByRole('navigation', { name: 'Sponsored content pages' });
  expect(screen.getByText('Published sponsored articles: 25')).toBeTruthy();
  expect(within(nav).getByText(`Page ${page} of 3`).getAttribute('aria-current')).toBe('page');
  expect(container.querySelectorAll('article')).toHaveLength(page === 3 ? 1 : 12);
  if (page === 1) expect(within(nav).getByRole('button', { name: 'Previous page' }).hasAttribute('disabled')).toBe(true);
  else {
    const previous = within(nav).getByRole('link', { name: 'Previous page' });
    expect(previous.getAttribute('href')).toBe(sponsoredContentPath('en', page - 1));
    expect(previous.getAttribute('rel')).toBe('prev');
    previous.focus();
    expect(document.activeElement).toBe(previous);
  }
  if (page === 3) expect(within(nav).getByRole('button', { name: 'Next page' }).hasAttribute('disabled')).toBe(true);
  else {
    const next = within(nav).getByRole('link', { name: 'Next page' });
    expect(next.getAttribute('href')).toBe(sponsoredContentPath('en', page + 1));
    expect(next.getAttribute('rel')).toBe('next');
    next.focus();
    expect(document.activeElement).toBe(next);
  }
});

test.each(['gu', 'hi', 'en'] as const)('%s valid empty state is distinct from an error', (lang) => {
  render(pageView(propsFor(lang, 1, sponsoredNewsFixture(lang, 1, 0))));
  const copy = getMessagesForLang(lang).sponsoredContent;
  expect(screen.getByText(copy.empty)).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.getAllByRole('button').every((button) => button.hasAttribute('disabled'))).toBe(true);
});

test('a failed refresh retains verified content and counts with a warning, not an empty state', async () => {
  fetchMock.mockRejectedValue(new SponsoredNewsReadError(SPONSORED_NEWS_UNAVAILABLE, 'HTTP 503'));
  const { container } = render(pageView());
  await act(async () => { refresh(); });
  expect(screen.getByRole('alert').textContent).toContain('Showing previously verified sponsored articles.');
  expect(container.querySelectorAll('article')).toHaveLength(12);
  expect(screen.getByText('Published sponsored articles: 25')).toBeTruthy();
  expect(screen.queryByText(getMessagesForLang('en').sponsoredContent.empty)).toBeNull();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('a contract violation clears unsafe retained content and remains a visible read error', async () => {
  fetchMock.mockRejectedValue(new SponsoredNewsReadError(SPONSORED_NEWS_INVALID_RESPONSE, 'Nonpublic article'));
  const { container } = render(pageView());
  await act(async () => { refresh(); });
  expect(screen.getByRole('alert')).toBeTruthy();
  expect(container.querySelectorAll('article')).toHaveLength(0);
  expect(screen.queryByText(/Published sponsored articles:/)).toBeNull();
  expect(screen.queryByText(getMessagesForLang('en').sponsoredContent.empty)).toBeNull();
});

test('a validated empty refresh removes previously loaded stories', async () => {
  fetchMock.mockResolvedValue(sponsoredNewsFixture('en', 1, 0));
  const { container } = render(pageView());
  await act(async () => { refresh(); });
  expect(container.querySelectorAll('article')).toHaveLength(0);
  expect(screen.getByText(getMessagesForLang('en').sponsoredContent.empty)).toBeTruthy();
  expect(screen.getByText('Published sponsored articles: 0')).toBeTruthy();
});

test.each(['gu', 'hi', 'en'] as const)('%s 503 offers a single in-flight, explicit retry with a loading state', async (lang) => {
  let complete!: (value: SponsoredNewsPage) => void;
  fetchMock.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
  render(pageView(propsFor(lang, 1, null)));
  const copy = getMessagesForLang(lang).sponsoredContent;
  expect(screen.getByRole('alert').textContent).toContain(copy.error);
  expect(screen.queryByText(copy.empty)).toBeNull();
  expect(fetchMock).not.toHaveBeenCalled();
  const retry = screen.getByRole('button', { name: copy.retry });
  fireEvent.click(retry);
  fireEvent.click(retry);
  expect(retry.hasAttribute('disabled')).toBe(true);
  expect(screen.getByRole('status').textContent).toContain(copy.loading);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  await act(async () => { complete(sponsoredNewsFixture(lang)); });
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.queryByRole('status')).toBeNull();
  expect(screen.getByRole('link', { name: sponsoredArticleFixture(1, lang).title })).toBeTruthy();
  expect(document.querySelector('meta[name="robots"]')).toBeNull();
});

test.each(['locale', 'page'] as const)('%s changes cancel pending reads and discard late results', async (change) => {
  let complete!: (value: SponsoredNewsPage) => void;
  fetchMock.mockImplementation(() => new Promise((resolve) => { complete = resolve; }));
  const view = render(pageView());
  act(() => { refresh(); });
  const signal = fetchMock.mock.calls[0][2];
  const next = change === 'locale' ? propsFor('hi') : propsFor('en', 2);
  view.rerender(pageView(next));
  expect(signal?.aborted).toBe(true);
  await act(async () => { complete(sponsoredNewsFixture('en')); });
  expect(screen.queryByRole('link', { name: 'Sponsored article 1' })).toBeNull();
  expect(screen.getByRole('link', { name: sponsoredArticleFixture(change === 'page' ? 13 : 1, next.locale).title })).toBeTruthy();
  expect(screen.queryByRole('alert')).toBeNull();
});

test('a new route language never renders an old-locale seed while navigation is pending', () => {
  fetchMock.mockImplementation(() => new Promise(() => {}));
  const props = propsFor('en');
  const view = render(pageView(props));
  act(() => { refresh(); });
  const signal = fetchMock.mock.calls[0][2];
  view.rerender(pageView(props, 'gu'));
  expect(signal?.aborted).toBe(true);
  expect(view.container.querySelectorAll('article')).toHaveLength(0);
  expect(screen.getByRole('status').textContent).toContain(getMessagesForLang('gu').sponsoredContent.loading);
});

test('unmount cancels the read and removes the public-version subscription', () => {
  fetchMock.mockImplementation(() => new Promise(() => {}));
  const view = render(pageView());
  act(() => { refresh(); });
  const signal = fetchMock.mock.calls[0][2];
  view.unmount();
  expect(signal?.aborted).toBe(true);
  act(() => { refresh('3'); });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test.each(['gu', 'hi', 'en'] as const)('%s SSR seeds page two with page-aware canonical and GU/HI/EN alternates', async (locale) => {
  fetchMock.mockResolvedValue(sponsoredNewsFixture(locale, 2));
  const { result, res } = await serverRead(locale, { page: '2' });
  expect(fetchMock).toHaveBeenCalledWith(locale, 2);
  expect(res.statusCode).toBe(200);
  expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store, max-age=0');
  if (!('props' in result)) throw new Error('Expected archive page props');
  const props = await result.props;
  expect(props.initialPage).toMatchObject({ page: 2, limit: 12, total: 25, totalPages: 3 });
  expect(props.seo.canonicalUrl).toBe(`https://www.newspulse.co.in${sponsoredContentPath(locale, 2)}`);
  expect(props.seo.alternates).toEqual(['gu', 'hi', 'en', 'x-default'].map((hrefLang) => ({
    hrefLang, href: `https://www.newspulse.co.in${sponsoredContentPath(hrefLang === 'x-default' ? 'en' : hrefLang as RouteLocale, 2)}`,
  })));
  expect(props.messages.sponsoredContent).toEqual(getMessagesForLang(locale).sponsoredContent);
});

test.each(['0', '01', '-1', '1e2', ['1', '2']])('invalid page %j redirects without a backend request', async (page) => {
  expect((await serverRead('gu', { page })).result).toEqual({ redirect: { destination: '/gu/sponsored-content', permanent: false } });
  expect(fetchMock).not.toHaveBeenCalled();
});

test('an out-of-range page redirects using the supplied backend totalPages, not card count', async () => {
  fetchMock.mockResolvedValue(sponsoredNewsFixture('hi', 4));
  expect((await serverRead('hi', { page: '4' })).result).toEqual({
    redirect: { destination: '/hi/sponsored-content?page=3', permanent: false },
  });
});

test('an initial read failure is a no-store HTTP 503 with safe Retry-After and retryable props', async () => {
  fetchMock.mockRejectedValue(new SponsoredNewsReadError(SPONSORED_NEWS_UNAVAILABLE, 'HTTP 503', '45'));
  const { result, res } = await serverRead();
  expect(res.statusCode).toBe(503);
  expect(res.setHeader).toHaveBeenCalledWith('Retry-After', '45');
  if (!('props' in result)) throw new Error('Expected error page props');
  const props = await result.props;
  expect(props.initialPage).toBeNull();
  render(pageView(props));
  await waitFor(() => expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, follow'));
});
