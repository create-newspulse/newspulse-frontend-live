/** @jest-environment node */
import type { GetStaticProps } from 'next';
import { getCategoryStaticProps } from '../../lib/categoryPageProps';
import { getPublicApiBaseUrl } from '../../lib/publicApiBase';
import { getStaticProps as getNationalProps } from '../../pages/national';
import { getStaticProps as getGujaratProps } from '../../pages/regional/gujarat';
import { getStaticProps as getFaithProps } from '../../pages/faith-culture';
import { getStaticProps as getScienceProps } from '../../pages/science-technology';
import { getStaticProps as getGadgetsProps } from '../../pages/tech-gadgets';

jest.mock('../../lib/publicApiBase', () => ({ getPublicApiBaseUrl: jest.fn(() => 'http://backend.test') }));
jest.mock('../../lib/getMessages', () => ({ getMessages: async (locale: string) => ({ locale }) }));

type Surface = {
  name: string;
  load: GetStaticProps<Record<string, unknown>>;
  category: string;
  itemsKey: string;
  localeKey: string;
  limit: number;
  timeoutMs: number;
  paginated: boolean;
};
const surfaces = [
  {
    name: 'ordinary Business', load: (ctx) => getCategoryStaticProps(ctx, 'business'),
    category: 'business', itemsKey: 'initialItems', localeKey: 'locale', limit: 30, timeoutMs: 4000, paginated: true,
  },
  {
    name: 'shared non-paginated Editorial', load: (ctx) => getCategoryStaticProps(ctx, 'editorial'),
    category: 'editorial', itemsKey: 'initialItems', localeKey: 'locale', limit: 30, timeoutMs: 4000, paginated: false,
  },
  {
    name: 'National', load: getNationalProps,
    category: 'national', itemsKey: 'data', localeKey: 'lang', limit: 20, timeoutMs: 8000, paginated: true,
  },
  {
    name: 'Regional Gujarat', load: getGujaratProps,
    category: 'regional', itemsKey: 'initialStories', localeKey: 'initialLocale', limit: 30, timeoutMs: 4000, paginated: true,
  },
  {
    name: 'Faith & Culture', load: getFaithProps,
    category: 'faith-culture', itemsKey: 'initialItems', localeKey: 'locale', limit: 30, timeoutMs: 4000, paginated: true,
  },
] satisfies Surface[];
const locales = ['en', 'hi', 'gu'] as const;
const reasons = ['stale', 'on-demand'] as const;
const originalFetch = global.fetch;
const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>();

function page(limit: number, items: unknown[] = []) {
  return { items, page: 1, limit, total: items.length, totalPages: items.length ? 1 : 0, hasMore: false };
}
function jsonResponse(payload: unknown) {
  return new Response(JSON.stringify(payload));
}
function story(category: string, language: string) {
  return {
    _id: 'public-story', title: 'Public story', slug: 'public-story', content: '<p>Public body</p>',
    category, language, status: 'published', publishedAt: '2026-01-01T10:00:00Z',
    ...(category === 'regional' ? { state: 'gujarat' } : {}),
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock;
  jest.mocked(getPublicApiBaseUrl).mockReturnValue('http://backend.test');
});
afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

describe.each(surfaces)('$name regeneration', (surface) => {
  describe.each(locales)('%s', (locale) => {
    describe.each(reasons)('%s', (revalidateReason) => {
      test('a genuine authoritative empty remains successful empty props', async () => {
        fetchMock.mockImplementation(async () => jsonResponse(page(surface.limit)));
        const result = await surface.load({ locale, revalidateReason });
        expect(result).toMatchObject({
          props: { [surface.itemsKey]: [], [surface.localeKey]: locale }, revalidate: 60,
        });
        if (surface.paginated) expect(result).toMatchObject({
          props: { initialPagination: { page: 1, limit: surface.limit, hasMore: false } },
        });
      });

      test('valid content and the existing locale/query/page-size contracts remain intact', async () => {
        fetchMock.mockImplementation(async () => jsonResponse(page(surface.limit, [story(surface.category, locale)])));
        const result = await surface.load({ locale, revalidateReason });
        expect(result).toMatchObject({
          props: { [surface.itemsKey]: [{ _id: 'public-story' }], [surface.localeKey]: locale }, revalidate: 60,
        });
        const url = new URL(String(fetchMock.mock.calls[0][0]));
        expect(url.searchParams.get('lang')).toBe(locale);
        expect(url.searchParams.get('language')).toBe(surface.category === 'regional' ? null : locale);
        expect(url.searchParams.get('limit')).toBe(String(surface.limit));
        if (surface.paginated) expect(url.searchParams.get('page')).toBe('1');
        if (surface.category === 'regional') expect(url.searchParams.get('state')).toBe('gujarat');
        else expect(url.searchParams.get('category')).toBe(surface.category);
      });

      test.each(['network', '503', 'invalid JSON', 'missing collection', 'invalid record', 'failed envelope'])(
        '%s rejects generation instead of returning empty replacement props',
        async (failure) => {
          fetchMock.mockImplementation(async () => {
            if (failure === 'network') throw new Error('Backend offline');
            if (failure === '503') return new Response('Unavailable', { status: 503 });
            if (failure === 'invalid JSON') return new Response('{');
            if (failure === 'missing collection') return jsonResponse({});
            if (failure === 'invalid record') return jsonResponse(page(surface.limit, [{ _id: 'incomplete' }]));
            return jsonResponse({ ...page(surface.limit), ok: false });
          });
          await expect(surface.load({ locale, revalidateReason })).rejects.toThrow();
        },
      );

      if (surface.paginated) test('malformed pagination is failure, not a successful exhausted page', async () => {
        fetchMock.mockImplementation(async () => jsonResponse({ ...page(surface.limit), page: 2 }));
        await expect(surface.load({ locale, revalidateReason })).rejects.toThrow();
      });

      test('missing backend configuration fails without making an outbound request', async () => {
        jest.mocked(getPublicApiBaseUrl).mockReturnValue('');
        await expect(surface.load({ locale, revalidateReason })).rejects.toThrow();
        expect(fetchMock).not.toHaveBeenCalled();
      });

      test.each(['headers', 'body'])('stalled %s fails at the unchanged deadline even if fetch ignores abort', async (stage) => {
        jest.useFakeTimers();
        fetchMock.mockImplementation(() => {
          if (stage === 'headers') return new Promise<Response>(() => {});
          const response = jsonResponse({});
          jest.spyOn(response, 'json').mockReturnValue(new Promise<unknown>(() => {}));
          jest.spyOn(response, 'text').mockReturnValue(new Promise<string>(() => {}));
          return Promise.resolve(response);
        });
        let completed = false;
        const pending = Promise.resolve(surface.load({ locale, revalidateReason })).then(
          () => { completed = true; return null; },
          (error: unknown) => { completed = true; return error; },
        );
        await jest.advanceTimersByTimeAsync(surface.timeoutMs - 1);
        expect(completed).toBe(false);
        const signal = fetchMock.mock.calls[0]?.[1]?.signal;
        expect(signal?.aborted).toBe(false);
        await jest.advanceTimersByTimeAsync(1);
        const error = await pending;
        expect(error).toBeInstanceOf(Error);
        expect(error).toHaveProperty('message', expect.stringMatching(/timed out/i));
        expect(completed).toBe(true);
        expect(signal?.aborted).toBe(true);
        expect(jest.getTimerCount()).toBe(0);
      });
    });

    test('the existing initial-build fallback policy is unchanged, including strict Faith failures', async () => {
      fetchMock.mockRejectedValue(new Error('Backend offline'));
      const pending = surface.load({ locale, revalidateReason: 'build' });
      if (surface.category === 'faith-culture') await expect(pending).rejects.toThrow();
      else expect(await pending).toMatchObject({ props: { [surface.itemsKey]: [] }, revalidate: 60 });
    });
  });
});

describe.each(locales)('%s preserved source contracts', (locale) => {
  test.each([
    ['science-technology', 'tech', getScienceProps],
    ['tech-gadgets', 'tech-gadgets', getGadgetsProps],
  ] as const)('/%s keeps its distinct stored category %s', async (_route, category, load) => {
    const wrongCategory = category === 'tech' ? 'tech-gadgets' : 'tech';
    fetchMock.mockImplementation(async () => jsonResponse(page(30, [
      story(category, locale), { ...story(wrongCategory, locale), _id: 'other-category' },
    ])));
    const result = await load({ locale, revalidateReason: 'on-demand' });
    expect(result).toMatchObject({ props: { initialItems: [{ _id: 'public-story', category }] } });
    if (!('props' in result)) throw new Error('Expected category props');
    expect((await result.props).initialItems).toHaveLength(1);
    expect(new URL(String(fetchMock.mock.calls[0][0])).searchParams.get('category')).toBe(category);
  });

  test.each(reasons)('Gujarat %s still accepts its valid News fallback after primary failure', async (revalidateReason) => {
    fetchMock.mockImplementation(async (input) => String(input).includes('/api/public/regional?')
      ? new Response('Unavailable', { status: 503 })
      : jsonResponse(page(30, [story('regional', locale)])));
    const result = await getGujaratProps({ locale, revalidateReason });
    expect(result).toMatchObject({ props: { initialStories: [{ _id: 'public-story' }], initialLocale: locale }, revalidate: 60 });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const fallback = new URL(String(fetchMock.mock.calls[1][0]));
    expect(fallback.searchParams.get('category')).toBe('regional');
    expect(fallback.searchParams.get('lang')).toBe(locale);
    expect(fallback.searchParams.get('language')).toBe(locale);
  });

  test.each(reasons)('National %s keeps valid articles when optional ticker sources fail', async (revalidateReason) => {
    fetchMock.mockImplementation(async (input) => {
      const url = new URL(String(input));
      return url.pathname === '/api/public/news' && url.searchParams.get('page') === '1'
        ? jsonResponse(page(20, [story('national', locale)]))
        : new Response('Unavailable', { status: 503 });
    });
    const result = await getNationalProps({ locale, revalidateReason });
    expect(result).toMatchObject({ props: { data: [{ _id: 'public-story' }], breaking: [], lang: locale }, revalidate: 60 });
  });

  test('National still allows its existing no-backend initial build fallback', async () => {
    jest.mocked(getPublicApiBaseUrl).mockReturnValue('');
    expect(await getNationalProps({ locale, revalidateReason: 'build' }))
      .toMatchObject({ props: { data: [], breaking: [], lang: locale }, revalidate: 60 });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
