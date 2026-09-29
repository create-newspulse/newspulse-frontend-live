import PulseDialoguePage, { getStaticProps } from '../../pages/pulse-dialogue';
import { fetchPublicNews } from '../../lib/publicNewsApi';
import { readPulse } from '../../lib/pulseDialogueDiscovery';

jest.mock('../../lib/pulseDialogueDiscovery', () => ({ ...jest.requireActual('../../lib/pulseDialogueDiscovery'), readPulse: jest.fn() }));
beforeEach(() => {
  (readPulse as jest.Mock).mockReset().mockRejectedValue(new Error('Phase 3 unavailable'));
  (fetchPublicNews as jest.Mock).mockReset();
});

jest.mock('../../lib/publicNewsApi', () => ({ fetchPublicNews: jest.fn() }));

jest.mock('../../lib/getMessages', () => ({
  getMessages: jest.fn(async (locale: string) => ({ locale })),
}));

describe('/pulse-dialogue route props', () => {
  test.each(['https://www.newspulse.co.in', ''])('preserves exact production canonicals with origin %s', async (configured) => {
    jest.replaceProperty(process, 'env', { ...process.env, VERCEL_ENV: 'production', NEXT_PUBLIC_SITE_URL: configured });
    try {
      (readPulse as jest.Mock).mockImplementation(async (_resource, lang) => ({ ok: true, lang, items: [], page: 1, limit: 12, total: 0, count: 0, totalPages: 0, hasNextPage: false }));
      for (const locale of ['en', 'hi', 'gu']) {
        const result: any = await getStaticProps({ locale } as any);
        expect(result.props.seo.canonicalUrl).toBe(`https://www.newspulse.co.in${locale === 'en' ? '' : `/${locale}`}/pulse-dialogue`);
        expect(result.props.seo.alternates).toEqual([
          { hrefLang: 'en', href: 'https://www.newspulse.co.in/pulse-dialogue' },
          { hrefLang: 'hi', href: 'https://www.newspulse.co.in/hi/pulse-dialogue' },
          { hrefLang: 'gu', href: 'https://www.newspulse.co.in/gu/pulse-dialogue' },
          { hrefLang: 'x-default', href: 'https://www.newspulse.co.in/pulse-dialogue' },
        ]);
      }
    } finally { jest.restoreAllMocks(); }
  });
  test.each(['en', 'hi', 'gu'])('uses bounded Phase 3 SSR data and fixed %s SEO', async (locale) => {
    const page = { ok: true, lang: locale, items: [], total: 0, count: 0, page: 1, limit: 12, totalPages: 0, hasNextPage: false };
    const discovery = { ok: true, lang: locale, featuredDialogue: [], featuredVoices: [], formatGroups: { columns: [], essays: [], culture: [], conversations: [] } };
    (readPulse as jest.Mock).mockImplementation(async (resource) => resource === 'articles' ? page : discovery);
    const result: any = await getStaticProps({ locale } as any);
    expect(result.props.initialPage).toEqual(page);
    expect(result.props.initialDiscovery).toEqual(discovery);
    expect(readPulse).toHaveBeenCalledTimes(2);
    expect(fetchPublicNews).not.toHaveBeenCalled();
    expect(readPulse).toHaveBeenCalledWith('articles', locale, { page: '1', limit: '12', sort: 'newest' });
    const prefix = locale === 'en' ? '' : `/${locale}`;
    expect(result.props.seo.canonicalUrl).toMatch(new RegExp(`${prefix}/pulse-dialogue$`));
    expect(result.props.seo.alternates.map((item: any) => item.hrefLang)).toEqual(['en', 'hi', 'gu', 'x-default']);
    const { isSerializableProps } = require('next/dist/lib/is-serializable-props');
    expect(isSerializableProps('/pulse-dialogue', 'getStaticProps', result.props)).toBe(true);
  });
  test.each([
    [undefined, 'en'],
    ['en', 'en'],
    ['hi', 'hi'],
    ['gu', 'gu'],
  ])('uses only Phase 3 articles and messages for locale %s', async (locale, expectedLocale) => {
    const article = {
      _id: `pulse-${expectedLocale}`, category: 'pulse-dialogue', language: expectedLocale,
      title: 'Dialogue', slug: 'dialogue', summary: 'Public contribution',
      status: 'published', publishedAt: '2026-01-01T10:00:00.000Z',
      coverImageUrl: '/story-cover.jpg',
      pulseDialogue: { bylineSnapshot: { name: 'Contributor', photoUrl: '/portrait.jpg' } },
    };
    (readPulse as jest.Mock).mockImplementation(async (resource) => {
      if (resource === 'discovery') throw new Error('Discovery unavailable');
      return { ok: true, lang: expectedLocale, items: [article], page: 1, limit: 12, total: 1, count: 1, totalPages: 1, hasNextPage: false };
    });
    const result = await getStaticProps({ locale } as any) as any;

    expect(result.props).toMatchObject({
      locale: expectedLocale,
      messages: { locale: expectedLocale },
    });
    expect(result.revalidate).toBe(60);
    expect(result.props.initialItems).toHaveLength(1);
    expect(result.props.initialItems[0].content).toBeUndefined();
    expect(result.props.initialItems[0].pulseDialogue).toEqual(article.pulseDialogue);
    expect(result.props.initialItems[0].coverImageUrl).toBe('/story-cover.jpg');
    expect(PulseDialoguePage(result.props).props.initialItems).toEqual(result.props.initialItems);
    expect(fetchPublicNews).not.toHaveBeenCalled();
    expect(readPulse).toHaveBeenCalledTimes(2);
    expect(result.props.initialErrors).toEqual({ articles: false, discovery: true });
  });
  test.each(['en', 'hi', 'gu'])('survives stale revalidation with Phase 3 offline and legacy 503 for %s', async (locale) => {
    (fetchPublicNews as jest.Mock).mockResolvedValue({ items: [], error: 'API 503 (News feed is busy. Please retry shortly.)' });
    const result: any = await getStaticProps({ locale, revalidateReason: 'stale' } as any);
    expect(result.props).toMatchObject({ initialItems: [], initialPage: null, initialDiscovery: null, initialErrors: { articles: true, discovery: true } });
    expect(readPulse).toHaveBeenCalledTimes(2);
    expect(fetchPublicNews).not.toHaveBeenCalled();
    const { isSerializableProps } = require('next/dist/lib/is-serializable-props');
    expect(isSerializableProps('/pulse-dialogue', 'getStaticProps', result.props)).toBe(true);
  });
});