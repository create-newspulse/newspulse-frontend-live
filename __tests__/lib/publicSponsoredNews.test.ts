import {
  fetchSponsoredNewsPage, parseSponsoredNewsPage, parseSponsoredPageNumber, sponsoredContentPath,
  SponsoredNewsReadError, SPONSORED_NEWS_INVALID_RESPONSE, SPONSORED_NEWS_TIMEOUT_MS,
  SPONSORED_NEWS_UNAVAILABLE, validateSponsoredNewsRequest,
} from '../../lib/publicSponsoredNews';
import { getPublicApiBaseUrl } from '../../lib/publicApiBase';
import { sponsoredArticleFixture, sponsoredNewsFixture } from '../fixtures/sponsoredNews';

jest.mock('../../lib/publicApiBase', () => ({ getPublicApiBaseUrl: jest.fn(() => '') }));

const originalFetch = global.fetch;
const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
  jest.mocked(getPublicApiBaseUrl).mockReturnValue('');
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.useRealTimers();
});

test.each(['gu', 'hi', 'en'] as const)('%s reader requests exactly one same-origin sponsored page', async (lang) => {
  const payload = sponsoredNewsFixture(lang, 2);
  fetchMock.mockResolvedValue(new Response(JSON.stringify(payload)));
  const result = await fetchSponsoredNewsPage(lang, 2);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe(`/api/public/news?sponsoredOnly=true&lang=${lang}&page=2&limit=12`);
  expect(options).toMatchObject({ method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' } });
  expect(result).toMatchObject({ page: 2, limit: 12, total: 25, totalPages: 3 });
  expect(result.items.map((item) => item._id)).toEqual(payload.items.map((item) => item._id));
  expect(result).not.toHaveProperty('hasMore');
});

test('preserves all three logical-story pages, category identity, backend order and a short last page', () => {
  const pages = [1, 2, 3].map((page) => parseSponsoredNewsPage(sponsoredNewsFixture('gu', page), 'gu', page));
  expect(pages.map((page) => page.items.length)).toEqual([12, 12, 1]);
  expect(pages.map((page) => page.total)).toEqual([25, 25, 25]);
  const items = pages.flatMap((page) => page.items);
  expect(new Set(items.map((item) => item.translationGroupId)).size).toBe(25);
  expect(items.map((item) => item.category)).toEqual(Array.from({ length: 25 }, (_, index) => ['business', 'tech', 'lifestyle'][index % 3]));
  const reversed = sponsoredNewsFixture('en', 1, 3);
  reversed.items.reverse();
  expect(parseSponsoredNewsPage(reversed, 'en', 1).items.map((item) => item._id)).toEqual(reversed.items.map((item) => item._id));
});

test.each([
  { isSponsoredArticle: true, isSponsored: false },
  { isSponsoredArticle: false, isSponsored: true },
  { isSponsoredArticle: true, isSponsored: true },
])('accepts the exact backend OR identity %j independently of campaign state', (identity) => {
  for (const campaignStatus of ['expired', 'paused', 'draft', 'scheduled', 'archived']) {
    const payload = { ...sponsoredNewsFixture('en', 1, 1), items: [sponsoredArticleFixture(1, 'en', { ...identity, campaignStatus })] };
    expect(parseSponsoredNewsPage(payload, 'en', 1).items).toHaveLength(1);
  }
});

test.each([
  { isSponsoredArticle: false, isSponsored: false },
  { isSponsoredArticle: 'true', isSponsored: 'true' },
  { isSponsoredArticle: 1, isSponsored: 1 },
  { isSponsoredArticle: false, tags: ['sponsored'], keywords: ['sponsored'], contentType: 'sponsored-article' },
  { isSponsoredArticle: false, isSponsoredFeature: true, campaignStatus: 'active' },
])('rejects unauthorized sponsorship rather than filtering a page: %j', (overrides) => {
  const payload = sponsoredNewsFixture('en', 1, 2);
  payload.items[1] = sponsoredArticleFixture(2, 'en', overrides);
  expect(() => parseSponsoredNewsPage(payload, 'en', 1)).toThrow('ordinary article');
});

test.each([
  { status: 'draft' }, { status: 'unpublished' }, { status: 'scheduled' }, { status: 'withdrawn' },
  { status: 'archived' }, { status: 'deleted' }, { status: 'private' }, { visibility: 'private' },
  { isPrivate: true }, { private: true }, { isPublic: false },
  { deleted: true }, { isDeleted: true }, { archived: true }, { isArchived: true },
  { deletedAt: '2025-01-02T00:00:00Z' }, { isPublished: false }, { published: false },
  { publishedAt: '2999-01-01T00:00:00Z' },
])('rejects the entire page for a nonpublic article: %j', (overrides) => {
  const payload = { ...sponsoredNewsFixture('en', 1, 1), items: [sponsoredArticleFixture(1, 'en', overrides)] };
  expect(() => parseSponsoredNewsPage(payload, 'en', 1)).toThrow(SponsoredNewsReadError);
});

test.each([
  { language: 'gu' }, { language: undefined }, { language: 'fr' },
  { resolvedLang: 'hi' }, { isFallback: true }, { title: '' },
  { slug: undefined }, { slug: '' }, { category: undefined },
])('rejects missing identity/content and foreign locale fallbacks: %j', (overrides) => {
  const payload = { ...sponsoredNewsFixture('en', 1, 1), items: [sponsoredArticleFixture(1, 'en', overrides)] };
  expect(() => parseSponsoredNewsPage(payload, 'en', 1)).toThrow(SponsoredNewsReadError);
});

test.each(['_id', 'slug', 'translationGroupId', 'translationKey'] as const)('rejects duplicate %s without rewriting totals', (key) => {
  const payload = sponsoredNewsFixture('en', 1, 2);
  payload.items[1][key] = payload.items[0][key];
  expect(() => parseSponsoredNewsPage(payload, 'en', 1)).toThrow('duplicate logical story');
});

test.each([
  { page: undefined }, { limit: undefined }, { total: undefined }, { totalPages: undefined },
  { page: 2 }, { page: 0 }, { limit: 24 }, { total: -1 }, { totalPages: 2 },
  { total: '12' }, { totalPages: 1.5 }, { items: [] }, { items: 'invalid' }, { ok: false },
  { items: [null] }, { error: 'upstream failure' },
])('rejects malformed contracts and inconsistent page counts: %j', (overrides) => {
  expect(() => parseSponsoredNewsPage({ ...sponsoredNewsFixture('en', 1, 12), ...overrides }, 'en', 1)).toThrow(SponsoredNewsReadError);
});

test('accepts a genuine empty page, including the supported zero/one-page empty convention', () => {
  const empty = sponsoredNewsFixture('en', 1, 0);
  expect(parseSponsoredNewsPage(empty, 'en', 1)).toEqual(empty);
  expect(parseSponsoredNewsPage({ ...empty, totalPages: 1 }, 'en', 1).totalPages).toBe(1);
});

test('keeps the existing public DTO projection and never returns private account/payment fields', () => {
  const payload = { ...sponsoredNewsFixture('en', 1, 1), items: [sponsoredArticleFixture(1, 'en', {
    advertiserAccount: 'private-account', payment: { secret: 'private-payment' }, revenue: 999,
    metadata: { sponsorName: 'Public partner', accountToken: 'private-token' },
  })] };
  const result = parseSponsoredNewsPage(payload, 'en', 1);
  expect(JSON.stringify(result)).not.toMatch(/private-account|private-payment|private-token|revenue/);
  expect(result.items[0]).toMatchObject({ sponsorName: 'Example Sponsor 1', sponsorDisclosure: 'Public sponsor disclosure' });
});

test.each([0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1])('rejects invalid requested page %s before fetching', async (page) => {
  await expect(fetchSponsoredNewsPage('en', page)).rejects.toThrow('Invalid sponsored news');
  expect(fetchMock).not.toHaveBeenCalled();
});

test.each(['0', '-1', '1.5', '1e2', '01', '', '9007199254740992', ['1', '2']])('rejects invalid route page %j', (page) => {
  expect(parseSponsoredPageNumber(page)).toBeNull();
});

test.each(['gu', 'hi', 'en'] as const)('%s paths keep English unprefixed and preserve page navigation', (lang) => {
  const prefix = lang === 'en' ? '' : `/${lang}`;
  expect(sponsoredContentPath(lang)).toBe(`${prefix}/sponsored-content`);
  expect(sponsoredContentPath(lang, 2)).toBe(`${prefix}/sponsored-content?page=2`);
  expect(validateSponsoredNewsRequest({ sponsoredOnly: 'true', lang, page: '2', limit: '12' })).toEqual({ lang, page: 2 });
});

test.each([
  { sponsoredOnly: '1' }, { sponsoredOnly: ['true', 'false'] }, { lang: 'fr' }, { lang: ['gu'] },
  { page: undefined }, { limit: '24' }, { category: 'business' }, { spotlight: '1' }, { q: 'sponsored' },
  { language: 'en' }, { strictLocale: '1' },
])('rejects unsupported/mixed sponsored query parameters: %j', (overrides) => {
  expect(() => validateSponsoredNewsRequest({ sponsoredOnly: 'true', lang: 'en', page: '1', limit: '12', ...overrides })).toThrow();
});

test.each([
  [503, '{"error":"unavailable"}', SPONSORED_NEWS_UNAVAILABLE],
  [503, 'not json', SPONSORED_NEWS_UNAVAILABLE],
  [503, `{"error":"${SPONSORED_NEWS_INVALID_RESPONSE}"}`, SPONSORED_NEWS_INVALID_RESPONSE],
  [200, 'not json', SPONSORED_NEWS_INVALID_RESPONSE],
  [200, '{}', SPONSORED_NEWS_INVALID_RESPONSE],
])('HTTP %s / %s remains a typed failure', async (status, body, code) => {
  fetchMock.mockResolvedValue(new Response(String(body), { status: Number(status), headers: { 'Retry-After': '60' } }));
  await expect(fetchSponsoredNewsPage('en', 1)).rejects.toMatchObject({ code });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});

test.each(['headers', 'body'])('bounds stalled %s reads and aborts the request', async (stage) => {
  jest.useFakeTimers();
  let signal: AbortSignal | undefined;
  fetchMock.mockImplementation((_url: string, options: RequestInit) => {
    signal = options.signal ?? undefined;
    if (stage === 'headers') return new Promise(() => {});
    return Promise.resolve({ ok: true, status: 200, headers: new Headers(), text: () => new Promise(() => {}) });
  });
  const read = fetchSponsoredNewsPage('en', 1);
  const assertion = expect(read).rejects.toThrow('timed out');
  await jest.advanceTimersByTimeAsync(SPONSORED_NEWS_TIMEOUT_MS);
  await assertion;
  expect(signal?.aborted).toBe(true);
  expect(jest.getTimerCount()).toBe(0);
});

test('parent cancellation aborts an outstanding read without retrying', async () => {
  fetchMock.mockImplementation(() => new Promise(() => {}));
  const controller = new AbortController();
  const read = fetchSponsoredNewsPage('gu', 1, controller.signal);
  controller.abort();
  await expect(read).rejects.toThrow('cancelled');
  expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
