import fs from 'fs';
import path from 'path';
import type { NextApiRequest } from 'next';
import contracts from '../../fixtures/articleUrlContracts.json';

jest.mock('../../../lib/publicApiBase', () => ({
  getPublicApiBaseUrl: jest.fn(() => 'https://backend.test'),
}));

const site = 'https://www.newspulse.co.in';
const ns = 'http://www.sitemaps.org/schemas/sitemap/0.9';
const xhtml = 'http://www.w3.org/1999/xhtml';
const newsNs = 'http://www.google.com/schemas/sitemap-news/0.9';
const locales = ['en', 'hi', 'gu'] as const;
type Locale = typeof locales[number];
type Row = Record<string, unknown>;
type Page = { items: Row[]; page: number; totalPages: number; total: number; limit: number };
type Kind = 'main' | 'news';
let handlers: Record<Kind, typeof import('../../../pages/api/sitemap').default>;
const originalFetch = global.fetch;

function article(slug: string, overrides: Row = {}): Row {
  return { _id: slug, slug, language: 'en', title: slug, status: 'published', publishedAt: new Date(Date.now() - 3600000).toISOString(), ...overrides };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status });
}

function feed(rows: Partial<Record<Locale, Row[]>>, respond?: (page: Page, lang: Locale) => Response | Promise<Response>) {
  const mock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input));
    const lang = url.searchParams.get('lang') as Locale;
    expect(url.origin + url.pathname).toBe('https://backend.test/api/public/news');
    expect(url.searchParams.get('language')).toBe(lang);
    expect(url.searchParams.get('strictLocale')).toBe('1');
    expect(url.searchParams.has('category')).toBe(false);
    expect(init?.signal).toBeDefined();
    const page = Number(url.searchParams.get('page') || 1);
    const limit = Math.min(Number(url.searchParams.get('limit')), 100);
    const all = rows[lang] || [];
    const value = { items: all.slice((page - 1) * limit, page * limit), page, limit, total: all.length, totalPages: Math.max(1, Math.ceil(all.length / limit)) };
    return respond ? respond(value, lang) : json(value);
  });
  global.fetch = mock;
  return mock;
}

async function request(kind: Kind = 'main') {
  const req: Pick<NextApiRequest, 'method' | 'headers'> = { method: 'GET', headers: { host: 'www.newspulse.co.in', 'x-forwarded-proto': 'https' } };
  const res = {
    statusCode: 200, headers: {} as Record<string, string>, body: '',
    setHeader(name: string, value: string) { this.headers[name] = value; },
    status(status: number) { this.statusCode = status; return this; },
    send(body: string) { this.body = body; }, end(body: string) { this.body = body; },
  };
  await handlers[kind](req as NextApiRequest, res as unknown as Parameters<typeof handlers.main>[1]);
  return res;
}

function urls(res: Awaited<ReturnType<typeof request>>) {
  expect(res.statusCode).toBe(200);
  expect(res.headers['Content-Type']).toContain('application/xml');
  const doc = new DOMParser().parseFromString(res.body, 'application/xml');
  expect(doc.getElementsByTagName('parsererror')).toHaveLength(0);
  expect(doc.documentElement.namespaceURI).toBe(ns);
  const entries = Array.from(doc.getElementsByTagNameNS(ns, 'url'));
  const byLoc = new Map(entries.map(el => [el.getElementsByTagNameNS(ns, 'loc')[0].textContent!, el]));
  expect(byLoc.size).toBe(entries.length);
  return byLoc;
}

function languages(el: Element) {
  return Object.fromEntries(Array.from(el.getElementsByTagNameNS(xhtml, 'link'), link => {
    expect(link.getAttribute('rel')).toBe('alternate');
    return [link.getAttribute('hreflang'), link.getAttribute('href')];
  }));
}

function unavailable(res: Awaited<ReturnType<typeof request>>) {
  expect(res.statusCode).toBe(503);
  expect(res.headers['Retry-After']).toBe('60');
  for (const header of ['Cache-Control', 'CDN-Cache-Control', 'Vercel-CDN-Cache-Control']) expect(res.headers[header]).toBe('no-store');
  expect(res.body).not.toMatch(/<urlset|<loc>|backend\.test/);
}

beforeEach(() => {
  jest.resetModules();
  jest.spyOn(console, 'error').mockImplementation(() => {});
  handlers = { main: require('../../../pages/api/sitemap').default, news: require('../../../pages/api/news-sitemap').default };
});
afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test.each<Kind>(['main', 'news'])('%s XML uses only actual, indexable locale editions and canonical URLs', async kind => {
  const rows: Partial<Record<Locale, Row[]>> = {};
  const hrefs: Record<string, string> = {};
  const titles: Record<string, string> = {};
  const recent = new Date(Date.now() - 3600000).toISOString();
  for (const lang of locales) {
    const native = contracts.deployed.editions[lang];
    hrefs[lang] = site + native.canonicalDetailUrl;
    titles[lang] = native.title + ' <A&B>';
    rows[lang] = [
      { ...native, _id: `107f1f77bcf86cd79943c00${locales.indexOf(lang)}`, slug: 'mirror', slugs: {}, canonicalSlug: 'mirror', localizedSlug: 'mirror', isTranslated: true },
      { ...native, title: titles[lang] + '\u0001', publishedAt: recent, updatedAt: recent },
    ];
  }
  const blocked = [{ status: 'draft' }, { status: 'unpublished' }, { deleted: true }, { isPrivate: true },
    { visibility: 'restricted' }, { visibility: 'private' }, { published: false }, { seo: { robots: 'noindex,follow' } },
    { private: true }, { isPublic: false }, { locked: true }, { workflow: { locked: true } },
    { workflow: { embargoUntil: '2099-01-01' } }, { publishAt: '2099-01-01' }, { scheduledAt: '2099-01-01' },
    { publishedAt: new Date(Date.now() + 86400000).toISOString() }];
  rows.en!.push(...blocked.map((flags, i) => article(`excluded-${i}`, flags)),
    article('old', { publishedAt: '2020-01-01' }),
    article('english-only', { translations: { hi: true }, slugs: { hi: 'unpublished-alias' } }));
  const idOnly = '207f1f77bcf86cd79943c003';
  rows.hi!.push({ ...contracts.deployed.cached[0], _id: idOnly, language: 'hi', lang: 'hi', resolvedLanguage: 'hi', resolvedLang: 'hi', publishedAt: recent });
  feed(rows);
  const res = await request(kind);
  const entries = urls(res);
  const idUrl = `${site}/hi/news/${idOnly}`;
  expect(entries.has(idUrl)).toBe(true);
  expect(res.body).not.toMatch(/\/admin|\/api\/|excluded-|unpublished-alias|\/mirror|%25E0|\/s\//);
  expect(entries.has(`${site}/news/old`)).toBe(kind === 'main');
  for (const lang of locales) {
    const el = entries.get(hrefs[lang])!;
    expect(el).toBeDefined();
    if (kind === 'main') {
      expect(languages(el)).toEqual({ ...hrefs, 'x-default': hrefs.en });
      expect(el.getElementsByTagNameNS(ns, 'lastmod')[0].textContent).toBe(recent);
    } else {
      expect(el.getElementsByTagNameNS(newsNs, 'language')[0].textContent).toBe(lang);
      expect(el.getElementsByTagNameNS(newsNs, 'title')[0].textContent).toBe(titles[lang]);
      expect(el.getElementsByTagNameNS(newsNs, 'publication_date')[0].textContent).toBe(recent);
    }
  }
  if (kind === 'main') {
    const own = `${site}/news/english-only`;
    expect(languages(entries.get(own)!)).toEqual({ en: own, 'x-default': own });
    expect(languages(entries.get(idUrl)!)).toEqual({ hi: idUrl, 'x-default': idUrl });
    for (const lang of locales) for (const category of ['national', 'tech-gadgets', 'faith-culture', 'pulse-dialogue']) {
      expect(entries.has(`${site}${lang === 'en' ? '' : '/' + lang}/${category}`)).toBe(true);
    }
  }
});

test('paginates past the upstream cap; concurrent cold callers share one scan without exhausting the two rebuild slots', async () => {
  const rows = Array.from({ length: 103 }, (_, i) => article(`story-${i}`, { category: i > 99 ? 'new-category' : 'sports' }));
  let active = 0;
  const fetcher = feed({ en: rows }, async page => {
    const busy = ++active > 2;
    await Promise.resolve();
    active--;
    return busy ? json({ code: 'NEWS_BUSY' }, 503) : json(page);
  });
  const [first, concurrent] = await Promise.all([request(), request()]);
  const entries = urls(first);
  expect(rows.every(item => entries.has(`${site}/news/${item.slug}`))).toBe(true);
  const calls = fetcher.mock.calls.length;
  expect(calls).toBeGreaterThan(3);
  expect(concurrent.body).toBe(first.body);
  expect((await request()).body).toBe(first.body);
  expect(fetcher).toHaveBeenCalledTimes(calls);
  expect(first.headers['Vercel-CDN-Cache-Control']).toBe('public, s-maxage=300, stale-while-revalidate=600');
});

test.each<Kind>(['main', 'news'])('%s never serves a partial 200 on an upstream failure and recovers after a cold miss', async kind => {
  feed({ en: [article('valid')] }, (page, lang) => lang === 'hi' ? json({ code: 'NEWS_BUSY' }, 503) : json(page));
  unavailable(await request(kind));
  expect(console.error).toHaveBeenCalledWith('[seo] Sitemap locale unavailable', { locale: 'hi', page: 1, reason: 'upstream-http', status: 503 });
  feed({});
  expect([...urls(await request(kind)).keys()].filter(loc => loc.includes('/news/'))).toEqual([]);
});

test('honors a short busy retry once, without changing the requested locale or page', async () => {
  let attempts = 0;
  feed({ en: [article('retried')] }, (page, lang) => {
    if (lang !== 'en' || ++attempts > 1) return json(page);
    return new Response(null, { status: 503, headers: { 'Retry-After': '0' } });
  });
  expect(urls(await request()).has(`${site}/news/retried`)).toBe(true);
  expect(attempts).toBe(2);
});

test('distinct edition IDs can share a translation key; a conflicting identity cannot create a cross-story alternate', async () => {
  const en = article('first', { translationGroupId: 'group', translationKey: 'family' });
  const hi = article('second', { language: 'hi', translationKey: 'family' });
  feed({ en: [en], hi: [hi] });
  const entries = urls(await request());
  expect(languages(entries.get(`${site}/news/first`)!)).toEqual({
    en: `${site}/news/first`, hi: `${site}/hi/news/second`, 'x-default': `${site}/news/first`,
  });
  feed({ en: [en], hi: [{ ...hi, translationGroupId: 'different' }] });
  unavailable(await request('news'));
});

const badPages: [string, (page: Page) => Response][] = [
  ['authorization failure', () => json({}, 403)],
  ['partial HTTP response', page => json(page, 206)],
  ['error-shaped success', page => json({ ...page, ok: false })],
  ['explicitly partial feed', page => json({ ...page, complete: false })],
  ['truncated JSON', () => new Response('{"items":[')],
  ['missing totals', page => json({ items: page.items })],
  ['contradictory metadata', page => json({ ...page, hasMore: true })],
  ['conflicting totals', page => json({ ...page, total: 45, meta: { total: page.total } })],
  ['short final page', page => json({ ...page, items: [] })],
  ['changing total', page => json({ ...page, items: [], total: 40, totalPages: 1 })],
  ['repeated first page', page => json({ ...page, page: 1 })],
  ['duplicate across pages', page => json({ ...page, items: [article('story-0')] })],
  ['invalid item', page => json({ ...page, items: [null] })],
  ['unexpected resolved locale', page => json({ ...page, items: [article('wrong', { resolvedLanguage: 'gu' })] })],
  ['fallback edition', page => json({ ...page, items: [article('wrong', { isFallback: true })] })],
];
test.each(badPages)('rejects a whole inventory on a later %s', async (_label, invalid) => {
  feed({ en: Array.from({ length: 41 }, (_, i) => article(`story-${i}`)) }, (page, lang) => lang === 'en' && page.page === 2 ? invalid(page) : json(page));
  unavailable(await request());
  expect(console.error).toHaveBeenCalledWith('[seo] Sitemap locale unavailable', expect.objectContaining({ locale: 'en', page: 2 }));
});

test('a stalled response body is aborted within the read budget', async () => {
  jest.useFakeTimers();
  const hanging = new Response('{}');
  jest.spyOn(hanging, 'json').mockImplementation(() => new Promise(() => {}));
  const calls = feed({}, () => hanging);
  const pending = request('news');
  await jest.advanceTimersByTimeAsync(8000);
  unavailable(await pending);
  expect(calls.mock.calls.every(([, init]) => init?.signal?.aborted)).toBe(true);
  expect(console.error).toHaveBeenCalledWith('[seo] Sitemap locale unavailable', expect.objectContaining({ reason: 'timeout' }));
});

test('failed refresh retains only the last complete XML without extending its lifetime; publication and withdrawal appear on recovery', async () => {
  const now = Date.now();
  const clock = jest.spyOn(Date, 'now').mockReturnValue(now);
  const nextStory = article('new-beat', { category: 'future-desk' });
  feed({ en: [article('withdrawn'), { ...nextStory, status: 'draft' }] });
  const good = await request();
  expect(urls(good).has(`${site}/news/withdrawn`)).toBe(true);
  expect(good.body).not.toContain('new-beat');

  clock.mockReturnValue(now + 301000);
  const failure = feed({}, (page, lang) => lang === 'gu' ? json({}, 503) : json(page));
  const stale = await request();
  expect(stale.body).toBe(good.body);
  expect(stale.headers['Vercel-CDN-Cache-Control']).toBe('no-store');
  const count = failure.mock.calls.length;
  await request();
  expect(failure).toHaveBeenCalledTimes(count);
  clock.mockReturnValue(now + 901000);
  unavailable(await request());

  feed({ en: [nextStory, article('withdrawn', { visibility: 'restricted' })] });
  const refreshed = urls(await request());
  expect(refreshed.has(`${site}/news/new-beat`)).toBe(true);
  expect(refreshed.has(`${site}/news/withdrawn`)).toBe(false);
});

test('robots.txt advertises the existing XML routes and disallows private paths', () => {
  const robots = fs.readFileSync(path.join(process.cwd(), 'public', 'robots.txt'), 'utf8');
  for (const route of ['sitemap.xml', 'news-sitemap.xml']) expect(robots).toContain(`Sitemap: ${site}/${route}`);
  for (const route of ['/admin', '/api']) expect(robots).toContain(`Disallow: ${route}`);
});
