import PulseDialoguePage, { getStaticProps } from '../../pages/pulse-dialogue';
import { fetchPublicNews } from '../../lib/publicNewsApi';

jest.mock('../../lib/publicNewsApi', () => ({ fetchPublicNews: jest.fn() }));

jest.mock('../../lib/getMessages', () => ({
  getMessages: jest.fn(async (locale: string) => ({ locale })),
}));

describe('/pulse-dialogue route props', () => {
  test.each([
    [undefined, 'en'],
    ['en', 'en'],
    ['hi', 'hi'],
    ['gu', 'gu'],
  ])('loads initial public stories and messages for locale %s', async (locale, expectedLocale) => {
    const article = {
      _id: `pulse-${expectedLocale}`, category: 'pulse-dialogue', language: expectedLocale,
      title: 'Dialogue', slug: 'dialogue', summary: 'Public contribution',
      status: 'published', publishedAt: '2026-01-01T10:00:00.000Z',
      content: '<p>Article body</p>', coverImageUrl: '/story-cover.jpg',
      pulseDialogue: { bylineSnapshot: { name: 'Contributor', photoUrl: '/portrait.jpg' } },
    };
    (fetchPublicNews as jest.Mock).mockResolvedValueOnce({ items: [article], meta: {}, endpoint: '/api/public/news' });
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
    expect(fetchPublicNews).toHaveBeenLastCalledWith(expect.objectContaining({
      category: 'pulse-dialogue', language: expectedLocale, limit: 30, extraQuery: { strictLocale: '1' },
    }));
  });
});