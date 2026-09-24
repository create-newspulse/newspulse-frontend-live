import { getCategoryStaticProps } from '../../lib/categoryPageProps';
import { CATEGORY_FEED_TIMEOUT_MS } from '../../lib/categoryFeed';
import { fetchPublicNews } from '../../lib/publicNewsApi';

jest.mock('../../lib/getMessages', () => ({ getMessages: jest.fn(async (locale: string) => ({ locale })) }));
jest.mock('../../lib/publicNewsApi', () => ({ fetchPublicNews: jest.fn() }));
jest.mock('../../lib/publicApiBase', () => ({ getPublicApiBaseUrl: () => 'https://backend.test' }));

const categories = [
  'international', 'business', 'science-technology', 'tech-gadgets', 'sports', 'lifestyle',
  'faith-culture', 'glamour', 'editorial', 'pulse-dialogue', 'web-stories',
];

function story(category: string, language: string, overrides: Record<string, unknown> = {}) {
  return {
    _id: 'lead', title: `${language} lead`, slug: 'lead', summary: 'Public summary', category, language,
    status: 'published', publishedAt: '2026-01-02T10:00:00.000Z', content: '<p>Full body</p>',
    ...overrides,
  };
}

describe('shared category initial props', () => {
  const originalFetch = global.fetch;
  beforeEach(() => { (fetchPublicNews as jest.Mock).mockReset(); });
  afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });

  describe.each(categories)('/%s', (category) => {
    test.each(['en', 'hi', 'gu'])('seeds only eligible %s stories in publication order using one request', async (locale) => {
      (fetchPublicNews as jest.Mock).mockResolvedValueOnce({
        items: [
          story(category, locale, { _id: 'edited-old', publishedAt: '2026-01-01T10:00:00.000Z', updatedAt: '2026-09-25T10:00:00.000Z' }),
          story(category, locale),
          story(category, locale, { _id: 'draft', status: 'draft' }),
          story(category, locale, { _id: 'future', publishedAt: '2099-01-01T10:00:00.000Z' }),
          story(category, locale === 'en' ? 'gu' : 'en', { _id: 'wrong-language' }),
          story('national', locale, { _id: 'wrong-category' }),
        ], meta: {}, endpoint: '/api/public/news',
      });
      const route = require(`../../pages/${category}`);
      expect(route.getServerSideProps).toBeUndefined();
      const result = await route.getStaticProps({ locale, revalidateReason: 'build' });

      expect(result.revalidate).toBe(60);
      expect(result.props.locale).toBe(locale);
      expect(result.props.initialItems.map((item: any) => item._id)).toEqual(['lead', 'edited-old']);
      expect(result.props.initialItems[0].content).toBeUndefined();
      expect(route.default(result.props).props.initialItems).toBe(result.props.initialItems);
      expect(fetchPublicNews).toHaveBeenCalledTimes(1);
      expect(fetchPublicNews).toHaveBeenCalledWith(expect.objectContaining({
        category, language: locale, limit: 30, extraQuery: { strictLocale: '1' },
      }));
    });
  });

  test.each(['headers', 'body'])('a stalled upstream %s returns safe build props at the deadline', async (stage) => {
    jest.useFakeTimers();
    (fetchPublicNews as jest.Mock).mockImplementationOnce(jest.requireActual('../../lib/publicNewsApi').fetchPublicNews);
    let signal: AbortSignal | undefined;
    const json = jest.fn(() => new Promise(() => {}));
    global.fetch = jest.fn((_url: string, init: RequestInit) => {
      signal = init.signal as AbortSignal;
      return stage === 'headers' ? new Promise(() => {}) : Promise.resolve({ ok: true, status: 200, json });
    }) as any;
    let completed = false;
    const pending = getCategoryStaticProps({ locale: 'gu', revalidateReason: 'build' }, 'pulse-dialogue').then((result) => {
      completed = true;
      return result;
    });
    await jest.advanceTimersByTimeAsync(CATEGORY_FEED_TIMEOUT_MS - 1);
    expect(completed).toBe(false);
    expect(signal?.aborted).toBe(false);
    if (stage === 'body') expect(json).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(1);
    expect(completed).toBe(true);
    expect(signal?.aborted).toBe(true);
    expect(await pending).toEqual({ props: { locale: 'gu', messages: { locale: 'gu' }, initialItems: [] }, revalidate: 60 });
    expect(jest.getTimerCount()).toBe(0);
  });

  test('a failed background regeneration rejects so Next retains the previous ISR page', async () => {
    (fetchPublicNews as jest.Mock).mockResolvedValueOnce({ items: [], meta: {}, error: 'Backend unavailable' });
    await expect(getCategoryStaticProps({ locale: 'hi', revalidateReason: 'stale' }, 'business')).rejects.toThrow('Backend unavailable');
  });

  test('failed initial generation returns empty retryable props instead of failing the build', async () => {
    (fetchPublicNews as jest.Mock).mockRejectedValueOnce(new Error('Backend unavailable'));
    expect(await getCategoryStaticProps({ locale: 'en', revalidateReason: 'build' }, 'business')).toEqual({
      props: { locale: 'en', messages: { locale: 'en' }, initialItems: [] }, revalidate: 60,
    });
  });
});