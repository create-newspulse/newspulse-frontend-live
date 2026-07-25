import { getStaticProps } from '../../pages/index';
import { fetchPublicNews } from '../../lib/publicNewsApi';

jest.mock('../../lib/publicNewsApi', () => ({
  fetchPublicNews: jest.fn(),
}));

jest.mock('../../lib/getMessages', () => ({
  getMessages: jest.fn(async (locale: string) => ({ locale })),
}));

jest.mock('../../lib/publicSponsoredFeatureSource', () => ({
  normalizeSponsoredFeatureLang: jest.fn((locale: string) => (locale === 'hi' ? 'hi' : locale === 'gu' ? 'gu' : 'en')),
  resolvePublicHomepageSponsoredFeature: jest.fn(async () => ({ feature: null })),
}));

function publicArticle(language: 'en' | 'hi' | 'gu') {
  const byLanguage = {
    en: {
      _id: 'article-en',
      title: 'English article',
      summary: 'English summary',
      content: '<p>English content</p>',
      slug: 'english-article',
    },
    hi: {
      _id: 'article-hi',
      title: 'हिंदी लेख',
      summary: 'हिंदी सारांश',
      content: '<p>हिंदी सामग्री</p>',
      slug: 'hindi-article',
    },
    gu: {
      _id: 'article-gu',
      title: 'ગુજરાતી લેખ',
      summary: 'ગુજરાતી સારાંશ',
      content: '<p>ગુજરાતી સામગ્રી</p>',
      slug: 'gujarati-article',
    },
  }[language];

  return {
    ...byLanguage,
    language,
    status: 'published',
    publishedAt: '2026-01-01T10:00:00.000Z',
    translationGroupId: 'homepage-language-group',
  };
}

describe('homepage article language requests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.each([
    ['/', undefined, 'en', 'article-en'],
    ['/hi', 'hi', 'hi', 'article-hi'],
    ['/gu', 'gu', 'gu', 'article-gu'],
  ])('%s requests and renders %s article records', async (_route, locale, expectedLanguage, expectedId) => {
    (fetchPublicNews as jest.Mock).mockResolvedValueOnce({
      items: [publicArticle(expectedLanguage as 'en' | 'hi' | 'gu')],
      meta: {},
      endpoint: '/api/public/news',
    });

    const result = await getStaticProps({ locale } as any) as any;

    expect(fetchPublicNews).toHaveBeenCalledWith(expect.objectContaining({
      language: expectedLanguage,
    }));
    expect(fetchPublicNews).not.toHaveBeenCalledWith(expect.objectContaining({ language: 'gj' }));
    expect(fetchPublicNews).not.toHaveBeenCalledWith(expect.objectContaining({ language: 'Gujarati' }));
    expect(fetchPublicNews).not.toHaveBeenCalledWith(expect.objectContaining({ language: 'gu-IN' }));
    expect(result.props.initialTopStory._id).toBe(expectedId);
    expect(result.props.initialFreshStories[0].lang).toBe(expectedLanguage);
  });
});
