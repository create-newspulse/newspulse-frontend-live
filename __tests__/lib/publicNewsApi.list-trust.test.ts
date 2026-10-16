/** @jest-environment node */

import { fetchPublicNews, parsePublicNewsArticle, parsePublicNewsGroupItems } from '../../lib/publicNewsApi';
import { fetchRegionalInitialStories, fetchRegionalStoryPage } from '../../lib/regionalInitialStories';

jest.mock('../../lib/publicApiBase', () => ({ getPublicApiBaseUrl: () => 'https://backend.test' }));

const originalFetch = global.fetch;
const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();
const story = {
  _id: 'listed-article', title: 'Public headline', content: '<p>Public body</p>',
  slug: 'listed-article', language: 'en', status: 'published', category: 'regional',
  publishedAt: '2026-01-01T00:00:00Z',
};
const invalidPayloads = [
  ['unknown envelope', {}],
  ['null collection', { items: null }],
  ['ID-only record', { items: [{ _id: story._id }] }],
  ['null member', { items: [story, null] }],
  ['malformed status', { items: [{ ...story, status: { value: 'published' } }] }],
  ['malformed deletedAt', { items: [{ ...story, deletedAt: { unexpected: true } }] }],
  ['malformed flag', { items: [{ ...story, isDeleted: 'false' }] }],
  ['error-bearing record', { items: [{ ...story, error: 'synthetic-private-diagnostic' }] }],
  ['nested error', { items: [{ ...story, translations: { hi: { error: 'synthetic-private-diagnostic' } } }] }],
  ['failed envelope', { ok: false, items: [] }],
  ['failed nested envelope', { data: { success: false, items: [] } }],
  ['invalid duplicate', { items: [story, { _id: story._id, slug: story.slug }] }],
  ['malformed metadata', { items: [story], meta: 'synthetic-private-metadata' }],
  ['malformed pagination', { items: [story], pagination: ['synthetic-private-pagination'] }],
  ['malformed nested metadata', { items: [story], data: { meta: 'synthetic-private-metadata' } }],
  ['malformed secondary data', { items: [story], data: 'synthetic-private-data' }],
  ['malformed secondary collection', { items: [], data: [{ _id: story._id }] }],
  ['failed metadata', { items: [], meta: { error: 'synthetic-private-error' } }],
] as const;

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe.each(['en', 'hi', 'gu'] as const)('%s listing trust boundaries', (language) => {
  test.each(invalidPayloads)('News rejects %s before publication filtering or deduplication', async (_label, payload) => {
    const total = 'items' in payload && Array.isArray(payload.items) ? payload.items.length : 0;
    for (const mode of ['plain', 'ordinary', 'faith'] as const) {
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
        ...payload, page: 1, limit: 30, total, totalPages: total ? 1 : 0, hasMore: false,
      })));
      const result = await fetchPublicNews({
        language, category: mode === 'faith' ? 'faith-culture' : 'business', page: 1, limit: 30,
        ordinaryPagination: mode === 'ordinary', faithPagination: mode === 'faith',
      });
      expect(result.error).toBeTruthy();
      expect(result.items).toEqual([]);
      expect(JSON.stringify({ items: result.items, error: result.error })).not.toContain('synthetic-private');
    }
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  test.each(invalidPayloads)('Regional browser loaders reject %s instead of inventing exhaustion', async (_label, payload) => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify(payload)));
    const params = new URLSearchParams({ lang: language, state: 'gujarat', page: '1', limit: '30' });
    await expect(fetchRegionalInitialStories(params)).rejects.toThrow();
    await expect(fetchRegionalStoryPage(params)).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test.each([
    [], { items: [] }, { articles: [] }, { data: [] }, { result: [] },
    { data: { items: [] } }, { data: { articles: [] } }, { items: [], data: { total: 0 } },
  ])('News and Regional preserve genuine empty %j', async (payload) => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify(payload)));
    const news = await fetchPublicNews({ language, limit: 30 });
    expect(news.error).toBeUndefined();
    expect(news.items).toEqual([]);
    const regional = await fetchRegionalStoryPage(new URLSearchParams({ lang: language, limit: '30' }));
    expect(regional.stories).toEqual([]);
    expect(regional.pagination.hasMore).toBe(false);
  });

  test.each(['status', 'publishedAt', 'published flag', 'legacy id', 'failed translation metadata'])(
    'preserves standalone legacy %s without weakening locale/publication checks',
    async (variant) => {
      const record: Record<string, unknown> = { ...story, language };
      if (variant === 'publishedAt') delete record.status;
      if (variant === 'published flag') {
        delete record.status;
        delete record.publishedAt;
        record.isPublished = true;
      }
      if (variant === 'legacy id') {
        delete record._id;
        record.id = story._id;
      }
      if (variant === 'failed translation metadata') record.translationStatus = { [language]: 'failed' };
      fetchMock.mockImplementation(async () => new Response(JSON.stringify({ items: [record] })));
      const news = await fetchPublicNews({ language, limit: 30 });
      expect(news.error).toBeUndefined();
      expect(news.items).toHaveLength(1);
      expect(news.items[0].title).toBe(story.title);
      expect(news.items[0].translationGroupId).toBeUndefined();
      const regional = await fetchRegionalStoryPage(new URLSearchParams({ lang: language, limit: '30' }));
      expect(regional.stories).toHaveLength(1);
      expect(regional.stories[0].title).toBe(story.title);
    }
  );

  test('keeps legitimate geography/display fields but never arbitrary private fields', async () => {
    const record = {
      ...story, language, location: { city: 'Surat', district: 'Surat', state: 'Gujarat', token: 'synthetic-private-location' },
      districtSlug: 'surat', citySlug: 'surat', stateSlug: 'gujarat', districtName: 'Surat',
      geo: { district: 'surat', state: 'gujarat', backendUrl: 'synthetic-private-url' },
      source: { name: 'Public source', token: 'synthetic-private-source' },
      category: { slug: 'regional', name: 'Regional', diagnostics: 'synthetic-private-category' },
      token: 'synthetic-private-token', privateMetadata: { secret: 'synthetic-private-value' },
    };
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ items: [record] })));
    const result = await fetchPublicNews({ language, limit: 30 });
    expect(result.error).toBeUndefined();
    expect(result.items[0]).toMatchObject({
      location: { city: 'Surat', district: 'Surat', state: 'Gujarat' },
      districtSlug: 'surat', citySlug: 'surat', stateSlug: 'gujarat', districtName: 'Surat',
      geo: { district: 'surat', state: 'gujarat' }, category: { slug: 'regional', name: 'Regional' },
      source: { name: 'Public source' },
    });
    expect(JSON.stringify(result.items)).not.toContain('synthetic-private');
  });

  test('listing legacy translation compatibility does not broaden the Pass 3A detail/group contract', () => {
    const record = { ...story, language, translationStatus: { [language]: 'failed' } };
    expect(parsePublicNewsArticle({ article: record })).toBeNull();
    expect(parsePublicNewsGroupItems({ items: [record] })).toBeNull();
  });

  test.each(['network', 'invalid JSON', 'HTTP 503'])('%s stays a safe failure without retrying', async (failure) => {
    const readBody = jest.fn();
    if (failure === 'network') fetchMock.mockRejectedValue(new Error('synthetic-private-network'));
    else if (failure === 'invalid JSON') fetchMock.mockResolvedValue(new Response('not JSON'));
    else {
      const response = new Response(JSON.stringify({ error: 'synthetic-private-upstream' }), {
        status: 503, headers: { 'Retry-After': '45' },
      });
      response.json = readBody.mockResolvedValue({ error: 'synthetic-private-upstream' });
      fetchMock.mockResolvedValue(response);
    }
    const result = await fetchPublicNews({ language, limit: 30 });
    expect(result.error).toBeTruthy();
    expect(result.error).not.toContain('synthetic-private');
    expect(result.items).toEqual([]);
    if (failure === 'HTTP 503') {
      expect(result.status).toBe(503);
      expect(result.retryAfter).toBe('45');
      expect(readBody).not.toHaveBeenCalled();
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
