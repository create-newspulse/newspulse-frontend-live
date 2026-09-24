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

function pulseStory(locale = 'en', overrides: Record<string, any> = {}) {
  return {
    _id: `pulse-${locale}`,
    translationGroupId: 'pulse-group',
    category: 'pulse-dialogue',
    language: locale,
    status: 'published',
    title: 'Pulse conversation',
    slug: `pulse-${locale}`,
    publishedAt: '2025-01-01T00:00:00.000Z',
    coverImage: { url: 'https://images.test/cover.jpg' },
    pulseDialogue: {
      contributorId: 'contributor-1',
      bylineSnapshot: { name: 'Contributor', photo: { url: 'https://images.test/snapshot.jpg', alt: 'Portrait' } },
      contributor: { id: 'contributor-1', name: 'Contributor', photo: { url: 'https://images.test/portrait.jpg', alt: 'Portrait' } },
    },
    ...overrides,
  };
}

describe('public news route localization', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test.each(['en', 'hi', 'gu'])('strict Pulse %s returns a complete localized page with one upstream request', async (locale) => {
    const story = pulseStory(locale);
    const payload = { items: [story], total: 1, page: 1, limit: 30, totalPages: 1 };
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(payload));
    global.fetch = fetchMock as any;
    const query = { category: 'pulse-dialogue', lang: locale, language: locale, strictLocale: '1', limit: '30' };
    const res = createRes();

    await newsHandler(createReq({ query, url: `/api/public/news?${new URLSearchParams(query)}` }) as any, res as any);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual(payload);
    expect(res.headers['Cache-Control']).toBe('no-store, max-age=0');
  });

  test.each(['en', 'hi', 'gu'])('strict Pulse %s still widens empty responses without cross-locale or unpublished leakage', async (locale) => {
    const story = pulseStory(locale);
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(jsonResponse({ items: [], total: 1, page: 1, limit: 30 }))
      .mockResolvedValueOnce(jsonResponse({
        items: [
          ...['en', 'hi', 'gu'].map((language) => pulseStory(language)),
          pulseStory(locale, { _id: 'draft', translationGroupId: 'draft', status: 'draft' }),
          pulseStory(locale, { _id: 'deleted', translationGroupId: 'deleted', deletedAt: '2025-01-01' }),
          pulseStory(locale, { _id: 'future', translationGroupId: 'future', publishedAt: '2999-01-01' }),
        ],
        total: 900,
      }));
    global.fetch = fetchMock as any;
    const query = { category: 'pulse-dialogue', lang: locale, language: locale, strictLocale: '1', limit: '30' };
    const res = createRes();

    await newsHandler(createReq({ query, url: `/api/public/news?${new URLSearchParams(query)}` }) as any, res as any);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const widenedUrl = new URL(String(fetchMock.mock.calls[1][0]));
    expect(widenedUrl.searchParams.get('limit')).toBe('90');
    expect(widenedUrl.searchParams.has('lang')).toBe(false);
    expect(widenedUrl.searchParams.has('language')).toBe(false);
    expect(widenedUrl.searchParams.get('strictLocale')).toBe('1');
    expect(res.body.items).toEqual([story]);
    expect(res.body.total).toBe(1);
  });

  test.each([
    ['partial page', { items: [pulseStory()], total: 2 }],
    ['unknown total on a short page', { items: [pulseStory()] }],
    ['zero total', { items: [pulseStory()], total: 0 }],
    ['wrong locale', { items: [pulseStory('gu')], total: 1 }],
    ['draft', { items: [pulseStory('en', { status: 'draft' })], total: 1 }],
    ['deleted', { items: [pulseStory('en', { deletedAt: '2025-01-01' })], total: 1 }],
    ['scheduled', { items: [pulseStory('en', { publishedAt: '2999-01-01' })], total: 1 }],
    ['missing title', { items: [pulseStory('en', { title: '' })], total: 1 }],
    ['missing language', { items: [pulseStory('en', { language: '' })], total: 1 }],
    ['missing id', { items: [pulseStory('en', { _id: '' })], total: 1 }],
    ['wrong category', { items: [pulseStory('en', { category: 'national' })], total: 1 }],
    ['duplicate group', { items: [pulseStory(), pulseStory('en', { _id: 'duplicate' })], total: 1 }],
    ['wrong response page', { items: [pulseStory()], total: 1, page: 2 }],
  ])('strict Pulse retains widening for %s', async (_label, payload) => {
    const fetchMock = jest.fn().mockResolvedValueOnce(jsonResponse(payload))
      .mockResolvedValueOnce(jsonResponse({ items: [pulseStory()] }));
    global.fetch = fetchMock as any;
    const query = { category: 'pulse-dialogue', lang: 'en', language: 'en', strictLocale: '1', limit: '30' };
    const res = createRes();

    await newsHandler(createReq({ query, url: `/api/public/news?${new URLSearchParams(query)}` }) as any, res as any);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.statusCode).toBe(200);
  });

  test.each(['national', 'regional', 'international', 'business', 'sports'])('keeps existing %s category widening', async (category) => {
    const story = pulseStory('en', { category });
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ items: [story], total: 1, page: 1, limit: 30 }));
    global.fetch = fetchMock as any;
    const query = { category, lang: 'en', language: 'en', strictLocale: '1', limit: '30' };
    const res = createRes();

    await newsHandler(createReq({ query, url: `/api/public/news?${new URLSearchParams(query)}` }) as any, res as any);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.body.items).toEqual([story]);
  });

  test.each<Record<string, string>>([
    { strictLocale: '0' },
    { language: 'hi' },
    { limit: '0' },
    { limit: 'invalid' },
    { page: '0' },
  ])('retains widening for non-strict or ambiguous Pulse requests: %j', async (overrides) => {
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ items: [pulseStory()], total: 1 }));
    global.fetch = fetchMock as any;
    const query = { category: 'pulse-dialogue', lang: 'en', language: 'en', strictLocale: '1', limit: '30', ...overrides };
    const res = createRes();

    await newsHandler(createReq({ query, url: `/api/public/news?${new URLSearchParams(query)}` }) as any, res as any);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  test('a full Pulse page needs no total and preserves lead order despite a newer updatedAt on the older story', async () => {
    const stories = [
      pulseStory('en', { _id: 'new', translationGroupId: 'new', publishedAt: '2025-02-01', updatedAt: '2025-02-01' }),
      pulseStory('en', { _id: 'old', translationGroupId: 'old', publishedAt: '2025-01-01', updatedAt: '2025-03-01' }),
    ];
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse({ items: stories }));
    global.fetch = fetchMock as any;
    const query = { category: 'pulse-dialogue', lang: 'en', strictLocale: '1', limit: '2' };
    const res = createRes();

    await newsHandler(createReq({ query, url: `/api/public/news?${new URLSearchParams(query)}` }) as any, res as any);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.body.items).toEqual(stories);
  });

  test('a complete final Pulse page skips widening using the page offset', async () => {
    const payload = { items: [pulseStory()], total: 3, page: 2, limit: 2, totalPages: 2 };
    const fetchMock = jest.fn().mockResolvedValue(jsonResponse(payload));
    global.fetch = fetchMock as any;
    const query = { category: 'pulse-dialogue', lang: 'en', strictLocale: '1', limit: '2', page: '2' };
    const res = createRes();

    await newsHandler(createReq({ query, url: `/api/public/news?${new URLSearchParams(query)}` }) as any, res as any);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.body).toEqual(payload);
  });

  test('returns after the first upstream resolves without starting a never-resolving widened request', async () => {
    let resolvePrimary!: (response: ReturnType<typeof jsonResponse>) => void;
    const primary = new Promise<ReturnType<typeof jsonResponse>>((resolve) => { resolvePrimary = resolve; });
    const fetchMock = jest.fn().mockReturnValueOnce(primary).mockImplementation(() => new Promise(() => {}));
    global.fetch = fetchMock as any;
    const query = { category: 'pulse-dialogue', lang: 'en', strictLocale: '1', limit: '30' };
    const res = createRes();
    const pending = newsHandler(createReq({ query, url: `/api/public/news?${new URLSearchParams(query)}` }) as any, res as any);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.body).toBeUndefined();
    resolvePrimary(jsonResponse({ items: [pulseStory()], total: 1, page: 1, limit: 30 }));
    await pending;

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.body.items).toEqual([pulseStory()]);
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

  test('Gujarati non-category feed requests gu and prioritizes the Gujarati translation group record', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(jsonResponse({
        items: [
          {
            _id: 'article-en',
            translationGroupId: 'group-gujarati-home',
            language: 'en',
            status: 'published',
            title: 'English headline',
            summary: 'English summary',
            content: '<p>English body</p>',
            slug: 'english-headline',
          },
        ],
      }))
      .mockResolvedValueOnce(jsonResponse({
        items: [
          {
            _id: 'article-en',
            translationGroupId: 'group-gujarati-home',
            language: 'en',
            status: 'published',
            title: 'English headline',
            summary: 'English summary',
            content: '<p>English body</p>',
            slug: 'english-headline',
          },
          {
            _id: 'article-gu',
            translationGroupId: 'group-gujarati-home',
            language: 'gu',
            status: 'published',
            title: 'ગુજરાતી શીર્ષક',
            summary: 'ગુજરાતી સારાંશ',
            content: '<p>ગુજરાતી બોડી</p>',
            slug: 'gujarati-headline',
          },
        ],
      }));

    global.fetch = fetchMock as any;

    const req = createReq({
      url: '/api/public/news?lang=gu&language=gu&limit=40',
      query: { lang: 'gu', language: 'gu', limit: '40' },
    });
    const res = createRes();

    await newsHandler(req as any, res as any);

    expect(String(fetchMock.mock.calls[0][0])).toContain('lang=gu');
    expect(String(fetchMock.mock.calls[0][0])).toContain('language=gu');
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('gj');
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('Gujarati');
    expect(String(fetchMock.mock.calls[0][0])).not.toContain('gu-IN');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(res.statusCode).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toEqual(expect.objectContaining({
      _id: 'article-gu',
      title: 'ગુજરાતી શીર્ષક',
      summary: 'ગુજરાતી સારાંશ',
      content: '<p>ગુજરાતી બોડી</p>',
    }));
  });

  test('Gujarati feed preserves English fallback only when no Gujarati group record exists', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(jsonResponse({
        items: [
          {
            _id: 'article-en',
            translationGroupId: 'group-fallback-home',
            language: 'en',
            status: 'published',
            title: 'English fallback headline',
            summary: 'English fallback summary',
            content: '<p>English fallback body</p>',
            slug: 'english-fallback-headline',
          },
        ],
      }))
      .mockResolvedValueOnce(jsonResponse({
        items: [
          {
            _id: 'article-en',
            translationGroupId: 'group-fallback-home',
            language: 'en',
            status: 'published',
            title: 'English fallback headline',
            summary: 'English fallback summary',
            content: '<p>English fallback body</p>',
            slug: 'english-fallback-headline',
          },
        ],
      }));

    global.fetch = fetchMock as any;

    const req = createReq({
      url: '/api/public/news?lang=gu&language=gu&limit=40',
      query: { lang: 'gu', language: 'gu', limit: '40' },
    });
    const res = createRes();

    await newsHandler(req as any, res as any);

    expect(res.statusCode).toBe(200);
    expect(res.body.items).toHaveLength(1);
    expect(res.body.items[0]).toEqual(expect.objectContaining({
      _id: 'article-en',
      title: 'English fallback headline',
      summary: 'English fallback summary',
      content: '<p>English fallback body</p>',
    }));
  });

  test('Gujarati slug detail promotes an English slug hit to the Gujarati translation group record', async () => {
    const fetchMock = jest.fn()
      .mockResolvedValueOnce(jsonResponse({
        article: {
          _id: 'article-en',
          translationGroupId: 'group-detail-gujarati',
          language: 'en',
          status: 'published',
          title: 'Why Responsible Digital Journalism Matters More Than Ever',
          summary: 'English article summary',
          content: '<p>English article body</p>',
          slug: 'why-responsible-digital-journalism-matters-more-than-ever',
        },
      }))
      .mockResolvedValueOnce(jsonResponse({
        items: [
          {
            _id: 'article-en',
            translationGroupId: 'group-detail-gujarati',
            language: 'en',
            status: 'published',
            title: 'Why Responsible Digital Journalism Matters More Than Ever',
            summary: 'English article summary',
            content: '<p>English article body</p>',
            slug: 'why-responsible-digital-journalism-matters-more-than-ever',
          },
          {
            _id: 'article-gu',
            translationGroupId: 'group-detail-gujarati',
            language: 'gu',
            status: 'published',
            title: 'જવાબદાર ડિજિટલ પત્રકારિતા શા માટે જરૂરી છે',
            summary: 'ગુજરાતી લેખનો સારાંશ',
            content: '<p>ગુજરાતી લેખની સંપૂર્ણ સામગ્રી</p>',
            slug: 'javabdar-digital-patrakarita',
          },
        ],
      }));

    global.fetch = fetchMock as any;

    const req = createReq({
      url: '/api/public/news/slug/why-responsible-digital-journalism-matters-more-than-ever?lang=gu&language=gu',
      query: {
        slug: 'why-responsible-digital-journalism-matters-more-than-ever',
        lang: 'gu',
        language: 'gu',
      },
    });
    const res = createRes();

    await newsBySlugHandler(req as any, res as any);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/api/public/news/slug/why-responsible-digital-journalism-matters-more-than-ever?lang=gu&language=gu');
    expect(String(fetchMock.mock.calls[1][0])).toContain('/api/public/news/group/group-detail-gujarati?lang=gu&language=gu');
    expect(res.statusCode).toBe(200);
    expect(res.body.article).toEqual(expect.objectContaining({
      _id: 'article-gu',
      title: 'જવાબદાર ડિજિટલ પત્રકારિતા શા માટે જરૂરી છે',
      summary: 'ગુજરાતી લેખનો સારાંશ',
      content: '<p>ગુજરાતી લેખની સંપૂર્ણ સામગ્રી</p>',
      slug: 'javabdar-digital-patrakarita',
    }));
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