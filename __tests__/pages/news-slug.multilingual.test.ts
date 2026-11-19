import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from 'next';
import { IncomingMessage, ServerResponse } from 'http';
import { Socket } from 'net';
import { getServerSideProps } from '../../pages/news/[slug]';
import { getServerSideProps as legacyProps } from '../../pages/news/[...parts]';
import slugProxy from '../../pages/api/public/news/slug/[slug]';
import idProxy from '../../pages/api/public/news/[id]/index';
import { fetchArticleAlternates } from '../../lib/articleSeo.server';
import { resolveArticleSlug } from '../../lib/articleSlugs';
import { parsePublicNewsArticle } from '../../lib/publicNewsApi';
import { buildArticleSeoMetadata, getArticleAlternates, NEWS_PULSE_SITE_URL, type SeoAlternate } from '../../lib/seo';
import contracts from '../fixtures/articleUrlContracts.json';

jest.mock('../../lib/publicApiBase', () => ({ getPublicApiBaseUrl: () => 'https://backend.test' }));
jest.mock('../../hooks/useArticleAnalytics', () => ({ useArticleAnalytics: jest.fn() }));
jest.mock('../../lib/publicDataRefresh', () => ({ subscribePublicDataRefresh: () => jest.fn() }));

const locales = ['en', 'hi', 'gu'] as const;
function context(slug: string, locale: string): GetServerSidePropsContext {
  const req = Object.assign(new IncomingMessage(new Socket()), {
    headers: { host: 'www.newspulse.co.in', 'x-forwarded-proto': 'https' }, cookies: {},
  });
  return {
    locale, params: { slug }, query: {}, resolvedUrl: `/news/${slug}`,
    req, res: new ServerResponse(req),
  };
}

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

beforeEach(() => {
  jest.spyOn(global, 'fetch');
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

// DTOs captured with public GETs against 97eb540 and its isolated slug candidate;
// the Backend fixture blocked databases, external services and persistent writes.
describe.each(['deployed', 'candidate'] as const)('%s Backend compatibility', version => {
  const fixture = contracts[version];

  test.each(locales)('%s keeps authoritative route metadata through both detail proxies', async lang => {
    const record = fixture.editions[lang];
    for (const [handler, key, value] of [[slugProxy, 'slug', record.slug], [idProxy, 'id', record._id]] as const) {
      jest.mocked(global.fetch).mockReset().mockResolvedValue(response(record));
      const req: NextApiRequest = Object.assign(new IncomingMessage(new Socket()), {
        method: 'GET', query: { [key]: value, lang, language: lang }, headers: {},
        url: `/api/public/news/${encodeURIComponent(value)}?lang=${lang}&language=${lang}`,
        cookies: {}, body: null, env: {},
      });
      const unused = () => { throw new Error('Unexpected API response method'); };
      const res: NextApiResponse & { body: unknown } = Object.assign(new ServerResponse(req), {
        statusCode: 200, body: null as unknown,
        status(code: number) { res.statusCode = code; return res; },
        json(body: unknown) { res.body = body; },
        send: unused, redirect: unused, setDraftMode: unused, setPreviewData: unused,
        clearPreviewData: unused, revalidate: async () => unused(),
      });
      await handler(req, res);
      expect(res.statusCode).toBe(200);
      const article = parsePublicNewsArticle(res.body);
      expect(article).toMatchObject({
        _id: record._id, slug: record.slug, canonicalSlug: record.canonicalSlug,
        translationGroupId: record.translationGroupId, publishedAt: record.publishedAt,
        translations: { en: true, hi: true, gu: true },
      });
      expect(global.fetch).toHaveBeenCalledTimes(1);
    }
  });

  test.each(locales)('%s SSR has the same reciprocal hreflang, localized metadata and canonical URL', async lang => {
    const record = fixture.editions[lang];
    jest.mocked(global.fetch).mockImplementation(async input => {
      const url = new URL(String(input));
      if (url.pathname === '/api/public/news') return response({ items: [] });
      const requested = url.searchParams.get('lang') as typeof lang;
      return response({ article: fixture.editions[requested] });
    });

    const result = await getServerSideProps(context(record.canonicalSlug, lang));
    if (!('props' in result)) throw new Error('Expected canonical SSR props');
    const props = await result.props;
    if (!props.seo) throw new Error('Expected article SEO');
    const expected: SeoAlternate[] = locales.map(locale => ({
      hrefLang: locale,
      href: `${NEWS_PULSE_SITE_URL}${locale === 'en' ? '' : `/${locale}`}/news/${encodeURIComponent(fixture.editions[locale].canonicalSlug)}`,
    }));
    expected.push({ hrefLang: 'x-default', href: expected[0].href });
    expect(props.seo.alternates).toEqual(expected);
    expect(props.seo.canonicalUrl).toBe(expected.find(link => link.hrefLang === lang)?.href);
    const metadata = buildArticleSeoMetadata(props.article, lang, NEWS_PULSE_SITE_URL);
    expect(metadata).toMatchObject({
      ogTitle: record.title, ogDescription: record.summary, ogUrl: props.seo.canonicalUrl,
      ogImage: `${NEWS_PULSE_SITE_URL}/brand/news-pulse-social.jpg`,
      ogImageType: 'image/jpeg', ogImageWidth: 1200, ogImageHeight: 630, ogImageAlt: record.title, ogLocale: `${lang}_IN`,
      publishedAt: record.publishedAt,
    });
    expect(console.error).not.toHaveBeenCalled();
  });

  test.each(['en', 'hi'] as const)('switching a Gujarati published alias to %s resolves its native edition', async lang => {
    const record = fixture.editions[lang];
    jest.mocked(global.fetch).mockImplementation(async input =>
      new URL(String(input)).pathname === '/api/public/news' ? response({ items: [] }) : response(record));
    const destination = `${lang === 'en' ? '' : `/${lang}`}/news/${encodeURIComponent(record.canonicalSlug)}`;
    expect(await getServerSideProps(context(fixture.editions.gu.slug, lang)))
      .toEqual({ redirect: { destination, permanent: true } });
  });

  test.each(['foreign', 'cached'] as const)('%s legacy alias redirects once to a stable ID without rewriting stored identity', async kind => {
    const [alias, byId] = fixture[kind];
    const before = JSON.stringify(fixture[kind]);
    jest.mocked(global.fetch).mockImplementation(async input => {
      const url = new URL(String(input));
      if (url.pathname === '/api/public/news') return response({ items: [] });
      if (url.searchParams.get('lang') !== 'en') return response({}, 404);
      return response({ article: url.pathname.includes('/slug/') ? alias : byId });
    });
    const destination = `/news/${byId._id}`;
    expect(await getServerSideProps(context(alias.slug, 'en'))).toEqual({ redirect: { destination, permanent: true } });
    const result = await getServerSideProps(context(byId._id, 'en'));
    if (!('props' in result)) throw new Error('ID fallback must not redirect back to the alias');
    const props = await result.props;
    if (!props.seo) throw new Error('Expected article SEO');
    expect(props.article).toMatchObject({ _id: byId._id, slug: byId.slug, publishedAt: byId.publishedAt, title: byId.title });
    expect(props.seo.canonicalUrl).toBe(`${NEWS_PULSE_SITE_URL}${destination}`);
    expect(buildArticleSeoMetadata(props.article, 'en', NEWS_PULSE_SITE_URL)?.ogUrl).toBe(props.seo.canonicalUrl);
    const old = context(alias.slug, 'en');
    old.params = { parts: [byId._id, alias.slug] };
    expect(await legacyProps(old)).toEqual({ redirect: { destination, permanent: true } });
    expect(JSON.stringify(fixture[kind])).toBe(before);
  });
});

test('the candidate collision-safe ID is never replaced with the colliding locale slug', async () => {
  const record = contracts.candidate.collision.article;
  expect(record.canonicalSlug).toBe(record._id);
  expect(contracts.candidate.collision.aliasStatus).toBe(409);
  const parsed = parsePublicNewsArticle(record);
  expect(resolveArticleSlug(parsed, 'en')).toBe(record._id);
  jest.mocked(global.fetch).mockImplementation(async input =>
    new URL(String(input)).pathname === '/api/public/news' ? response({ items: [] }) : response(record));
  const result = await getServerSideProps(context(record._id, 'en'));
  expect(result).toHaveProperty('props.seo.canonicalUrl', `${NEWS_PULSE_SITE_URL}/news/${record._id}`);
});

test('missing, foreign, unrelated and unpublished peer responses cannot manufacture hreflang', async () => {
  const article = parsePublicNewsArticle(contracts.candidate.editions.en)!;
  expect(getArticleAlternates(article, NEWS_PULSE_SITE_URL).map(link => link.hrefLang)).toEqual(['en', 'x-default']);
  const invalid = [
    response({}, 404),
    response(contracts.candidate.editions.en),
    response({ ...contracts.candidate.editions.hi, translationGroupId: 'unrelated', translationKey: 'unrelated' }),
    response({ ...contracts.candidate.editions.hi, status: 'draft' }),
  ];
  for (const result of invalid) {
    jest.mocked(global.fetch).mockImplementation(async () => result.clone());
    const links = await fetchArticleAlternates(article, NEWS_PULSE_SITE_URL, 1500);
    expect(links.map(link => link.hrefLang)).toEqual(['en', 'x-default']);
  }
  expect(console.error).toHaveBeenCalledWith('[seo] Article alternate unavailable', { locale: 'hi' });
});

test('alternate reads are concurrent and bounded by the remaining SSR allowance', async () => {
  jest.useFakeTimers();
  jest.mocked(global.fetch).mockImplementation(() => new Promise(() => {}));
  const article = parsePublicNewsArticle(contracts.candidate.editions.en)!;
  const read = fetchArticleAlternates(article, NEWS_PULSE_SITE_URL, 150);
  await jest.advanceTimersByTimeAsync(150);
  expect((await read).map(link => link.hrefLang)).toEqual(['en', 'x-default']);
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(console.error).toHaveBeenCalledTimes(2);
});
