import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { RouteLocale } from './localizedArticleFields';
import type { Article } from './publicNewsApi';
import { parseArticleSocialImage } from './articleSocialImage';
import { PublicReadTimeoutError } from './publicReadDeadline';
import { buildArticleSeoMetadata, NEWS_PULSE_BRAND_NAME } from './seo';

export const PREVIEW_TRACE_HEADER = 'x-newspulse-preview-trace';
export const PREVIEW_REQUEST_ID_HEADER = 'x-newspulse-preview-id';
const MAX_BACKEND_READS = 8;
const TRACE_PATTERN = /^(article|smart_share):([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})$/;

type RouteType = 'article' | 'smart_share';
type Phase = 'render' | 'backend';
type Failure = 'timeout' | 'http_error' | 'invalid_json' | 'request_failed' | 'response_closed'
  | 'invalid_article_response' | 'upstream_http_error' | 'request_or_render_error' | 'metadata_diagnostics_failed';
export type PreviewImageFailure = 'timeout' | 'unusable_response' | 'oversized' | 'missing_body'
  | 'invalid_format' | 'invalid_dimensions_or_format' | 'image_read_failed' | 'capacity'
  | 'cached_unavailable' | 'shared_unavailable';

type BackendRead = {
  startedAt: number;
  status: number | null;
  durationMs: number | null;
  failure: Failure | null;
};

type PreviewContext = {
  correlationId: string;
  language: RouteLocale;
  routeType: RouteType;
};

export type PreviewDiagnostics = {
  requestHeaders: Record<string, string>;
  readBackend<T>(read: (recordStatus: (status: number) => void) => Promise<T>): Promise<T>;
  captureArticle(article: Article, siteUrl: string): void;
  imageFailure(reason: PreviewImageFailure): void;
  fail(reason: Failure): void;
};

function elapsed(startedAt: number): number {
  return Math.max(0, Math.round(performance.now() - startedAt));
}

function readFailure(error: unknown): Failure {
  if (error instanceof PublicReadTimeoutError) return 'timeout';
  if (error instanceof SyntaxError) return 'invalid_json';
  return 'request_failed';
}

function articleFlags(article: Article, language: RouteLocale, siteUrl: string) {
  const metadata = buildArticleSeoMetadata(article, language, siteUrl);
  if (!metadata) return null;
  const fields = {
    'og:type': 'article',
    'og:site_name': NEWS_PULSE_BRAND_NAME,
    'og:locale': metadata.ogLocale,
    'og:title': metadata.ogTitle,
    'og:description': metadata.ogDescription,
    'og:url': metadata.ogUrl,
    'og:image': metadata.ogImage,
    'og:image:secure_url': metadata.ogImage,
    'og:image:type': metadata.ogImageType,
    'og:image:width': metadata.ogImageWidth,
    'og:image:height': metadata.ogImageHeight,
    'og:image:alt': metadata.ogImageAlt,
  };
  const missingFields = Object.entries(fields).filter(([, value]) =>
    typeof value === 'number' ? !Number.isFinite(value) || value <= 0 : !value.trim()
  ).map(([key]) => key);
  const verified = parseArticleSocialImage(article.socialImage);
  const fallback = !verified || metadata.ogImage !== verified.url;
  return {
    openGraph: { complete: missingFields.length === 0, missingFields },
    image: { selection: fallback ? 'official_fallback' : 'verified_article_image', fallback },
  };
}

function createDiagnostics(res: ServerResponse, context: PreviewContext, phase: Phase): PreviewDiagnostics {
  const timestamp = new Date().toISOString();
  const startedAt = performance.now();
  const backendReads: BackendRead[] = [];
  const imageFailures = new Set<PreviewImageFailure>();
  let backendReadCount = 0;
  let failure: Failure | null = null;
  let getArticleFlags: (() => ReturnType<typeof articleFlags>) | undefined;
  let emitted = false;

  const complete = (finished: boolean) => {
    if (emitted) return;
    emitted = true;
    res.removeListener('finish', onFinish);
    res.removeListener('close', onClose);
    const durationMs = elapsed(startedAt);
    const responseStatus = finished || res.headersSent ? res.statusCode : null;
    let responseFailure = !finished ? 'response_closed' : failure;
    if (!responseFailure && responseStatus && responseStatus >= 400 && ![404, 410].includes(responseStatus)) {
      responseFailure = 'http_error';
    }
    let flags: ReturnType<typeof articleFlags> = null;
    if (phase === 'render' && finished && responseStatus === 200 && getArticleFlags) {
      try {
        flags = getArticleFlags();
      } catch {
        responseFailure = 'metadata_diagnostics_failed';
      }
    }
    const record = {
      event: 'social_preview',
      phase,
      timestamp,
      ...context,
      responseStatus,
      completed: finished,
      failure: responseFailure,
      ...(phase === 'render' ? {
        ssrDurationMs: durationMs,
        openGraph: flags?.openGraph || { complete: null, missingFields: [] },
        image: flags?.image || { selection: 'none', fallback: null },
      } : {
        proxyDurationMs: durationMs,
        backendReadCount,
        backendReadsTruncated: backendReadCount > backendReads.length,
        backendReads: backendReads.map(read => ({
          status: read.status,
          durationMs: read.durationMs ?? elapsed(read.startedAt),
          completed: read.durationMs !== null,
          failure: read.failure,
        })),
        imageFailures: [...imageFailures],
      }),
    };
    if (responseFailure) console.error('[social-preview]', JSON.stringify(record));
    else console.info('[social-preview]', JSON.stringify(record));
  };
  const onFinish = () => complete(true);
  const onClose = () => complete(false);
  // Finish includes React rendering and response writing, not just getServerSideProps.
  res.once('finish', onFinish);
  res.once('close', onClose);

  return {
    requestHeaders: { [PREVIEW_TRACE_HEADER]: `${context.routeType}:${context.correlationId}` },
    async readBackend<T>(read: (recordStatus: (status: number) => void) => Promise<T>): Promise<T> {
      const span: BackendRead = { startedAt: performance.now(), status: null, durationMs: null, failure: null };
      backendReadCount += 1;
      if (backendReads.length < MAX_BACKEND_READS) backendReads.push(span);
      try {
        return await read(status => {
          if (span.durationMs !== null) return;
          span.status = status;
          if (status >= 400 && status !== 404 && status !== 410) span.failure = 'http_error';
        });
      } catch (error) {
        span.failure = span.failure || readFailure(error);
        failure = span.failure;
        throw error;
      } finally {
        span.durationMs = elapsed(span.startedAt);
      }
    },
    captureArticle(article, siteUrl) {
      getArticleFlags = () => articleFlags(article, context.language, siteUrl);
    },
    imageFailure(reason) { imageFailures.add(reason); },
    fail(reason) { failure = reason; },
  };
}

export function startArticlePreviewDiagnostics(
  req: IncomingMessage,
  res: ServerResponse,
  language: RouteLocale,
  routeType: RouteType,
): PreviewDiagnostics | undefined {
  if (req.headers['x-nextjs-data'] === '1' || req.headers['x-nextjs-prefetch'] === '1') return undefined;
  const correlationId = randomUUID();
  res.setHeader(PREVIEW_REQUEST_ID_HEADER, correlationId);
  return createDiagnostics(res, { correlationId, language, routeType }, 'render');
}

export function startBackendPreviewDiagnostics(
  req: IncomingMessage,
  res: ServerResponse,
  language: RouteLocale,
): PreviewDiagnostics | undefined {
  const header = req.headers[PREVIEW_TRACE_HEADER];
  const match = typeof header === 'string' ? TRACE_PATTERN.exec(header) : null;
  if (!match) return undefined;
  const routeType = match[1] === 'smart_share' ? 'smart_share' : 'article';
  return createDiagnostics(res, { correlationId: match[2], language, routeType }, 'backend');
}

export function readWithPreviewDiagnostics<T>(
  diagnostics: PreviewDiagnostics | undefined,
  read: (recordStatus: (status: number) => void) => Promise<T>,
): Promise<T> {
  return diagnostics ? diagnostics.readBackend(read) : read(() => {});
}
