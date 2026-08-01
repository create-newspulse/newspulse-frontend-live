import fs from 'fs';
import path from 'path';

import sitemapHandler from '../../../pages/api/sitemap';
import newsSitemapHandler from '../../../pages/api/news-sitemap';

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

function jsonResponse(payload: any, status = 200) {
  return { ok: status >= 200 && status < 300, status, json: async () => payload };
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
    jest.clearAllMocks();
  });

  test('main sitemap returns valid XML and excludes admin/API/draft/deleted URLs', async () => {
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ items: [
      articleFixture(),
      articleFixture({ _id: 'draft-1', slug: 'draft-story', status: 'draft' }),
      articleFixture({ _id: 'deleted-1', slug: 'deleted-story', deleted: true }),
    ] })) as any;

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

  test('news sitemap returns valid XML and excludes old or draft content', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-08-02T00:00:00.000Z'));
    const recent = '2026-08-01T23:00:00.000Z';
    global.fetch = jest.fn().mockResolvedValue(jsonResponse({ items: [
      articleFixture({ publishedAt: recent, updatedAt: recent }),
      articleFixture({ _id: 'old-1', slug: 'old-story', title: 'Old story', publishedAt: '2026-07-01T00:00:00.000Z' }),
      articleFixture({ _id: 'draft-1', slug: 'draft-story', title: 'Draft story', status: 'draft', publishedAt: recent }),
    ] })) as any;

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
});