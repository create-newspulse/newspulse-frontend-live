import newsHandler from '../../../pages/api/public/news';
import newsByIdHandler from '../../../pages/api/public/news/[id]/index';
import newsBySlugHandler from '../../../pages/api/public/news/slug/[slug]';

jest.mock('../../../lib/publicApiBase', () => ({
  getPublicApiBaseUrl: jest.fn(() => 'https://backend.test'),
}));

type MockReq = {
  method: string;
  url: string;
  query: Record<string, any>;
  headers: Record<string, string>;
};

type MockRes = {
  statusCode: number;
  headers: Record<string, string>;
  body: any;
  setHeader: (name: string, value: string) => MockRes;
  status: (code: number) => MockRes;
  json: (payload: any) => MockRes;
  end: () => MockRes;
  send: (payload: any) => MockRes;
};

function createReq(input: Partial<MockReq>): MockReq {
  return {
    method: 'GET',
    url: '/',
    query: {},
    headers: {},
    ...input,
  };
}

function createRes(): MockRes {
  return {
    statusCode: 200,
    headers: {},
    body: undefined,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
    end() {
      return this;
    },
    send(payload: any) {
      this.body = payload;
      return this;
    },
  };
}

function jsonResponse(payload: any, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
  };
}

describe('public news route localization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('strict locale list resolution widens non-category feeds and picks the locale variant', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(jsonResponse({
        items: [
          {
            _id: 'article-en',
            translationGroupId: 'group-1',
            language: 'en',
            status: 'published',
            title: 'English title',
            slug: 'english-title',
          },
        ],
      }))
      .mockResolvedValueOnce(jsonResponse({
        items: [
          {
            _id: 'article-en',
            translationGroupId: 'group-1',
            language: 'en',
            status: 'published',
            title: 'English title',
            slug: 'english-title',
          },
          {
            _id: 'article-hi',
            translationGroupId: 'group-1',
            language: 'hi',
            status: 'published',
            title: 'हिंदी शीर्षक',
            slug: 'hindi-title',
          },
        ],
      }));

    global.fetch = fetchMock as any;

    const req = createReq({
      url: '/api/public/news?lang=hi&language=hi&strictLocale=1&limit=40',
      query: { lang: 'hi', language: 'hi', strictLocale: '1', limit: '40' },
    });
    const res = createRes();

    await newsHandler(req as any, res as any);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/public/news?lang=hi&language=hi&strictLocale=1&limit=40');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/api/public/news?strictLocale=1&limit=120');
    expect(String(fetchMock.mock.calls[1][0])).not.toContain('lang=hi');
    expect(res.statusCode).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]._id).toBe('article-hi');
  });

  test('id detail route promotes a visible locale variant from the translation group', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(jsonResponse({
        article: {
          _id: 'article-gu',
          translationGroupId: 'group-1',
          language: 'gu',
          status: 'published',
          title: 'ગુજરાતી શીર્ષક',
          slug: 'gujarati-title',
        },
      }))
      .mockResolvedValueOnce(jsonResponse({
        items: [
          {
            _id: 'article-gu',
            translationGroupId: 'group-1',
            language: 'gu',
            status: 'published',
            title: 'ગુજરાતી શીર્ષક',
            slug: 'gujarati-title',
          },
          {
            _id: 'article-en',
            translationGroupId: 'group-1',
            language: 'en',
            status: 'published',
            title: 'English title',
            slug: 'english-title',
          },
        ],
      }));

    global.fetch = fetchMock as any;

    const req = createReq({
      url: '/api/public/news/article-gu?lang=en&language=en',
      query: { id: 'article-gu', lang: 'en', language: 'en' },
    });
    const res = createRes();

    await newsByIdHandler(req as any, res as any);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('/api/public/news/group/group-1?lang=en&language=en');
    expect(res.statusCode).toBe(200);
    expect(res.body.article._id).toBe('article-en');
  });

  test('slug fallback list lookup uses strict locale resolution and a valid query string', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(jsonResponse({ article: null }))
      .mockResolvedValueOnce(jsonResponse({
        items: [
          {
            _id: 'article-hi',
            translationGroupId: 'group-1',
            language: 'hi',
            status: 'published',
            title: 'हिंदी शीर्षक',
            slug: 'hindi-title',
          },
        ],
      }))
      .mockResolvedValueOnce(jsonResponse({
        article: {
          _id: 'article-hi',
          translationGroupId: 'group-1',
          language: 'hi',
          status: 'published',
          title: 'हिंदी शीर्षक',
          slug: 'hindi-title',
        },
      }));

    global.fetch = fetchMock as any;

    const req = createReq({
      url: '/api/public/news/slug/hindi-title?lang=hi&language=hi&limit=20',
      query: { slug: 'hindi-title', lang: 'hi', language: 'hi', limit: '20' },
    });
    const res = createRes();

    await newsBySlugHandler(req as any, res as any);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[1][0])).toContain('/api/public/news?lang=hi&language=hi&limit=200&strictLocale=1');
    expect(String(fetchMock.mock.calls[1][0])).not.toContain('??');
    expect(res.statusCode).toBe(200);
    expect(res.body.article._id).toBe('article-hi');
  });
});