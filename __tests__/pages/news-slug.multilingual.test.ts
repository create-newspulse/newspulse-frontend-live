import type { GetServerSidePropsContext, NextApiRequest, NextApiResponse } from 'next';
import { IncomingMessage, ServerResponse } from 'http';
import { Socket } from 'net';
import { getServerSideProps } from '../../pages/news/[slug]';
import { getServerSideProps as getShareProps } from '../../pages/s/[slug]';
import { getServerSideProps as legacyProps } from '../../pages/news/[...parts]';
import slugProxy from '../../pages/api/public/news/slug/[slug]';
import idProxy from '../../pages/api/public/news/[id]/index';
import { fetchArticleAlternates } from '../../lib/articleSeo.server';
import { resolveArticleSlug } from '../../lib/articleSlugs';
import { parsePublicNewsArticle } from '../../lib/publicNewsApi';
import { buildArticleSeoMetadata, getArticleAlternates, NEWS_PULSE_SITE_URL, type SeoAlternate } from '../../lib/seo';
import { buildSocialImageUrl } from '../../lib/articleSocialImage';
import { buildNewsShareUrl } from '../../lib/newsRoutes';
import { PREVIEW_REQUEST_ID_HEADER, PREVIEW_TRACE_HEADER } from '../../lib/socialPreviewDiagnostics.server';
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

  test.each(locales)('%s original and short HTML requests produce correlated, content-free render diagnostics', async lang => {
    const record = fixture.editions[lang];
    for (const [routeType, loader, slug] of [
      ['article', getServerSideProps, record.canonicalSlug], ['smart_share', getShareProps, record._id],
    ] as const) {
      jest.mocked(console.info).mockClear();
      jest.mocked(global.fetch).mockReset().mockImplementation(async input => {
        const url = new URL(String(input));
        if (url.pathname === '/api/public/news') return response({ items: [] });
        const requested = url.searchParams.get('lang') as typeof lang;
        return response({ article: fixture.editions[requested] });
      });
      const ctx = context(slug, lang);
      const result = await loader(ctx);
      expect(result).toHaveProperty('props.article._id', record._id);
      const correlationId = String(ctx.res.getHeader(PREVIEW_REQUEST_ID_HEADER));
      const headers = new Headers(jest.mocked(global.fetch).mock.calls[0][1]?.headers);
      expect(headers.get(PREVIEW_TRACE_HEADER)).toBe(`${routeType}:${correlationId}`);
      ctx.res.emit('finish');
      const events = jest.mocked(console.info).mock.calls.filter(([prefix]) => prefix === '[social-preview]')
        .map(([, json]) => JSON.parse(String(json)));
      expect(events).toEqual([expect.objectContaining({
        phase: 'render', correlationId, language: lang, routeType, completed: true, responseStatus: 200,
        openGraph: { complete: true, missingFields: [] },
        image: { selection: 'official_fallback', fallback: true },
      })]);
      expect(JSON.stringify(events)).not.toContain(record.title);
      expect(JSON.stringify(events)).not.toContain(record._id);
    }
  });

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

  test.each(locales)('%s short links render the published edition without a redirect or slug lookup', async lang => {
    const sourceId = fixture.editions.gu._id;
    const record = fixture.editions[lang];
    const before = JSON.stringify(fixture);
    jest.mocked(global.fetch).mockImplementation(async input => {
      const url = new URL(String(input));
      if (url.pathname === '/api/public/news') return response({ items: [] });
      const requested = url.searchParams.get('lang') as typeof lang;
      return response({ article: fixture.editions[requested] });
    });
    const ctx = context(sourceId, lang);
    ctx.resolvedUrl = buildNewsShareUrl({ id: sourceId, lang });
    ctx.query = { lang: lang === 'gu' ? 'hi' : 'gu', slug: '507f1f77bcf86cd79943ffff' };
    const result = await getShareProps(ctx);
    if (!('props' in result)) throw new Error('Short links must render the article, not redirect');
    const props = await result.props;
    const canonical = `${NEWS_PULSE_SITE_URL}${lang === 'en' ? '' : `/${lang}`}/news/${encodeURIComponent(record.canonicalSlug)}`;
    expect(props.article).toMatchObject({ _id: record._id, title: record.title, publishedAt: record.publishedAt });
    expect(props.article?.content).toBe(record.content);
    expect(props.seo?.canonicalUrl).toBe(canonical);
    expect(props.seo?.alternates?.map(link => link.hrefLang)).toEqual(['en', 'hi', 'gu', 'x-default']);
    expect(buildArticleSeoMetadata(props.article, lang, NEWS_PULSE_SITE_URL)).toMatchObject({
      ogTitle: record.title, ogDescription: record.summary, ogUrl: canonical, ogLocale: `${lang}_IN`,
      ogImage: `${NEWS_PULSE_SITE_URL}/brand/news-pulse-social.jpg`,
    });
    expect(ctx.res.getHeader('Cache-Control')).toContain('no-store');
    expect(new URL(String(jest.mocked(global.fetch).mock.calls[0][0])).pathname).toBe(`/api/public/news/${sourceId}`);
    expect(jest.mocked(global.fetch).mock.calls.some(([url]) => String(url).includes('/news/slug/'))).toBe(false);
    expect(JSON.stringify(fixture)).toBe(before);
  });

  test.each(['en', 'hi'] as const)('switching a Gujarati published alias to %s resolves its native edition', async lang => {
    const record = fixture.editions[lang];
    jest.mocked(global.fetch).mockImplementation(async input =>
      new URL(String(input)).pathname === '/api/public/news' ? response({ items: [] }) : response(record));
    const destination = `${lang === 'en' ? '' : `/${lang}`}/news/${encodeURIComponent(record.canonicalSlug)}`;
    expect(await getServerSideProps(context(fixture.editions.gu.slug, lang)))
      .toEqual({ redirect: { destination, permanent: true } });
  });

  test.each([
    { slug: undefined }, { slug: '' }, { slug: 'old-published-slug' }, { slug: 'undefined' },
    { slug: '507f1f77bcf86cd799439011/other' }, { slug: ['507f1f77bcf86cd799439011'] },
  ])('invalid short identity %j cannot cause an article lookup', async ({ slug }) => {
    const ctx = context('', 'en');
    ctx.params = { slug };
    expect(await getShareProps(ctx)).toEqual({ notFound: true });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test.each([404, 410])('a short-link ID response %s cannot fall through to a colliding slug', async status => {
    jest.mocked(global.fetch).mockResolvedValueOnce(response({}, status));
    expect(await getShareProps(context(fixture.editions.en._id, 'en'))).toEqual({ notFound: true });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test.each([
    { status: 'draft' }, { status: 'unpublished' }, { isDeleted: true },
    { status: 'restricted' }, { visibility: 'private' }, { isPrivate: true },
    { status: 'scheduled', publishedAt: '2999-01-01T00:00:00.000Z' },
  ])('short links do not expose a nonpublic edition: %j', async lifecycle => {
    const record = { ...fixture.editions.gu, ...lifecycle };
    jest.mocked(global.fetch).mockImplementation(async input =>
      new URL(String(input)).pathname === '/api/public/news' ? response({ items: [] }) : response({ article: record }));
    expect(await getShareProps(context(record._id, 'gu'))).toEqual({ notFound: true });
  });

  test('a missing translated edition is not replaced with source-language content or a pending preview', async () => {
    jest.mocked(global.fetch).mockResolvedValue(response({ article: fixture.editions.en }));
    expect(await getShareProps(context(fixture.editions.en._id, 'hi'))).toEqual({ notFound: true });
    jest.mocked(global.fetch).mockReset().mockImplementation(async () => response({ status: 'pending', sourceLang: 'en' }));
    expect(await getShareProps(context(fixture.editions.en._id, 'hi'))).toEqual({ notFound: true });
    expect(await getServerSideProps(context(fixture.editions.en._id, 'hi'))).toHaveProperty('props.pending', true);
  });

  test.each([409, 503])('an ambiguous or unavailable ID read (%s) remains an observable failure', async status => {
    jest.mocked(global.fetch).mockResolvedValue(response({}, status));
    const ctx = context(fixture.editions.en._id, 'en');
    const result = await getShareProps(ctx);
    expect(ctx.res.statusCode).toBe(503);
    expect(result).toHaveProperty('props.article', null);
    expect(result).toHaveProperty('props.error', 'Article temporarily unavailable');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('a visible record without a usable headline cannot become a successful preview on either route', async () => {
    const record = { ...fixture.editions.gu, title: '<p>&nbsp;</p>', seo: { ogTitle: 'Stale title' } };
    jest.mocked(global.fetch).mockImplementation(async input =>
      new URL(String(input)).pathname === '/api/public/news' ? response({ items: [] }) : response({ article: record }));
    for (const [loader, slug] of [[getServerSideProps, record.canonicalSlug], [getShareProps, record._id]] as const) {
      const ctx = context(slug, 'gu');
      expect(await loader(ctx)).toHaveProperty('props.article', null);
      expect(ctx.res.statusCode).toBe(503);
      expect(ctx.res.getHeader('Retry-After')).toBeDefined();
    }
    expect(await getServerSideProps(context('old-alias', 'gu'))).toHaveProperty('redirect.permanent', true);
  });

  test('future publication and later text or cover changes refresh the same stable short link', async () => {
    const id = '7f0000000000000000000099';
    const source = 'https://res.cloudinary.com/fixture/image/upload/v1/future-cover.png';
    const descriptor = (image: string) => ({
      source: image, url: buildSocialImageUrl(image, 75), type: 'image/jpeg' as const,
      width: 1200, height: 630, bytes: 90_000,
    });
    const published = {
      ...fixture.editions.en, _id: id, translations: { en: true },
      availableLocales: ['en'], publishedLocales: ['en'], status: 'published',
      coverImageUrl: source, socialImage: descriptor(source),
    };
    let current: Record<string, unknown> = { ...published, status: 'draft' };
    jest.mocked(global.fetch).mockImplementation(async input =>
      new URL(String(input)).pathname === '/api/public/news' ? response({ items: [] }) : response({ article: current }));
    const read = () => getShareProps(context(id, 'en'));
    expect(await read()).toEqual({ notFound: true });
    current = published;
    const first = await read();
    if (!('props' in first)) throw new Error('Newly published articles must automatically acquire a share page');
    const initial = await first.props;
    const replacement = source.replace('/v1/', '/v2/');
    current = {
      ...published, title: 'Updated headline', summary: 'Updated description', description: 'Updated description',
      coverImageUrl: replacement, socialImage: descriptor(replacement),
      seo: { metaTitle: 'Search title', metaDescription: 'Search description', ogImage: source,
        ogTitle: published.title, ogDescription: published.summary, twitterTitle: published.title, twitterDescription: published.summary },
    };
    const updated = await read();
    if (!('props' in updated)) throw new Error('The stable share route must survive Save Update');
    const props = await updated.props;
    expect(buildArticleSeoMetadata(props.article, 'en', NEWS_PULSE_SITE_URL)).toMatchObject({
      ogTitle: 'Updated headline', ogDescription: 'Updated description', ogImage: descriptor(replacement).url,
      twitterTitle: 'Updated headline', twitterDescription: 'Updated description', twitterImage: descriptor(replacement).url,
      title: 'Search title', description: 'Search description',
      publishedAt: published.publishedAt,
    });
    expect(props.seo?.canonicalUrl).toBe(initial.seo?.canonicalUrl);
    current = { ...current, coverImage: { removed: true } };
    const removed = await read();
    if (!('props' in removed)) throw new Error('Cover removal must not remove the share page');
    expect(buildArticleSeoMetadata((await removed.props).article, 'en', NEWS_PULSE_SITE_URL)?.ogImage)
      .toBe(`${NEWS_PULSE_SITE_URL}/brand/news-pulse-social.jpg`);
    expect(buildNewsShareUrl({ id, lang: 'en' })).toBe(`/s/${id}`);
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
