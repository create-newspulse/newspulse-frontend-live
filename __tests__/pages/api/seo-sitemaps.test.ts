import fs from 'fs';
import path from 'path';

let sitemapHandler: typeof import('../../../pages/api/sitemap').default;
let newsSitemapHandler: typeof import('../../../pages/api/news-sitemap').default;

jest.mock('../../../lib/publicApiBase', () => ({
  getPublicApiBaseUrl: jest.fn(() => 'https://backend.test'),
}));

function createReq(url: string = '/sitemap.xml'): any {
  return {
    method: 'GET',
    url,
    query: {},
    headers: { host: 'www.newspulse.co.in', 'x-forwarded-proto': 'https' },
  };
}

function createRes(): any {
  return {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: '',
    setHeader(name: string, value: string) {
      this.headers[name] = value;
      return this;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(payload: string) {
      this.body = payload;
      return this;
    },
    end(payload?: string) {
      if (payload) this.body = payload;
      return this;
    },
  };
}

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status });
}

function articleFixture(overrides: Record<string, any> = {}) {
  const publishedAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  return {
  _id: 'article-1',
  status: 'published',
  language: 'en',
  title: 'Indexable story',
  summary: 'Summary',
  slug: 'indexable-story',
  category: 'national',
    publishedAt,
    updatedAt: publishedAt,
    ...overrides,
  };
}

describe('SEO sitemap routes', () => {
  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    sitemapHandler = require('../../../pages/api/sitemap').default;
    newsSitemapHandler = require('../../../pages/api/news-sitemap').default;
  });

  test('main sitemap returns valid XML and excludes admin/API/draft/deleted URLs', async () => {
    global.fetch = jest.fn(async () => jsonResponse({ items: [
      articleFixture(),
      articleFixture({ _id: 'draft-1', slug: 'draft-story', status: 'draft' }),
      articleFixture({ _id: 'deleted-1', slug: 'deleted-story', deleted: true }),
    ] }));

    const res = createRes();
    await sitemapHandler(createReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toContain('application/xml');
    expect(res.body).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(res.body).toContain('<loc>https://www.newspulse.co.in/</loc>');
    expect(res.body).toContain('<loc>https://www.newspulse.co.in/news/indexable-story</loc>');
    expect(res.body).not.toContain('/admin');
    expect(res.body).not.toContain('/api');
    expect(res.body).not.toContain('draft-story');
    expect(res.body).not.toContain('deleted-story');
  });

  test('main sitemap sends a bounded upstream fetch and reuses the warm cache', async () => {
    global.fetch = jest.fn(async () => jsonResponse({ items: [articleFixture()] }));

    const first = createRes();
    await sitemapHandler(createReq(), first);

    const second = createRes();
    await sitemapHandler(createReq(), second);

    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect((global.fetch as jest.Mock).mock.calls.map(([url]) => url)).toEqual(['en', 'hi', 'gu'].map(
      lang => `https://backend.test/api/public/news?limit=500&strictLocale=1&lang=${lang}&language=${lang}`
    ));
    expect((global.fetch as jest.Mock).mock.calls[0][1]?.signal).toBeDefined();
    expect(first.headers['Cache-Control']).toBe('public, s-maxage=300, stale-while-revalidate=600');
    expect(first.headers['Vercel-CDN-Cache-Control']).toBe('public, s-maxage=300, stale-while-revalidate=600');
    expect(second.body).toBe(first.body);
  });

  test('main sitemap falls back to static public URLs when upstream fails cold', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('timeout')) as any;

    const res = createRes();
    await sitemapHandler(createReq(), res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<loc>https://www.newspulse.co.in/</loc>');
    expect(res.body).not.toContain('/admin');
    expect(res.body).not.toContain('/api');
    expect(res.headers['Cache-Control']).toBe('public, s-maxage=60, stale-while-revalidate=60');
  });

  test('news sitemap returns valid XML and excludes old or draft content', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-02T00:00:00.000Z'));
    const recent = '2026-08-01T23:00:00.000Z';
    global.fetch = jest.fn(async () => jsonResponse({ items: [
      articleFixture({ publishedAt: recent, updatedAt: recent }),
      articleFixture({ _id: 'old-1', slug: 'old-story', title: 'Old story', publishedAt: '2026-07-01T00:00:00.000Z' }),
      articleFixture({ _id: 'draft-1', slug: 'draft-story', title: 'Draft story', status: 'draft', publishedAt: recent }),
    ] }));

    const res = createRes();
    await newsSitemapHandler(createReq('/news-sitemap.xml'), res);

    expect(res.statusCode).toBe(200);
    expect(res.headers['Content-Type']).toContain('application/xml');
    expect(res.body).toContain('xmlns:news="http://www.google.com/schemas/sitemap-news/0.9"');
    expect(res.body).toContain('<news:name>News Pulse</news:name>');
    expect(res.body).toContain('<news:language>en</news:language>');
    expect(res.body).toContain('<news:title>Indexable story</news:title>');
    expect(res.body).not.toContain('Old story');
    expect(res.body).not.toContain('Draft story');
    jest.useRealTimers();
  });

  test('robots.txt references both sitemaps and protects private routes', () => {
    const robots = fs.readFileSync(path.join(process.cwd(), 'public', 'robots.txt'), 'utf8');
    expect(robots).toContain('Sitemap: https://www.newspulse.co.in/sitemap.xml');
    expect(robots).toContain('Sitemap: https://www.newspulse.co.in/news-sitemap.xml');
    expect(robots).toContain('Disallow: /admin');
    expect(robots).toContain('Disallow: /api');
  });

  test.each(['main', 'news'])('%s sitemap uses locale-scoped canonical entries, not foreign aliases', async kind => {
    const slugs = { en: 'heritage-2026', hi: '\u0935\u093f\u0930\u093e\u0938\u0924', gu: '\u0ab5\u0abe\u0ab0\u0ab8\u0acb' };
    const publishedAt = new Date(Date.now() - 3600000).toISOString();
    global.fetch = jest.fn(async input => {
      const lang = new URL(String(input)).searchParams.get('lang') as keyof typeof slugs;
      return jsonResponse({ items: [articleFixture({
        _id: `507f1f77bcf86cd79943c00${['en', 'hi', 'gu'].indexOf(lang) + 1}`,
        language: lang, resolvedLanguage: lang, slug: slugs.gu, slugs,
        title: `Title ${lang}`, publishedAt, updatedAt: publishedAt,
        translations: { en: true, hi: true, gu: true },
      })] });
    }) as jest.Mock;
    const res = createRes();
    await (kind === 'main' ? sitemapHandler : newsSitemapHandler)(createReq(), res);
    for (const lang of ['en', 'hi', 'gu'] as const) {
      const path = `${lang === 'en' ? '' : `/${lang}`}/news/${encodeURIComponent(slugs[lang])}`;
      expect(res.body).toContain(`<loc>https://www.newspulse.co.in${path}</loc>`);
      if (kind === 'news') expect(res.body).toContain(`<news:language>${lang}</news:language>`);
    }
    expect(res.body).not.toContain('/gu/news/heritage-2026');
    expect(res.body).not.toContain(`<loc>https://www.newspulse.co.in/news/${encodeURIComponent(slugs.gu)}</loc>`);
    expect(res.body.match(/<loc>[^<]*\/news\//g)).toHaveLength(3);
    expect(res.body).not.toContain('%25E0');
    expect(res.body).toContain(publishedAt);
  });

  test('a failed locale refresh retains all entries in the warm main sitemap', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-02T00:00:00.000Z'));
    jest.spyOn(console, 'error').mockImplementation(() => {});
    global.fetch = jest.fn(async () => jsonResponse({ items: [articleFixture()] }));
    const first = createRes();
    await sitemapHandler(createReq(), first);
    jest.setSystemTime(new Date('2026-08-02T00:05:01.000Z'));
    global.fetch = jest.fn(async input => String(input).includes('lang=hi')
      ? jsonResponse({ error: 'unavailable' }, 503) : jsonResponse({ items: [] }));
    const second = createRes();
    await sitemapHandler(createReq(), second);
    expect(second.body).toBe(first.body);
    expect(console.error).toHaveBeenCalledWith('[seo] Sitemap locale unavailable', { locale: 'hi' });
    jest.restoreAllMocks();
    jest.useRealTimers();
  });
});