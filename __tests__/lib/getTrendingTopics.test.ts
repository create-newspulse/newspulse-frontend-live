/** @jest-environment node */
import { getTrendingTopics, mergeTrendingTopics, normalizeTrendingTopics } from '../../lib/getTrendingTopics';
import { DEFAULT_TRENDING_TOPICS, type TrendingTopic } from '../../src/config/trendingTopics';
import { jsonResponse, topicNames } from '../fixtures/editorialTopics';

const originalFetch = global.fetch;
const fetchMock = jest.fn<Promise<Response>, Parameters<typeof fetch>>();
beforeEach(() => {
  Object.defineProperty(globalThis, 'window', { configurable: true, value: {} });
  fetchMock.mockReset();
  global.fetch = fetchMock;
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  Reflect.deleteProperty(globalThis, 'window');
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

test.each(['en', 'hi', 'gu'] as const)('makes exactly one same-origin %s browser request and no polling', async (lang) => {
  const interval = jest.spyOn(global, 'setInterval');
  const editorial: TrendingTopic = {
    key: 'navratri-2026', label: topicNames[lang], href: '/topic/navratri-2026', colorKey: 'sports', source: 'editorial',
  };
  fetchMock.mockResolvedValue(jsonResponse({ items: [editorial, ...DEFAULT_TRENDING_TOPICS] }));
  expect(await getTrendingTopics(lang)).toEqual([editorial, ...DEFAULT_TRENDING_TOPICS]);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(fetchMock).toHaveBeenCalledWith(`/api/public/trending-topics?lang=${lang}`, { cache: 'no-store' });
  expect(interval).not.toHaveBeenCalled();
});

test('SSR uses the existing defaults without a server fetch', async () => {
  Reflect.deleteProperty(globalThis, 'window');
  expect(await getTrendingTopics('gu')).toBe(DEFAULT_TRENDING_TOPICS);
  expect(fetchMock).not.toHaveBeenCalled();
});

test.each([[], {}, { items: [] }, { items: [null] }].map((body) => ({ body })))('empty/malformed browser result %# preserves all nine shortcuts', async ({ body }) => {
  fetchMock.mockResolvedValue(jsonResponse(body));
  expect(await getTrendingTopics()).toEqual(DEFAULT_TRENDING_TOPICS);
});

test.each([404, 500, 503])('HTTP %s keeps the fallback strip and reports the failure', async (status) => {
  fetchMock.mockResolvedValue(jsonResponse({}, status));
  expect(await getTrendingTopics()).toBe(DEFAULT_TRENDING_TOPICS);
  expect(console.warn).toHaveBeenCalled();
});

test('a failed browser request keeps the fallback strip', async () => {
  fetchMock.mockRejectedValue(new Error('offline'));
  expect(await getTrendingTopics()).toBe(DEFAULT_TRENDING_TOPICS);
});

test('normalization preserves legacy order, key dedupe and the special badge exclusion', () => {
  const sports = DEFAULT_TRENDING_TOPICS[1];
  expect(normalizeTrendingTopics({ items: [
    { key: 'trending', label: 'Trending', href: '/trending', colorKey: 'trending' },
    sports, { ...sports, key: 'SPORTS' }, DEFAULT_TRENDING_TOPICS[0],
  ] })).toEqual([sports, DEFAULT_TRENDING_TOPICS[0]]);
});

test('editorial labels are not trimmed or translated even when their key is a known legacy key', async () => {
  const editorial = { key: 'sports', label: `  ${topicNames.gu}  `, href: '/topic/sports', colorKey: 'sports', source: 'editorial' };
  fetchMock.mockResolvedValue(jsonResponse([editorial]));
  expect((await getTrendingTopics('gu'))[0].label).toBe(editorial.label);
});

test('editorial key/href collisions win without removing intentional shared legacy hrefs', () => {
  const editorial: TrendingTopic = { key: 'sports', label: 'Editorial Sports', href: '/topic/sports', colorKey: 'sports', source: 'editorial' };
  const legacy = [...DEFAULT_TRENDING_TOPICS, { key: 'old-alias', label: 'Old', href: editorial.href, colorKey: 'markets' as const }];
  const merged = mergeTrendingTopics([editorial, editorial], legacy);
  expect(merged[0]).toEqual(editorial);
  expect(merged.filter((item) => item.key === 'sports')).toHaveLength(1);
  expect(merged.some((item) => item.key === 'old-alias')).toBe(false);
  expect(merged.filter((item) => item.href === '/business').map((item) => item.key)).toEqual(['gold-rates', 'fuel-prices', 'markets']);
});
