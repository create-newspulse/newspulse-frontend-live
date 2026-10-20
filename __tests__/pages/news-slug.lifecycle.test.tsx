import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import NewsSlugDetailPage from '../../pages/news/[slug]';
import { dispatchPublicDataRefresh } from '../../lib/publicDataRefresh';
import type { Article } from '../../lib/publicNewsApi';

jest.mock('next/head', () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
jest.mock('next/router', () => ({
  useRouter: () => ({ query: { slug: 'original-slug' }, asPath: '/news/original-slug' }),
}));
jest.mock('../../src/i18n/LanguageProvider', () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));
jest.mock('../../src/components/ads/AdSlot', () => ({
  __esModule: true, default: () => null,
}));
jest.mock('../../src/components/category/CategoryHeader', () => ({
  __esModule: true, default: ({ title }: { title: string }) => <header>{title}</header>,
}));
jest.mock('../../src/components/story/StoryImage', () => ({
  __esModule: true,
  default: () => null,
  ArticleHeroImage: () => null,
}));
jest.mock('../../hooks/useArticleAnalytics', () => ({ useArticleAnalytics: jest.fn() }));
jest.mock('../../lib/publicApiBase', () => ({ getPublicApiBaseUrl: () => '' }));

function article(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'article-1', translationGroupId: 'group-1', language: 'en', status: 'published',
    slug: 'original-slug', title: 'Original title', summary: 'Original summary',
    content: '<p>Original body</p>', category: 'national',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function props(story: Article, lang: 'en' | 'hi' | 'gu' = 'en'): React.ComponentProps<typeof NewsSlugDetailPage> {
  return {
    messages: {}, locale: lang, lang, slug: story.slug || story._id,
    article: story, safeHtml: story.content || '', topStories: [], relatedStories: [],
    error: null, pending: false, siteUrl: 'https://www.newspulse.co.in',
  };
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status });
}

function deferred() {
  let resolve!: (value: Response) => void;
  const promise = new Promise<Response>((done) => { resolve = done; });
  return { promise, resolve };
}

const originalFetch = global.fetch;
const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
let version = 0;

async function refresh() {
  await act(async () => {
    dispatchPublicDataRefresh({ version: `version-${++version}`, previousVersion: null, source: 'backend' });
  });
}

async function expectWithdrawn() {
  await waitFor(() => expect(screen.getByRole('heading', { name: '404' })).toBeTruthy());
  expect(screen.queryByText('Original title')).toBeNull();
  expect(screen.queryByText('Original summary')).toBeNull();
  expect(screen.queryByText('Original body')).toBeNull();
  expect(document.querySelector('script[type="application/ld+json"]')).toBeNull();
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockRejectedValue(new Error('Unexpected test read'));
  global.fetch = fetchMock;
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'debug').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test.each(['en', 'hi', 'gu'] as const)('%s published sponsored article remains accessible and still withdraws on unpublish', async (lang) => {
  const story = article({
    language: lang, isSponsoredArticle: true, sponsorName: 'Fixture Sponsor',
    sponsorDisclosure: 'Paid fixture disclosure.', sponsorCtaText: 'Visit fixture sponsor',
    sponsorDestinationUrl: 'https://sponsor.test/information',
  });
  render(<NewsSlugDetailPage {...props(story, lang)} />);
  expect(screen.getByRole('heading', { name: 'Original title' })).toBeTruthy();
  expect(screen.getByText('Original body')).toBeTruthy();
  expect(screen.getByText('Paid fixture disclosure.')).toBeTruthy();
  const cta = screen.getByRole('link', { name: /Visit fixture sponsor/ });
  expect(cta.getAttribute('href')).toBe('https://sponsor.test/information');
  expect(cta.getAttribute('rel')).toBe('sponsored noopener noreferrer');
  fetchMock.mockResolvedValueOnce(json({ items: [{ ...story, status: 'unpublished' }] }));
  await refresh();
  await expectWithdrawn();
});

test('does not add mount-time reads or article polling', async () => {
  jest.useFakeTimers();
  render(<NewsSlugDetailPage {...props(article())} />);
  await act(async () => { await jest.advanceTimersByTimeAsync(60_000); });
  expect(fetchMock).not.toHaveBeenCalled();
  expect(screen.getByRole('heading', { name: 'Original title' })).toBeTruthy();
});

describe('pending translation read recovery', () => {
  test.each(['headers', 'body'])('bounds stalled %s and exposes the existing retry without fabricating an article', async (stage) => {
    jest.useFakeTimers();
    let signal: AbortSignal | null | undefined;
    fetchMock.mockImplementation((_url, init) => {
      signal = init?.signal;
      if (stage === 'headers') return new Promise<Response>(() => {});
      const response = json({});
      jest.spyOn(response, 'json').mockImplementation(() => new Promise<never>(() => {}));
      return Promise.resolve(response);
    });
    const initialProps = props(article());
    const view = render(<NewsSlugDetailPage {...initialProps} />);
    view.rerender(<NewsSlugDetailPage {...initialProps} lang="hi" locale="hi" article={null} safeHtml="" pending />);
    await act(async () => { await jest.advanceTimersByTimeAsync(1500); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => { await jest.advanceTimersByTimeAsync(3999); });
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
    await act(async () => { await jest.advanceTimersByTimeAsync(1); });
    expect(signal?.aborted).toBe(true);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(screen.queryByText('Original title')).toBeNull();
    expect(screen.queryByText('Original body')).toBeNull();
    await act(async () => { await jest.advanceTimersByTimeAsync(60_000); });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('still accepts an eligible published translation without another read', async () => {
    jest.useFakeTimers();
    fetchMock.mockResolvedValueOnce(json({ article: article() }));
    render(<NewsSlugDetailPage {...props(article())} article={null} safeHtml="" pending />);
    await act(async () => { await jest.advanceTimersByTimeAsync(1500); });
    expect(screen.getByRole('heading', { name: 'Original title' })).toBeTruthy();
    expect(screen.getByText('Original body')).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('keeps the existing ten-attempt recovery limit', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation(async () => json({ status: 'pending', sourceLang: 'en' }));
    render(<NewsSlugDetailPage {...props(article())} article={null} safeHtml="" pending />);
    await act(async () => { await jest.advanceTimersByTimeAsync(16_500); });
    expect(fetchMock).toHaveBeenCalledTimes(10);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    await act(async () => { await jest.advanceTimersByTimeAsync(60_000); });
    expect(fetchMock).toHaveBeenCalledTimes(10);
    expect(jest.getTimerCount()).toBe(0);
  });
});

test.each([
  { status: 'unpublished' }, { status: 'draft' }, { status: 'scheduled' },
  { status: 'archived' }, { isDeleted: true }, { deleted: true },
  { deletedAt: '2026-01-02T00:00:00.000Z' }, { isPublished: false },
  { publishedAt: '2999-01-01T00:00:00.000Z' },
])('withdraws a same-ID authoritative lifecycle change %j', async (changes) => {
  fetchMock.mockResolvedValueOnce(json({ items: [article(changes)] }));
  render(<NewsSlugDetailPage {...props(article())} />);
  await refresh();
  await expectWithdrawn();
});

test.each(['en', 'hi', 'gu'] as const)('authoritative empty group withdraws the open %s article', async (lang) => {
  fetchMock.mockResolvedValueOnce(json({ items: [] }));
  render(<NewsSlugDetailPage {...props(article({ language: lang }), lang)} />);
  await refresh();
  await expectWithdrawn();
  expect(String(fetchMock.mock.calls[0][0])).toBe(`/api/public/news/group/group-1?lang=${lang}&language=${lang}`);
});

test.each(['network', 'HTTP', 'JSON', 'invalid shape', 'failed envelope'])('%s group failure retains previous content and shows a safe warning', async (stage) => {
  if (stage === 'network') fetchMock.mockRejectedValueOnce(new Error('private upstream diagnostics'));
  else if (stage === 'HTTP') fetchMock.mockResolvedValueOnce(new Response('private upstream diagnostics', { status: 503 }));
  else if (stage === 'JSON') fetchMock.mockResolvedValueOnce(new Response('invalid JSON'));
  else fetchMock.mockResolvedValueOnce(json(stage === 'invalid shape' ? {} : { ok: false, items: [] }));
  render(<NewsSlugDetailPage {...props(article())} />);
  await refresh();
  await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Showing previously loaded stories.'));
  expect(screen.getByRole('heading', { name: 'Original title' })).toBeTruthy();
  expect(screen.getByText('Original body')).toBeTruthy();
  expect(screen.queryByRole('heading', { name: '404' })).toBeNull();
  expect(document.body.textContent).not.toContain('private upstream');
});

test.each(['en', 'hi', 'gu'] as const)('standalone %s article refreshes by its existing ID even after a slug edit', async (lang) => {
  const initial = article({ translationGroupId: undefined, language: lang });
  const updated = { ...initial, title: 'Updated title', slug: 'updated-slug', content: '<p>Updated body</p>', updatedAt: '2026-01-02T00:00:00.000Z' };
  fetchMock.mockResolvedValueOnce(json({ article: updated }));
  render(<NewsSlugDetailPage {...props(initial, lang)} />);
  await refresh();
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Updated title' })).toBeTruthy());
  expect(screen.getByText('Updated body')).toBeTruthy();
  expect(String(fetchMock.mock.calls[0][0])).toBe(`/api/public/news/article-1?lang=${lang}&language=${lang}`);
  const prefix = lang === 'en' ? '' : `/${lang}`;
  expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(`https://www.newspulse.co.in${prefix}/news/updated-slug`);
});

test.each([404, 410])('standalone HTTP %s withdraws content but permits a later published restore', async (status) => {
  const initial = article({ translationGroupId: undefined });
  fetchMock.mockResolvedValueOnce(json({ message: 'NOT_FOUND' }, status))
    .mockResolvedValueOnce(json({ article: initial }));
  render(<NewsSlugDetailPage {...props(initial)} />);
  await refresh();
  await expectWithdrawn();
  await refresh();
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Original title' })).toBeTruthy());
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test.each(['network', 'HTTP', 'empty success'])('standalone %s failure is not deletion', async (stage) => {
  if (stage === 'network') fetchMock.mockRejectedValueOnce(new Error('private failure'));
  else fetchMock.mockResolvedValueOnce(json({}, stage === 'HTTP' ? 503 : 200));
  render(<NewsSlugDetailPage {...props(article({ translationGroupId: undefined }))} />);
  await refresh();
  await waitFor(() => expect(screen.getByRole('status')).toBeTruthy());
  expect(screen.getByRole('heading', { name: 'Original title' })).toBeTruthy();
});

test('same-ID content and metadata updates win without a version or timestamp change', async () => {
  fetchMock.mockResolvedValueOnce(json({ items: [article({
    title: 'Updated title', summary: 'Updated summary', content: '<p>Updated body</p>', category: 'business',
  })] }));
  render(<NewsSlugDetailPage {...props(article())} />);
  await refresh();
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Updated title' })).toBeTruthy());
  expect(screen.getByText('Updated summary')).toBeTruthy();
  expect(screen.getByText('Updated body')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'business' }).getAttribute('href')).toBe('/business');
  expect(screen.queryByText('Original body')).toBeNull();
});

test('a known older same-ID published snapshot does not roll back newer content', async () => {
  fetchMock.mockResolvedValueOnce(json({ items: [article({ title: 'Older title', updatedAt: '2025-01-01T00:00:00.000Z' })] }));
  render(<NewsSlugDetailPage {...props(article())} />);
  await refresh();
  expect(screen.getByRole('heading', { name: 'Original title' })).toBeTruthy();
  expect(screen.queryByText('Older title')).toBeNull();
});

test('withdrawing a requested translation does not leak the original language', async () => {
  const initial = article({
    translations: { hi: { title: 'Localized title', summary: 'Localized summary', content: '<p>Localized body</p>', slug: 'localized-slug' } },
    translationStatus: { hi: 'APPROVED' },
  });
  fetchMock.mockResolvedValueOnce(json({ items: [{ ...initial, translationStatus: { hi: 'BLOCKED' } }] }));
  render(<NewsSlugDetailPage {...props(initial, 'hi')} safeHtml="<p>Localized body</p>" />);
  await refresh();
  await expectWithdrawn();
  expect(screen.queryByText('Localized body')).toBeNull();
});

test('keeps locale-group selection when a distinct locale variant becomes authoritative', async () => {
  const initial = article({
    translations: { gu: { title: 'Embedded title', content: '<p>Embedded body</p>' } },
  });
  fetchMock.mockResolvedValueOnce(json({ items: [
    article(),
    article({ _id: 'article-gu', language: 'gu', title: 'Gujarati variant', content: '<p>Gujarati body</p>' }),
  ] }));
  render(<NewsSlugDetailPage {...props(initial, 'gu')} />);
  await refresh();
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Gujarati variant' })).toBeTruthy());
  expect(screen.queryByText('Original title')).toBeNull();
});

test.each(['draft', 'scheduled', 'published'])('Restore %s obeys backend publication eligibility', async (status) => {
  fetchMock.mockResolvedValueOnce(json({ items: [] }))
    .mockResolvedValueOnce(json({ items: [article({ status })] }));
  render(<NewsSlugDetailPage {...props(article())} />);
  await refresh();
  await expectWithdrawn();
  await refresh();
  if (status === 'published') {
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Original title' })).toBeTruthy());
    expect(screen.getByText('Original body')).toBeTruthy();
  } else {
    await expectWithdrawn();
  }
  expect(fetchMock).toHaveBeenCalledTimes(2);
});

test('a failed read after withdrawal never resurrects the saved snapshot', async () => {
  fetchMock.mockResolvedValueOnce(json({ items: [] }))
    .mockRejectedValueOnce(new Error('temporary outage'));
  render(<NewsSlugDetailPage {...props(article())} />);
  await refresh();
  await expectWithdrawn();
  await refresh();
  await expectWithdrawn();
});

test.each(['withdrawal', 'update'])('a late older response cannot overwrite a newer %s', async (outcome) => {
  const older = deferred();
  fetchMock.mockReturnValueOnce(older.promise)
    .mockResolvedValueOnce(json({ items: outcome === 'withdrawal' ? [] : [article({ title: 'Newest title' })] }));
  render(<NewsSlugDetailPage {...props(article())} />);
  await refresh();
  const oldSignal = fetchMock.mock.calls[0][1]?.signal;
  await refresh();
  expect(oldSignal?.aborted).toBe(true);
  await act(async () => { older.resolve(json({ items: [article({ title: 'Stale title' })] })); });
  if (outcome === 'withdrawal') await expectWithdrawn();
  else await waitFor(() => expect(screen.getByRole('heading', { name: 'Newest title' })).toBeTruthy());
  expect(screen.queryByText('Stale title')).toBeNull();
  expect(screen.queryByRole('status')).toBeNull();
});

test('late withdrawal cannot overwrite a newer published restore', async () => {
  const older = deferred();
  fetchMock.mockResolvedValueOnce(json({ items: [] }))
    .mockReturnValueOnce(older.promise)
    .mockResolvedValueOnce(json({ items: [article({ title: 'Restored title' })] }));
  render(<NewsSlugDetailPage {...props(article())} />);
  await refresh();
  await expectWithdrawn();
  await refresh();
  await refresh();
  await act(async () => { older.resolve(json({ items: [] })); });
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Restored title' })).toBeTruthy());
});

test.each(['slug', 'locale'])('navigation by %s aborts old reads and resets the article identity', async (navigation) => {
  const older = deferred();
  fetchMock.mockReturnValueOnce(older.promise);
  const view = render(<NewsSlugDetailPage {...props(article())} />);
  await refresh();
  const signal = fetchMock.mock.calls[0][1]?.signal;
  const lang = navigation === 'locale' ? 'hi' : 'en';
  const next = article({ _id: 'article-2', translationGroupId: 'group-2', title: 'Next article', slug: 'next-slug', language: lang });
  view.rerender(<NewsSlugDetailPage {...props(next, lang)} />);
  expect(signal?.aborted).toBe(true);
  await act(async () => { older.resolve(json({ items: [] })); });
  expect(screen.getByRole('heading', { name: 'Next article' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: '404' })).toBeNull();
});

test('unmount aborts the request and unsubscribes from public-version events', async () => {
  const pending = deferred();
  fetchMock.mockReturnValueOnce(pending.promise);
  const view = render(<NewsSlugDetailPage {...props(article())} />);
  await refresh();
  const signal = fetchMock.mock.calls[0][1]?.signal;
  view.unmount();
  expect(signal?.aborted).toBe(true);
  await act(async () => { pending.resolve(json({ items: [] })); });
  await refresh();
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test('a stalled refresh is bounded, keeps content, and does not add polling', async () => {
  jest.useFakeTimers();
  fetchMock.mockImplementation(() => new Promise<Response>(() => {}));
  render(<NewsSlugDetailPage {...props(article())} />);
  await refresh();
  const signal = fetchMock.mock.calls[0][1]?.signal;
  await act(async () => { await jest.advanceTimersByTimeAsync(4000); });
  expect(signal?.aborted).toBe(true);
  expect(screen.getByRole('status').textContent).toContain('Showing previously loaded stories.');
  expect(screen.getByRole('heading', { name: 'Original title' })).toBeTruthy();
  await act(async () => { await jest.advanceTimersByTimeAsync(60_000); });
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(jest.getTimerCount()).toBe(0);
});

describe.each(['group', 'standalone'])('%s malformed-record protection', (route) => {
  test.each([
    { _id: 'article-1' },
    article({ deletedAt: { unexpected: true } }),
    article({ error: 'synthetic-private-diagnostic' }),
    article({ translationStatus: { hi: {} } }),
  ])('retains the published article on an invalid record: %j', async (record) => {
    const initial = article({ translationGroupId: route === 'group' ? 'group-1' : undefined });
    fetchMock.mockResolvedValueOnce(json(route === 'group' ? { items: [record] } : { article: record }));
    render(<NewsSlugDetailPage {...props(initial)} />);
    await refresh();
    await waitFor(() => expect(screen.getByRole('status').textContent).toContain('Showing previously loaded stories.'));
    expect(screen.getByRole('heading', { name: 'Original title' })).toBeTruthy();
    expect(screen.getByText('Original body')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: '404' })).toBeNull();
    expect(document.body.textContent).not.toContain('synthetic-private');
  });
});

test.each([
  { status: 'draft' }, { status: 'unpublished' }, { isDeleted: true },
  { deletedAt: '2026-10-15T00:00:00.000Z' }, { status: 'archived' }, { archived: true },
])('an Oct 15 lifecycle record cannot withdraw the Oct 16 published article: %j', async (change) => {
  const current = article({ updatedAt: '2026-10-16T12:00:00.000Z' });
  fetchMock.mockResolvedValueOnce(json({ items: [{ ...current, ...change, updatedAt: '2026-10-15T12:00:00.000Z' }] }));
  render(<NewsSlugDetailPage {...props(current)} />);
  await refresh();
  expect(screen.getByRole('heading', { name: 'Original title' })).toBeTruthy();
  expect(screen.getByText('Original body')).toBeTruthy();
  expect(screen.queryByRole('heading', { name: '404' })).toBeNull();
});

describe.each(['2026-10-16T12:00:00.000Z', '2026-10-17T12:00:00.000Z'])('current/newer withdrawal at %s', (updatedAt) => {
  test.each([{ status: 'draft' }, { isDeleted: true }, { status: 'archived' }])('still applies %j', async (change) => {
    const current = article({ updatedAt: '2026-10-16T12:00:00.000Z' });
    fetchMock.mockResolvedValueOnce(json({ items: [{ ...current, ...change, updatedAt }] }));
    render(<NewsSlugDetailPage {...props(current)} />);
    await refresh();
    await expectWithdrawn();
  });
});

test('incomparable same-ID withdrawal is an explicit ambiguous read, not fabricated freshness', async () => {
  const current = article({ updatedAt: undefined });
  fetchMock.mockResolvedValueOnce(json({ items: [{ ...current, status: 'draft' }] }))
    .mockResolvedValueOnce(json({ items: [] }));
  render(<NewsSlugDetailPage {...props(current)} />);
  await refresh();
  expect(screen.getByRole('heading', { name: 'Original title' })).toBeTruthy();
  expect(screen.getByRole('status')).toBeTruthy();
  await refresh();
  await expectWithdrawn();
});

test('equal trustworthy versions still allow withdrawal without optional timestamps', async () => {
  const current = article({ updatedAt: undefined, syncVersion: '12' });
  fetchMock.mockResolvedValueOnce(json({ items: [{ ...current, status: 'draft' }] }));
  render(<NewsSlugDetailPage {...props(current)} />);
  await refresh();
  await expectWithdrawn();
});
