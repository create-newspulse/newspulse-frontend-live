import { getServerSideProps } from '../../pages/pulse-dialogue';

jest.mock('../../lib/getMessages', () => ({
  getMessages: jest.fn(async (locale: string) => ({ locale })),
}));

describe('/pulse-dialogue route props', () => {
  test.each([
    [undefined, 'en'],
    ['en', 'en'],
    ['hi', 'hi'],
    ['gu', 'gu'],
  ])('loads messages for locale %s without category data fetch', async (locale, expectedLocale) => {
    const result = await getServerSideProps({ locale } as any) as any;

    expect(result.props).toEqual({
      locale: expectedLocale,
      messages: { locale: expectedLocale },
    });
  });
});