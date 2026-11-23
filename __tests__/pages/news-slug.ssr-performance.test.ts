import type { GetServerSidePropsContext } from 'next';
import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { getServerSideProps } from '../../pages/news/[slug]';
import { getServerSideProps as getLegacyProps } from '../../pages/news/[...parts]';
import { getServerSideProps as getTopicProps } from '../../pages/topic/[slug]';
import { getLocalizedArticleFields, STRICT_LOCALE_POLICY } from '../../lib/localizedArticleFields';
import { buildNewsUrl } from '../../lib/newsRoutes';
import { navratriStoryFixtures, storyPageFixture, topicFixture } from '../fixtures/editorialTopics';

jest.mock('../../lib/publicApiBase', () => ({
  getPublicApiBaseUrl: () => 'http://localhost:3010',
}));

jest.mock('../../hooks/useArticleAnalytics', () => ({
  useArticleAnalytics: jest.fn(),
}));

jest.mock('../../lib/publicDataRefresh', () => ({
  subscribePublicDataRefresh: () => jest.fn(),
}));

function article(overrides: Record<string, any> = {}) {
  return {
    _id: '507f1f77bcf86cd799439011',
    status: 'published',
    publishedAt: '2026-01-01T10:00:00.000Z',
    category: 'national',
    language: 'en',
    title: 'Gujarat Budget 2026',
    summary: 'Summary',
    content: '<p>Body</p>',
    slug: 'gujarat-budget-2026',
    translationGroupId: 'group-1',
    ...overrides,
  };
}

function createCtx(slug: string, locale = 'en'): GetServerSidePropsContext {
  const req = Object.assign(new IncomingMessage(new Socket()), {
    headers: { host: 'www.newspulse.co.in', 'x-forwarded-proto': 'https' }, cookies: {},
  });
  return {
    locale, params: { slug }, query: {}, resolvedUrl: `/news/${slug}`,
    req, res: new ServerResponse(req),
  };
}

function mockFetchSequence(handler: (url: string) => any) {
  const calls: string[] = [];
  global.fetch = jest.fn((url: any) => {
    const target = String(url);
    calls.push(target);
    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => handler(target),
      text: async () => JSON.stringify(handler(target)),
    });
  }) as any;
  return calls;
}

describe('pages/news/[slug] getServerSideProps performance contract', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.resetAllMocks();
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test.each(['en', 'hi', 'gu'] as const)('renders %s public boolean availability metadata and verifies the other editions', async (lang) => {
    const slug = lang === 'gu' ? '\u0aa8\u0ab5\u0ab0\u0abe\u0aa4\u0acd\u0ab0\u0abf-persisted-story'
      : lang === 'hi' ? '\u0928\u0935\u0930\u093e\u0924\u094d\u0930\u093f-persisted-story' : 'persisted-story';
    const translations = { en: true, hi: true, gu: true };
    const record = article({ language: lang, slug, translations });
    const calls = mockFetchSequence((url) => {
      if (url.includes('/api/public/news/slug/')) return { article: record };
      if (url.includes('/api/public/news?')) return { items: [] };
      const language = new URL(url).searchParams.get('lang');
      return { article: article({ language, slug: `peer-${language}` }) };
    });
    const ctx = createCtx(slug, lang);
    ctx.res.statusCode = 200;
    const result = await getServerSideProps(ctx);
    if (!('props' in result)) throw new Error('Expected a resolved article, not a redirect or 404');
    expect(await result.props).toMatchObject({
      lang, slug, error: null, pending: false,
      article: { _id: record._id, language: lang, slug, translations, content: '<p>Body</p>' },
    });
    expect(ctx.res.statusCode).toBe(200);
    expect(calls[0]).toContain(`/api/public/news/slug/${encodeURIComponent(slug)}?lang=${lang}&language=${lang}`);
    expect(calls).toHaveLength(4);
    expect(console.error).not.toHaveBeenCalled();
  });

  describe.each(['active', 'paused', 'expired', 'scheduled'])('%s campaign article compatibility', (campaignStatus) => {
    test.each(['en', 'hi', 'gu'] as const)('%s recommendations exclude paid ranking candidates without hiding the sponsored article itself', async (lang) => {
      const current = article({
        language: lang, isSponsoredArticle: true, campaignStatus,
        ...(campaignStatus === 'scheduled' ? { sponsoredStartAt: '2999-01-01T00:00:00.000Z' } : {}),
      });
      const ordinary = article({ _id: 'ordinary', slug: 'ordinary', language: lang, tags: ['sponsored'], reads: 2 });
      const older = article({ _id: 'older', slug: 'older', language: lang, reads: 1 });
      const paid = article({
        _id: 'paid', slug: 'paid', language: lang, isSponsoredArticle: true,
        campaignStatus: 'expired', reads: 99999,
      });
      const calls = mockFetchSequence((url) => url.includes('/api/public/news/slug/')
        ? { article: current } : { items: [paid, ordinary, current, older] });
      const ctx = createCtx(current.slug, lang);
      ctx.res.statusCode = 200;
      const result = await getServerSideProps(ctx);
      if (!('props' in result)) throw new Error('Expected the published sponsored article');
      expect(await result.props).toMatchObject({
        article: { _id: current._id, slug: current.slug, campaignStatus }, error: null, pending: false,
        seo: { canonicalUrl: `https://www.newspulse.co.in${lang === 'en' ? '' : `/${lang}`}/news/${current.slug}` },
        relatedStories: [{ _id: 'ordinary' }, { _id: 'older' }],
      });
      expect(ctx.res.statusCode).toBe(200);
      expect(calls).toHaveLength(2);
    });
  });

  test('a boolean availability flag cannot make an unresolved foreign edition visible', async () => {
    mockFetchSequence((url) => url.includes('/api/public/news/slug/')
      ? { article: article({ language: 'gu', translations: { en: true, hi: true, gu: true } }) }
      : { items: [] });
    expect(await getServerSideProps(createCtx('gujarat-budget-2026', 'en'))).toEqual({ notFound: true });
  });

  test.each(['en', 'hi', 'gu'])('legacy %s URLs treat 410 as absence, not an outage', async (lang) => {
    global.fetch = jest.fn(async () => new Response(null, { status: 410 }));
    const ctx = createCtx('retired-slug', lang);
    ctx.params = { parts: ['507f1f77bcf86cd799439011', 'retired-slug'] };
    expect(await getLegacyProps(ctx)).toEqual({ notFound: true });
    expect(ctx.res.statusCode).not.toBe(503);
  });

  test.each(['invalid_article_response', 'invalid_json', 'request_or_render_error'])('logs safe SSR failure reason %s without leaking response data', async (reason) => {
    global.fetch = jest.fn(async () => {
      if (reason === 'request_or_render_error') throw new Error('private upstream URL/token');
      return new Response(reason === 'invalid_json' ? 'private invalid JSON body'
        : JSON.stringify({ article: article({ translations: { en: 'private invalid metadata' } }) }));
    });
    const ctx = createCtx('unavailable-story', 'hi');
    const result = await getServerSideProps(ctx);
    expect(ctx.res.statusCode).toBe(503);
    expect(ctx.res.getHeader('Retry-After')).toBe('30');
    expect(console.error).toHaveBeenCalledWith('[news] Article SSR unavailable', { locale: 'hi', reason });
    expect(JSON.stringify([result, jest.mocked(console.error).mock.calls])).not.toContain('private');
  });

  describe.each(['en', 'hi', 'gu'] as const)('%s topic-to-article identity contract', (lang) => {
    test.each([false, true])('opens the same persisted edition without a canonical redirect (cached translation=%s)', async (cached) => {
      const sourceLang = lang === 'gu' ? 'en' : 'gu';
      const sources = navratriStoryFixtures(sourceLang);
      const stories = navratriStoryFixtures(lang).map((story, index) => cached ? {
        ...story, _id: sources[index]._id, id: sources[index].id, articleId: sources[index].articleId,
        slug: sources[index].slug, isTranslated: true,
      } : story);
      const publicArticles = stories.map((story) => article({
        ...story, originalLang: cached ? sourceLang : lang,
        slugs: { [lang]: story.canonicalSlug },
      }));
      const calls = mockFetchSequence((target) => {
        const url = new URL(target);
        if (url.pathname === '/api/public/topics/navratri-2026') {
          expect(url.searchParams.get('lang')).toBe(lang);
          return { ok: true, lang, topic: topicFixture(lang), pinnedArticle: stories[0] };
        }
        if (url.pathname === '/api/public/topics/navratri-2026/articles') {
          expect(url.searchParams.get('lang')).toBe(lang);
          return { ...storyPageFixture(lang, 1, 2), items: stories.slice(1) };
        }
        if (url.pathname === '/api/public/news') return { items: [] };
        const resolved = publicArticles.find((_item, index) =>
          url.pathname === `/api/public/news/slug/${encodeURIComponent(stories[index].canonicalSlug)}`);
        if (!resolved) throw new Error(`Unexpected fixture lookup: ${target}`);
        expect(url.origin).toBe('http://localhost:3000');
        expect(url.searchParams.get('lang')).toBe(lang);
        expect(url.searchParams.get('language')).toBe(lang);
        return { article: resolved };
      });
      const ctx = createCtx('navratri-2026', lang);
      ctx.req.headers = { host: 'localhost:3000', 'x-forwarded-proto': 'http' };
      const topicResult = await getTopicProps(ctx);
      if (!('props' in topicResult)) throw new Error('Expected topic props');
      const topic = await topicResult.props;
      if (topic.mode !== 'editorial') throw new Error('Expected an eligible topic archive');
      const cards = [topic.pinnedArticle, ...topic.items];
      expect(cards).toHaveLength(3);
      for (const [index, card] of cards.entries()) {
        if (!card?.href) throw new Error('Expected a navigable topic card');
        const story = stories[index];
        const localized = getLocalizedArticleFields(publicArticles[index], lang, STRICT_LOCALE_POLICY);
        expect(localized.isVisible).toBe(true);
        expect(localized.slug).toBe(story.canonicalSlug);
        expect(card.href).toBe(buildNewsUrl({ id: story._id, slug: localized.slug, lang }));
        const slug = decodeURIComponent(new URL(card.href, 'http://localhost:3000').pathname.split('/').pop() || '');
        const result = await getServerSideProps({ ...ctx, params: { slug } });
        if (!('props' in result)) throw new Error('Topic link must resolve without a redirect or 404');
        const props = await result.props;
        expect(props).toMatchObject({
          lang, slug: story.canonicalSlug, error: null, pending: false,
          article: {
            _id: story._id, slug: story.slug, language: lang,
            title: story.title, category: story.category,
            translationKey: story.translationKey, translationGroupId: story.translationGroupId,
          },
        });
        expect(props.article?.content).toContain('Body');
      }
      expect(calls.filter((url) => url.includes('/api/public/news/slug/'))).toHaveLength(3);
      expect(calls).toHaveLength(8);
    });
  });

  describe.each(['slug', 'id-fallback'] as const)('%s proxy timing', (source) => {
    describe.each([3999, 5350])('%ims detail response', (detailMs) => {
      test.each(['en', 'hi', 'gu'] as const)('preserves %s article data within the existing combined read budget', async (lang) => {
        jest.useFakeTimers();
        const slug = lang === 'gu' ? '\u0ab5\u0abe\u0ab0\u0acd\u0aa4\u0abe-existing'
          : lang === 'hi' ? '\u0938\u092e\u093e\u091a\u093e\u0930-existing' : 'existing-story';
        const record = Object.freeze(article({
          language: lang,
          slug,
          imageUrl: 'https://example.test/original-photo.jpg',
          imageCaption: 'Original photo caption',
        }));
        const response = new Response();
        jest.spyOn(response, 'json').mockResolvedValue({ article: record });
        const slugPath = `/api/public/news/slug/${encodeURIComponent(slug)}`;
        const idPath = `/api/public/news/${encodeURIComponent(slug)}`;
        let relatedSignal: AbortSignal | null | undefined;
        const fetchMock = jest.fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>((input, init) => {
          const url = new URL(String(input));
          if (url.pathname === slugPath) {
            return new Promise<Response>((resolve) => {
              setTimeout(() => resolve(source === 'slug' ? response : new Response(null, { status: 404 })),
                source === 'slug' ? detailMs : 250);
            });
          }
          if (source === 'id-fallback' && url.pathname === idPath) {
            return new Promise<Response>((resolve) => setTimeout(() => resolve(response), detailMs - 250));
          }
          if (url.pathname === '/api/public/news') {
            relatedSignal = init?.signal;
            return new Promise<Response>(() => {});
          }
          throw new Error(`Unexpected article request: ${url.pathname}`);
        });
        global.fetch = fetchMock;
        const ctx = createCtx(slug, lang);
        ctx.req.headers.cookie = 'session=test-session';
        ctx.req.headers.authorization = 'Bearer test-token';
        ctx.res.statusCode = 200;
        const startedAt = Date.now();
        let completed = false;
        const pending = getServerSideProps(ctx).then((result) => { completed = true; return result; });

        await jest.advanceTimersByTimeAsync(detailMs);
        expect(completed).toBe(false);
        const relatedMs = Math.min(1500, 5500 - detailMs);
        await jest.advanceTimersByTimeAsync(relatedMs - 1);
        expect(completed).toBe(false);
        await jest.advanceTimersByTimeAsync(1);
        expect(completed).toBe(true);
        const result = await pending;
        if (!('props' in result)) throw new Error('Expected the original published article');
        const props = await result.props;
        expect(props.article).toEqual(record);
        expect(props).toMatchObject({ lang, slug, error: null, pending: false, relatedStories: [] });
        expect(ctx.res.statusCode).toBe(200);
        expect(ctx.res.getHeader('Cache-Control')).toBe('no-store, no-cache, must-revalidate, proxy-revalidate');
        expect(fetchMock.mock.calls.map(([input]) => new URL(String(input)).pathname))
          .toEqual(source === 'slug' ? [slugPath, '/api/public/news'] : [slugPath, idPath, '/api/public/news']);
        for (const [input, init] of fetchMock.mock.calls) {
          const url = new URL(String(input));
          expect(url.searchParams.get('lang')).toBe(lang);
          expect(url.searchParams.get('language')).toBe(lang);
          expect(init).toMatchObject({
            method: 'GET', cache: 'no-store',
            headers: { cookie: 'session=test-session', authorization: 'Bearer test-token' },
          });
        }
        expect(relatedSignal?.aborted).toBe(true);
        expect(Date.now() - startedAt).toBe(detailMs + relatedMs);
        expect(Date.now() - startedAt).toBeLessThanOrEqual(5500);
        expect(jest.getTimerCount()).toBe(0);
        expect(console.error).not.toHaveBeenCalled();
      });
    });
  });

  test.each(['en', 'hi', 'gu'])('stalled main %s article returns retryable 503, not a false 404', async (locale) => {
    jest.useFakeTimers();
    let signal: AbortSignal | undefined;
    global.fetch = jest.fn((_url, init) => {
      signal = init.signal;
      return Promise.resolve({ ok: true, status: 200, json: () => new Promise(() => {}) });
    }) as any;
    const ctx = createCtx('slow-story', locale);
    let completed = false;
    const pending = getServerSideProps(ctx).then((result) => { completed = true; return result; });
    await jest.advanceTimersByTimeAsync(5499);
    expect(completed).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(completed).toBe(true);
    expect(ctx.res.statusCode).toBe(503);
    expect(ctx.res.getHeader('Retry-After')).toBe('30');
    expect(signal?.aborted).toBe(true);
    expect((await pending as any).props.article).toBeNull();
    expect(jest.getTimerCount()).toBe(0);
    expect(console.error).toHaveBeenCalledWith('[news] Article SSR unavailable', { locale, reason: 'timeout' });
  });

  test.each(['headers', 'body'])('stalled related %s leaves the main article usable', async (stage) => {
    jest.useFakeTimers();
    global.fetch = jest.fn((url) => {
      if (String(url).includes('/slug/')) return Promise.resolve({ ok: true, json: async () => ({ article: article() }) });
      return stage === 'headers' ? new Promise(() => {}) : Promise.resolve({ ok: true, json: () => new Promise(() => {}) });
    }) as any;
    let completed = false;
    const pending = getServerSideProps(createCtx('gujarat-budget-2026')).then((result) => { completed = true; return result; });
    await jest.advanceTimersByTimeAsync(1500);
    expect(completed).toBe(true);
    const result = await pending as any;
    expect(result.props.article.title).toBe('Gujarat Budget 2026');
    expect(result.props.article.content).toContain('Body');
    expect(result.props.relatedStories).toEqual([]);
    expect(jest.getTimerCount()).toBe(0);
  });

  test('legacy resolution is bounded across all attempts and returns 503 on timeout', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn(() => new Promise(() => {})) as any;
    const ctx = createCtx('unused');
    ctx.params = { parts: ['article-id', 'old-slug'] };
    let completed = false;
    const pending = getLegacyProps(ctx).then((result) => { completed = true; return result; });
    await jest.advanceTimersByTimeAsync(4000);
    expect(completed).toBe(true);
    expect(await pending).toEqual({ props: { unavailable: true } });
    expect(ctx.res.statusCode).toBe(503);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('returns the article and its related lists', async () => {
    mockFetchSequence((url) => {
      if (url.includes('/api/public/news/slug/')) return { article: article() };
      if (url.includes('/api/public/news?')) {
        return { items: [
          article({ _id: 'other-1', slug: 'other-story', title: 'Other Story' }),
          article({ _id: 'draft-related', slug: 'draft-related', title: 'Draft Related Story', status: 'draft' }),
        ] };
      }
      return {};
    });

    const result: any = await getServerSideProps(createCtx('gujarat-budget-2026'));

    expect(result.props.article._id).toBe('507f1f77bcf86cd799439011');
    expect(result.props.article.content).toContain('Body');
    expect(result.props.relatedStories).toHaveLength(1);
    expect(result.props.relatedStories[0]._id).toBe('other-1');
    expect(result.props.relatedStories.map((item: any) => item._id)).not.toContain('draft-related');
  });

  test('never re-fetches the translation group that the API route already resolved', async () => {
    const calls = mockFetchSequence((url) => {
      if (url.includes('/api/public/news/slug/')) return { article: article() };
      if (url.includes('/api/public/news?')) return { items: [] };
      return {};
    });

    await getServerSideProps(createCtx('gujarat-budget-2026'));
    expect(calls.some((url) => url.includes('/api/public/news/group/'))).toBe(false);
  });

  test.each(['en', 'hi', 'gu'] as const)('%s ships the complete detail once and no recommendation bodies on either route', async lang => {
    const body = `<p>${{ en: 'Paragraph ', hi: 'अनुच्छेद ', gu: 'ફકરો ' }[lang].repeat(1600)}</p><p>Final paragraph.</p>`;
    const main = article({ language: lang, content: body, body, slug: 'original' });
    const related = Array.from({ length: 12 }, (_, i) => article({
      _id: `card-${i}`, slug: `card-${i}`, language: lang, title: `Headline ${i}`,
      content: `Unused recommendation body ${body}`, imageUrl: `/img/${i}.jpg`, translationKey: `peer-${i}`,
    }));
    mockFetchSequence(url => url.includes('/api/public/news?') ? { items: [
      { ...related[0], visibility: 'restricted', title: 'Restricted headline' }, ...related,
    ] } : { article: main });
    for (const shortLink of [false, true]) {
      const result = await getServerSideProps(createCtx(shortLink ? main._id : main.slug, lang), { shortLink });
      if (!('props' in result)) throw new Error('Expected the complete public article');
      const props = await result.props;
      const wire = JSON.stringify(props);
      expect(props.article?.content).toBe(body);
      expect(props.article).not.toHaveProperty('body');
      expect(props.bodyIsContent).toBe(true);
      expect(wire).not.toMatch(/Unused recommendation body|Restricted headline|safeHtml|topStories|"messages"/);
      expect(wire.match(/Final paragraph\./g)).toHaveLength(1);
      expect(Buffer.byteLength(wire)).toBeLessThan(128_000);
      expect(props.relatedStories.flatMap(s => s.card ? [s.card.title] : [])).toEqual(related.slice(0, 6).map(s => s.title));
      expect(props.relatedStories.map(s => s.translationKey)).toEqual(related.map((_, i) => `peer-${i}`));
    }
  });

  test('does not truncate intrinsically large articles or discard distinct body data', async () => {
    const content = `<p>${'માહિતી '.repeat(8000)}</p><p>Last paragraph.</p>`;
    const main = article({ content, body: 'Distinct legacy representation' });
    mockFetchSequence(url => url.includes('/api/public/news?') ? { items: [] } : { article: main });
    const result = await getServerSideProps(createCtx(main.slug));
    if (!('props' in result)) throw new Error('Expected a long published article');
    const props = await result.props;
    expect(Buffer.byteLength(content)).toBeGreaterThan(128_000);
    expect(props.article).toMatchObject({ content, body: 'Distinct legacy representation' });
    expect(props.bodyIsContent).toBeUndefined();
  });

  test('keeps the blocking path to a single article request plus one list request', async () => {
    const calls = mockFetchSequence((url) => {
      if (url.includes('/api/public/news/slug/')) return { article: article() };
      if (url.includes('/api/public/news?')) return { items: [] };
      return {};
    });

    await getServerSideProps(createCtx('gujarat-budget-2026'));

    expect(calls).toHaveLength(2);
    expect(calls[0]).toContain('/api/public/news/slug/gujarat-budget-2026');
    expect(calls[1]).toContain('/api/public/news?');
  });

  test('renders the article even when the related-stories request fails', async () => {
    global.fetch = jest.fn((url: any) => {
      const target = String(url);
      if (target.includes('/api/public/news/slug/')) {
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ article: article() }) });
      }
      return Promise.reject(new Error('UPSTREAM_DOWN'));
    }) as any;

    const result: any = await getServerSideProps(createCtx('gujarat-budget-2026'));

    expect(result.props.article._id).toBe('507f1f77bcf86cd799439011');
    expect(result.props.relatedStories).toEqual([]);
    expect(result.props).not.toHaveProperty('topStories');
  });

  test('returns notFound when no article resolves', async () => {
    mockFetchSequence(() => ({ article: null }));

    const result: any = await getServerSideProps(createCtx('missing-story'));

    expect(result.notFound).toBe(true);
  });

  test('confirmed HTTP 404 remains notFound but HTTP 503 is retryable', async () => {
    global.fetch = jest.fn(async () => ({ ok: false, status: 404 })) as any;
    expect(await getServerSideProps(createCtx('missing-story'))).toEqual({ notFound: true });
    global.fetch = jest.fn(async () => ({ ok: false, status: 503 })) as any;
    const ctx = createCtx('temporarily-unavailable');
    const result = await getServerSideProps(ctx) as any;
    expect(ctx.res.statusCode).toBe(503);
    expect(result.notFound).toBeUndefined();
    expect(result.props.error).toBe('Article temporarily unavailable');
    expect(console.error).toHaveBeenCalledWith('[news] Article SSR unavailable', { locale: 'en', reason: 'upstream_http_error' });
  });

  test('never-resolving main headers return before the SSR deadline', async () => {
    jest.useFakeTimers();
    global.fetch = jest.fn(() => new Promise(() => {})) as any;
    const ctx = createCtx('slow-headers');
    let completed = false;
    const pending = getServerSideProps(ctx).then((result) => { completed = true; return result; });
    await jest.advanceTimersByTimeAsync(5499);
    expect(completed).toBe(false);
    await jest.advanceTimersByTimeAsync(1);
    expect(completed).toBe(true);
    expect((await pending as any).props.article).toBeNull();
    expect(ctx.res.statusCode).toBe(503);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  test('returns notFound when a public slug resolves to a draft article', async () => {
    mockFetchSequence((url) => {
      if (url.includes('/api/public/news/slug/')) return { article: article({ status: 'draft', title: 'Draft Detail Story' }) };
      return { items: [] };
    });

    const result: any = await getServerSideProps(createCtx('draft-detail-story'));

    expect(result).toEqual({ notFound: true });
  });

  test('preserves the permanent canonical-slug redirect', async () => {
    mockFetchSequence((url) => {
      if (url.includes('/api/public/news/slug/')) return { article: article({ slug: 'canonical-slug' }) };
      return { items: [] };
    });

    const result: any = await getServerSideProps(createCtx('old-slug'));

    expect(result.redirect).toEqual({ destination: '/news/canonical-slug', permanent: true });
  });

  test.each([
    ['hi', '/hi/news/canonical-hi'],
    ['gu', '/gu/news/canonical-gu'],
  ])('keeps %s locale routing on canonical redirects', async (locale, expected) => {
    mockFetchSequence((url) => {
      if (url.includes('/api/public/news/slug/')) {
        return { article: article({ language: locale, slug: `canonical-${locale}` }) };
      }
      return { items: [] };
    });

    const result: any = await getServerSideProps(createCtx('old-slug', locale));

    expect(result.redirect.destination).toBe(expected);
  });

  test.each(['en', 'hi', 'gu'])('serves %s articles without a locale redirect on canonical slugs', async (locale) => {
    mockFetchSequence((url) => {
      if (url.includes('/api/public/news/slug/')) {
        return { article: article({ language: locale, slug: 'shared-slug' }) };
      }
      return { items: [] };
    });

    const result: any = await getServerSideProps(createCtx('shared-slug', locale));

    expect(result.redirect).toBeUndefined();
    expect(result.props.lang).toBe(locale);
    expect(result.props.article.slug).toBe('shared-slug');
  });

  test('passes the pending-translation state through without extra requests', async () => {
    const calls = mockFetchSequence(() => ({ status: 'pending', sourceLang: 'en' }));

    const result: any = await getServerSideProps(createCtx('pending-story', 'gu'));

    expect(result.props.pending).toBe(true);
    expect(result.props.article).toBeNull();
    expect(calls.some((url) => url.includes('/api/public/news?'))).toBe(false);
  });
});
