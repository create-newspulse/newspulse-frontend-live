/** @jest-environment node */

import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import type { Article } from '../../lib/publicNewsApi';
import type { RouteLocale } from '../../lib/localizedArticleFields';
import { buildSocialImageUrl } from '../../lib/articleSocialImage';
import { PublicReadTimeoutError, withPublicReadDeadline } from '../../lib/publicReadDeadline';
import {
  PREVIEW_REQUEST_ID_HEADER, PREVIEW_TRACE_HEADER, readWithPreviewDiagnostics,
  startArticlePreviewDiagnostics, startBackendPreviewDiagnostics,
} from '../../lib/socialPreviewDiagnostics.server';

const trace = 'smart_share:00000000-0000-4000-8000-000000000000';
const siteUrl = 'https://www.newspulse.co.in';
const sensitive = 'private-person@example.invalid';

function exchange(headers: IncomingMessage['headers'] = {}) {
  const req = new IncomingMessage(new Socket());
  req.headers = headers;
  req.url = `/news/${sensitive}?token=private-token`;
  return { req, res: new ServerResponse(req) };
}

function article(language: RouteLocale, verified = false): Article & { status: 'published' } {
  const source = 'https://res.cloudinary.com/fixture/image/upload/v1/private-person.png';
  return {
    _id: '507f1f77bcf86cd799439011', language, status: 'published',
    title: sensitive, summary: `Private summary ${sensitive}`, content: `<p>${sensitive}</p>`,
    slug: 'private-person', category: 'private-category', coverImageUrl: source,
    ...(verified ? { socialImage: {
      source, url: buildSocialImageUrl(source, 75), type: 'image/jpeg' as const,
      width: 1200, height: 630, bytes: 12345,
    } } : {}),
  };
}

function records(): unknown[] {
  return [...jest.mocked(console.info).mock.calls, ...jest.mocked(console.error).mock.calls]
    .filter(([prefix]) => prefix === '[social-preview]')
    .map(([, json]) => JSON.parse(String(json)));
}

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-11-20T07:00:00.000Z') });
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

test.each(['en', 'hi', 'gu'] as const)('records %s rendering completion once without article or reader data', language => {
  const { req, res } = exchange({
    cookie: 'private-cookie', authorization: 'Bearer private-credential',
    'x-forwarded-for': '192.0.2.123', [PREVIEW_TRACE_HEADER]: trace,
  });
  const diagnostics = startArticlePreviewDiagnostics(req, res, language, 'article');
  expect(diagnostics).toBeDefined();
  diagnostics?.captureArticle(article(language, true), siteUrl);
  const correlationId = String(res.getHeader(PREVIEW_REQUEST_ID_HEADER));
  expect(correlationId).not.toBe(trace.split(':')[1]);
  expect(diagnostics?.requestHeaders[PREVIEW_TRACE_HEADER]).toBe(`article:${correlationId}`);
  expect(records()).toEqual([]);
  jest.advanceTimersByTime(125);
  res.emit('finish');
  res.emit('close');
  expect(records()).toEqual([expect.objectContaining({
    event: 'social_preview', phase: 'render', timestamp: '2026-11-20T07:00:00.000Z',
    correlationId, language, routeType: 'article', responseStatus: 200,
    completed: true, failure: null, ssrDurationMs: 125,
    openGraph: { complete: true, missingFields: [] },
    image: { selection: 'verified_article_image', fallback: false },
  })]);
  const serialized = JSON.stringify(records());
  for (const value of [sensitive, 'private-cookie', 'private-credential', 'private-token', '192.0.2.123', 'private-person', 'private-category', article(language)._id]) {
    expect(serialized).not.toContain(value);
  }
  expect(serialized).not.toContain('https://');
});

test('reports the official fallback and does not claim metadata after a failed response', () => {
  const first = exchange();
  startArticlePreviewDiagnostics(first.req, first.res, 'gu', 'smart_share')?.captureArticle(article('gu'), siteUrl);
  first.res.emit('finish');
  const second = exchange();
  const diagnostics = startArticlePreviewDiagnostics(second.req, second.res, 'hi', 'smart_share');
  diagnostics?.captureArticle(article('hi', true), siteUrl);
  diagnostics?.fail('timeout');
  second.res.statusCode = 503;
  second.res.emit('finish');
  expect(records()).toEqual([
    expect.objectContaining({ image: { selection: 'official_fallback', fallback: true }, openGraph: { complete: true, missingFields: [] } }),
    expect.objectContaining({ failure: 'timeout', responseStatus: 503, openGraph: { complete: null, missingFields: [] }, image: { selection: 'none', fallback: null } }),
  ]);
});

test('identifies incomplete Open Graph fields without logging their values', () => {
  const { req, res } = exchange();
  const unresolved = { ...article('en'), _id: 'legacy-without-canonical' };
  delete unresolved.slug;
  startArticlePreviewDiagnostics(req, res, 'en', 'article')?.captureArticle(unresolved, siteUrl);
  res.emit('finish');
  expect(records()).toEqual([expect.objectContaining({
    openGraph: { complete: false, missingFields: ['og:url'] },
  })]);
  expect(JSON.stringify(records())).not.toContain(sensitive);
  expect(JSON.stringify(records())).not.toContain(unresolved._id);
});

test('records an interrupted response once, without presenting it as a successful render', () => {
  const { req, res } = exchange();
  startArticlePreviewDiagnostics(req, res, 'en', 'smart_share')?.captureArticle(article('en'), siteUrl);
  jest.advanceTimersByTime(50);
  res.emit('close');
  res.emit('finish');
  expect(records()).toEqual([expect.objectContaining({
    completed: false, failure: 'response_closed', responseStatus: null,
    ssrDurationMs: 50, openGraph: { complete: null, missingFields: [] },
  })]);
});

test('correlates actual backend status and body-read time without forwarding or logging secrets', async () => {
  const root = exchange();
  const render = startArticlePreviewDiagnostics(root.req, root.res, 'hi', 'smart_share');
  const api = exchange({ ...render?.requestHeaders, cookie: sensitive, authorization: sensitive });
  const backend = startBackendPreviewDiagnostics(api.req, api.res, 'hi');
  const pending = readWithPreviewDiagnostics(backend, async recordStatus => {
    await new Promise(resolve => setTimeout(resolve, 10));
    recordStatus(200);
    await new Promise(resolve => setTimeout(resolve, 20));
    return sensitive;
  });
  await jest.advanceTimersByTimeAsync(30);
  await expect(pending).resolves.toBe(sensitive);
  backend?.imageFailure('cached_unavailable');
  backend?.imageFailure('cached_unavailable');
  api.res.emit('finish');
  root.res.emit('finish');
  expect(records()).toEqual([
    expect.objectContaining({
      phase: 'backend', correlationId: root.res.getHeader(PREVIEW_REQUEST_ID_HEADER),
      language: 'hi', routeType: 'smart_share', backendReadCount: 1,
      backendReads: [{ status: 200, durationMs: 30, completed: true, failure: null }],
      imageFailures: ['cached_unavailable'],
    }),
    expect.objectContaining({ phase: 'render', correlationId: root.res.getHeader(PREVIEW_REQUEST_ID_HEADER) }),
  ]);
  expect(JSON.stringify(records())).not.toContain(sensitive);
});

test('preserves deadline failures and logs no error messages, stacks or payloads', async () => {
  const { req, res } = exchange({ [PREVIEW_TRACE_HEADER]: trace });
  const diagnostics = startBackendPreviewDiagnostics(req, res, 'en');
  const pending = readWithPreviewDiagnostics(diagnostics, recordStatus =>
    withPublicReadDeadline(4000, async () => {
      recordStatus(200);
      await new Promise(() => {});
    }));
  const rejected = expect(pending).rejects.toBeInstanceOf(PublicReadTimeoutError);
  await jest.advanceTimersByTimeAsync(4000);
  await rejected;
  const privateError = new Error(`Credentials and content: ${sensitive}`);
  await expect(readWithPreviewDiagnostics(diagnostics, async () => { throw privateError; })).rejects.toBe(privateError);
  res.statusCode = 503;
  res.emit('finish');
  expect(records()).toEqual([expect.objectContaining({
    backendReads: [
      { status: 200, durationMs: 4000, completed: true, failure: 'timeout' },
      { status: null, durationMs: 0, completed: true, failure: 'request_failed' },
    ],
  })]);
  expect(JSON.stringify(records())).not.toContain(sensitive);
  expect(JSON.stringify(records())).not.toContain('stack');
});

test('bounds backend detail volume while retaining total attempt count', async () => {
  const { req, res } = exchange({ [PREVIEW_TRACE_HEADER]: trace });
  const diagnostics = startBackendPreviewDiagnostics(req, res, 'en');
  for (let index = 0; index < 12; index += 1) {
    await readWithPreviewDiagnostics(diagnostics, async recordStatus => { recordStatus(200); });
  }
  res.emit('finish');
  expect(records()).toEqual([expect.objectContaining({
    backendReadCount: 12, backendReadsTruncated: true,
    backendReads: Array.from({ length: 8 }, () => ({ status: 200, durationMs: 0, completed: true, failure: null })),
  })]);
});

test('skips Next data/prefetch traffic and ignores untrusted trace text on ordinary API reads', async () => {
  for (const headers of [{ 'x-nextjs-data': '1' }, { 'x-nextjs-prefetch': '1' }]) {
    const { req, res } = exchange(headers);
    expect(startArticlePreviewDiagnostics(req, res, 'en', 'article')).toBeUndefined();
    expect(res.getHeader(PREVIEW_REQUEST_ID_HEADER)).toBeUndefined();
    res.emit('finish');
  }
  for (const header of [undefined, sensitive, [trace], `article:${sensitive}`]) {
    const { req, res } = exchange({ [PREVIEW_TRACE_HEADER]: header });
    const diagnostics = startBackendPreviewDiagnostics(req, res, 'en');
    expect(diagnostics).toBeUndefined();
    await expect(readWithPreviewDiagnostics(diagnostics, async recordStatus => { recordStatus(200); return 42; })).resolves.toBe(42);
    res.emit('finish');
  }
  expect(records()).toEqual([]);
});
