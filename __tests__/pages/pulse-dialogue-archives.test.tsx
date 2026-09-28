import { getDialogueArchiveProps } from '../../lib/pulseDialogueArchive';
import { getPublicApiBaseUrl } from '../../lib/publicApiBase';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import PulseDialogueArchivePage from '../../components/PulseDialogueArchivePage';
import SeoAlternates from '../../components/SeoAlternates';
import en from '../../src/i18n/en.json';
import vercelConfig from '../../vercel.json';

jest.mock('next/head', () => ({ __esModule: true, default: ({ children }: any) => <>{children}</> }));
jest.mock('next/router', () => ({ useRouter: () => ({ locale: 'en', asPath: '/pulse-dialogue/contributors/writer' }) }));
jest.mock('../../src/i18n/LanguageProvider', () => ({ useI18n: () => ({ t: (key: string) => key.split('.').reduce((value: any, part) => value?.[part], en) || key }) }));
jest.mock('../../src/components/story/StoryImage', () => ({ __esModule: true, default: ({ alt, src }: any) => <img alt={alt} src={src} /> }));

jest.mock('../../lib/publicApiBase', () => ({ getPublicApiBaseUrl: jest.fn(() => 'http://localhost:3010') }));
jest.mock('../../lib/getMessages', () => ({ getMessages: async () => ({}) }));

const contributor = { slug: 'writer', name: 'Current Writer', publicDesignation: null, photoUrl: null, shortBio: null, contributionCount: 12 };
const series = { slug: 'ideas', title: 'Ideas', description: null, ownerContributor: null, articleCount: 12 };
function response(lang = 'en', overrides: Record<string, unknown> = {}) {
  return { ok: true, contributor, series, items: [], lang, total: 12, count: 0, page: 1, limit: 12, totalPages: 1, hasNextPage: false, ...overrides };
}
function context(locale = 'en', slug = 'writer', page?: string) {
  return { locale, params: { slug }, query: page ? { page } : {}, req: { headers: { host: 'localhost:3000' } }, res: { statusCode: 200, setHeader: jest.fn() } } as any;
}
const mockFetch = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  global.fetch = mockFetch;
  mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => response() });
});

describe('Pulse Dialogue archive SSR', () => {
  test.each(['en', 'hi', 'gu'])('requests bounded %s archives and supplies canonical/hreflang', async (locale) => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => response(locale) });
    const result: any = await getDialogueArchiveProps(context(locale), 'contributors');
    expect(mockFetch).toHaveBeenCalledWith(`http://localhost:3010/api/public/pulse-dialogue/contributors/writer/articles?lang=${locale}&page=1&limit=12`, expect.objectContaining({ method: 'GET', cache: 'no-store' }));
    expect(result.props.contributor.contributionCount).toBe(12);
    expect(result.props.seo.canonicalUrl).toContain(`${locale === 'en' ? '' : `/${locale}`}/pulse-dialogue/contributors/writer`);
    expect(result.props.seo.alternates.map((item: any) => item.hrefLang)).toEqual(['en', 'hi', 'gu', 'x-default']);
    expect(result.props.seo.jsonLd.mainEntity).toMatchObject({ '@type': 'Person', name: 'Current Writer' });
    expect(JSON.stringify(result.props.seo.jsonLd)).not.toMatch(/contributorId|_id|jobTitle|image/);
  });

  test.each(['en', 'hi', 'gu'])('permanently redirects old %s slug preserving pagination', async (locale) => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => response(locale, { page: 2, requestedSlug: 'old', canonicalSlug: 'writer', redirectRequired: true }) });
    expect(await getDialogueArchiveProps(context(locale, 'old', '2'), 'contributors')).toEqual({ redirect: {
      destination: `${locale === 'en' ? '' : `/${locale}`}/pulse-dialogue/contributors/writer?page=2`, permanent: true,
    } });
  });

  test('does not loop on a canonical request even with redundant redirect metadata', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => response('en', { canonicalSlug: 'writer', redirectRequired: true }) });
    expect(await getDialogueArchiveProps(context(), 'contributors')).toHaveProperty('props');
  });

  test.each(['contributors', 'series'] as const)('%s pagination uses API metadata and page query', async (kind) => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => response('en', { page: 2, totalPages: 3, hasNextPage: true }) });
    const result: any = await getDialogueArchiveProps(context('en', kind === 'series' ? 'ideas' : 'writer', '2'), kind);
    expect(result.props.pagination).toEqual({ page: 2, totalPages: 3, hasNextPage: true });
    expect(result.props.seo.canonicalUrl).toContain('?page=2');
    expect(mockFetch.mock.calls[0][0]).toContain('page=2&limit=12');
  });

  test('retains one backend-resolved fallback story with a usable resolved-language link', async () => {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => response('gu', { items: [{
      _id: 'story-1', slug: 'english-story', title: 'English fallback', summary: 'Summary', language: 'en',
      status: 'published', resolvedLang: 'en', isFallback: true, requestedLang: 'gu', category: 'pulse-dialogue',
    }] }) });
    const result: any = await getDialogueArchiveProps(context('gu'), 'contributors');
    expect(result.props.items).toHaveLength(1);
    expect(result.props.items[0]).toMatchObject({ title: 'English fallback', href: '/news/english-story' });
  });

  test.each(['contributors', 'series'] as const)('%s 404 uses Next unavailable behavior', async (kind) => {
    mockFetch.mockResolvedValue({ ok: false, status: 404 });
    expect(await getDialogueArchiveProps(context(), kind)).toEqual({ notFound: true });
  });

  test.each(['reject', '500', 'malformed'])('temporary %s failure stays 503, not 404', async (failure) => {
    if (failure === 'reject') mockFetch.mockRejectedValue(new Error('timeout'));
    else mockFetch.mockResolvedValue({ ok: failure !== '500', status: 500, json: async () => ({ ok: true }) });
    const ctx = context();
    const result: any = await getDialogueArchiveProps(ctx, 'contributors');
    expect(ctx.res.statusCode).toBe(503);
    expect(result.props.error).toBe(true);
    expect(result.props.seo.disableAlternates).toBe(true);
  });

  test('does not fetch when the safe backend resolver has no configured base', async () => {
    (getPublicApiBaseUrl as jest.Mock).mockReturnValueOnce('');
    const result: any = await getDialogueArchiveProps(context(), 'contributors');
    expect(result.props.error).toBe(true);
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('Pulse Dialogue archive canonical origins', () => {
  const productionOrigin = 'https://www.newspulse.co.in';
  const locales = ['en', 'hi', 'gu'];

  function expectSeo(result: any, origin: string, kind: string, slug: string, locale: string, suffix = '') {
    const archivePath = `/pulse-dialogue/${kind}/${slug}${suffix}`;
    const canonicalUrl = `${origin}${locale === 'en' ? '' : `/${locale}`}${archivePath}`;
    const alternates = [
      { hrefLang: 'en', href: `${origin}${archivePath}` },
      { hrefLang: 'hi', href: `${origin}/hi${archivePath}` },
      { hrefLang: 'gu', href: `${origin}/gu${archivePath}` },
      { hrefLang: 'x-default', href: `${origin}${archivePath}` },
    ];
    expect(result.props.seo.canonicalUrl).toBe(canonicalUrl);
    expect(result.props.seo.alternates).toEqual(alternates);
    expect(result.props.seo.jsonLd).toMatchObject({ url: canonicalUrl, publisher: { url: origin } });
    const view = render(<SeoAlternates {...result.props.seo} />);
    expect(document.querySelector('link[rel="canonical"]')!.getAttribute('href')).toBe(canonicalUrl);
    expect(Array.from(document.querySelectorAll('link[rel="alternate"]')).map((link) => ({
      hrefLang: link.getAttribute('hreflang'), href: link.getAttribute('href'),
    }))).toEqual(alternates);
    view.unmount();
  }

  beforeEach(() => {
    jest.replaceProperty(process, 'env', {
      ...process.env,
      NODE_ENV: 'production', VERCEL_ENV: 'production',
      NEWS_PULSE_DEPLOYMENT: '', NEWS_PULSE_ENV: '',
      NEXT_PUBLIC_SITE_URL: '', VERCEL_URL: 'newspulse.vercel.app',
    });
  });
  afterEach(() => jest.restoreAllMocks());

  test('repository deployment configuration specifies the public production origin', () => {
    expect(vercelConfig.env.NEXT_PUBLIC_SITE_URL).toBe(productionOrigin);
  });

  describe.each(['configured', 'fallback'])('%s production origin', (mode) => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_SITE_URL = mode === 'configured' ? vercelConfig.env.NEXT_PUBLIC_SITE_URL : '';
    });

    test.each(['contributors', 'series'] as const)('%s uses exact public URLs in EN/HI/GU', async (kind) => {
      const slug = kind === 'contributors' ? 'writer' : 'ideas';
      for (const locale of locales) {
        mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => response(locale) });
        const ctx = context(locale, slug);
        ctx.req.headers = { host: 'newspulse.vercel.app', 'x-forwarded-host': 'preview.example.test', 'x-forwarded-proto': 'https' };
        const result = await getDialogueArchiveProps(ctx, kind);
        expectSeo(result, productionOrigin, kind, slug, locale);
        expect(JSON.stringify(result)).not.toContain('newspulse.vercel.app');
      }
    });

    test.each(locales)('old %s contributor slug redirects to canonical public metadata', async (locale) => {
      mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => response(locale, {
        page: 2, requestedSlug: 'old', canonicalSlug: 'writer', redirectRequired: true,
      }) });
      const redirected: any = await getDialogueArchiveProps(context(locale, 'old', '2'), 'contributors');
      const prefix = locale === 'en' ? '' : `/${locale}`;
      expect(redirected).toEqual({ redirect: {
        destination: `${prefix}/pulse-dialogue/contributors/writer?page=2`, permanent: true,
      } });
      const destination = new URL(redirected.redirect.destination, productionOrigin);
      expect(destination.origin).toBe(productionOrigin);
      const canonicalSlug = destination.pathname.split('/').pop()!;
      const result = await getDialogueArchiveProps(context(locale, canonicalSlug, destination.searchParams.get('page')!), 'contributors');
      expectSeo(result, productionOrigin, 'contributors', 'writer', locale, '?page=2');
      expect(JSON.stringify(result)).not.toMatch(/newspulse\.vercel\.app|\/contributors\/old/);
    });
  });

  test.each([
    ['test', '', '', 'localhost:3000', 'http://localhost:3000'],
    ['development', '', 'http://localhost:3002', 'localhost:3000', 'http://localhost:3002'],
    ['production', 'preview', '', 'preview.example.test', 'https://preview.example.test'],
    ['production', 'preview', 'https://staging.example.test', 'preview.example.test', 'https://staging.example.test'],
  ] as const)('%s/%s preserves configured or request-local origin %s', async (nodeEnv, vercelEnv, configured, host, origin) => {
    jest.replaceProperty(process, 'env', {
      ...process.env, NODE_ENV: nodeEnv, VERCEL_ENV: vercelEnv, NEXT_PUBLIC_SITE_URL: configured,
    });
    for (const kind of ['contributors', 'series'] as const) {
      for (const locale of locales) {
        const slug = kind === 'contributors' ? 'writer' : 'ideas';
        mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => response(locale) });
        const ctx = context(locale, slug);
        ctx.req.headers = { host, 'x-forwarded-proto': origin.startsWith('https:') ? 'https' : 'http' };
        const result = await getDialogueArchiveProps(ctx, kind);
        expectSeo(result, origin, kind, slug, locale);
        expect(JSON.stringify(result)).not.toContain(productionOrigin);
      }
    }
  });
});

describe('Pulse Dialogue archive UI', () => {
  async function show(overrides: Record<string, unknown> = {}, kind: 'contributors' | 'series' = 'contributors', locale = 'en') {
    mockFetch.mockResolvedValue({ ok: true, status: 200, json: async () => response(locale, overrides) });
    const result: any = await getDialogueArchiveProps(context(locale, kind === 'series' ? 'ideas' : 'writer'), kind);
    return render(<><SeoAlternates {...result.props.seo} /><PulseDialogueArchivePage {...result.props} /></>);
  }

  test('renders a current profile with API count and safe empty archive, without optional sections', async () => {
    await show();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Current Writer');
    expect(screen.getByText('12 Contributions')).toBeTruthy();
    expect(screen.getByText('No contributions on this page.')).toBeTruthy();
    expect(screen.queryByRole('img')).toBeNull();
  });

  test('zero contributions remains an available profile', async () => {
    await show({ contributor: { ...contributor, contributionCount: 0 }, total: 0, totalPages: 0 });
    expect(screen.getByText('0 Contributions')).toBeTruthy();
    expect(screen.getByText('No contributions published yet.')).toBeTruthy();
  });

  test('renders optional photo, role and bio, and hides a broken contributor image', async () => {
    await show({ contributor: { ...contributor, photoUrl: 'https://example.test/photo.jpg', publicDesignation: 'Writer and researcher', shortBio: 'A public biography.', internalEmail: 'secret@example.test', _id: 'internal' } });
    expect(screen.getByText('Writer and researcher')).toBeTruthy();
    expect(screen.getByText('A public biography.')).toBeTruthy();
    fireEvent.error(screen.getByRole('img', { name: 'Current Writer' }));
    expect(screen.queryByRole('img')).toBeNull();
    expect(document.body.innerHTML).not.toContain('secret@example.test');
    const schema = JSON.parse(document.querySelector('script[type="application/ld+json"]')!.textContent!);
    expect(schema.mainEntity).toMatchObject({ '@type': 'Person', jobTitle: 'Writer and researcher', image: 'https://example.test/photo.jpg' });
    expect(schema.mainEntity).not.toHaveProperty('_id');
  });

  test('hides an image that failed before hydration attached its error handler', async () => {
    const complete = jest.spyOn(HTMLImageElement.prototype, 'complete', 'get').mockReturnValue(true);
    try {
      await show({ contributor: { ...contributor, photoUrl: 'https://example.test/missing.jpg' } });
      expect(screen.queryByRole('img')).toBeNull();
      expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Current Writer');
    } finally { complete.mockRestore(); }
  });

  test.each(['publicDesignation', 'shortBio', 'photoUrl'])('%s is independently optional', async (field) => {
    await show({ contributor: { ...contributor, publicDesignation: 'Researcher', shortBio: 'Public bio', photoUrl: 'https://example.test/photo.jpg', [field]: null } });
    if (field === 'publicDesignation') expect(screen.queryByText('Researcher')).toBeNull();
    if (field === 'shortBio') expect(screen.queryByText('Public bio')).toBeNull();
    if (field === 'photoUrl') expect(screen.queryByRole('img')).toBeNull();
  });

  test.each(['en', 'hi', 'gu'])('Series renders with localized %s SEO and optional public owner link', async (locale) => {
    const view = await show({ series: { ...series, description: 'Public series description', ownerContributor: contributor } }, 'series', locale);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Ideas');
    expect(screen.getByText('12 Articles')).toBeTruthy();
    const prefix = locale === 'en' ? '' : `/${locale}`;
    expect(screen.getByRole('link', { name: 'Current Writer' }).getAttribute('href')).toBe(`${prefix}/pulse-dialogue/contributors/writer`);
    expect(document.querySelector('link[rel="canonical"]')!.getAttribute('href')).toContain(`${prefix}/pulse-dialogue/series/ideas`);
    expect(document.querySelectorAll('link[rel="alternate"]')).toHaveLength(4);
    expect(JSON.parse(view.container.querySelector('script')!.textContent!)['@type']).toBe('CollectionPage');
  });

  test('Series without owner or description remains a valid empty page', async () => {
    await show({ series: { ...series, articleCount: 0 }, total: 0, totalPages: 0 }, 'series');
    expect(screen.getByText('0 Articles')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Current Writer' })).toBeNull();
    expect(screen.getByText('No contributions published yet.')).toBeTruthy();
  });

  test.each(['contributors', 'series'] as const)('%s next-page navigation preserves language', async (kind) => {
    await show({ totalPages: 2, hasNextPage: true }, kind, 'gu');
    expect(screen.getByRole('link', { name: 'Next' }).getAttribute('href')).toBe(`/gu/pulse-dialogue/${kind}/${kind === 'series' ? 'ideas' : 'writer'}?page=2`);
    expect(screen.queryByRole('link', { name: 'Previous' })).toBeNull();
  });

  test('fallback story renders once using the shared story card', async () => {
    await show({ items: [{ _id: 'story', title: 'English fallback', slug: 'story', language: 'en', resolvedLang: 'en', isFallback: true, status: 'published' }] }, 'contributors', 'hi');
    expect(screen.getAllByRole('heading', { name: 'English fallback' })).toHaveLength(1);
    expect(screen.getByRole('heading', { name: 'English fallback' }).closest('a')!.getAttribute('href')).toBe('/news/story');
  });
});