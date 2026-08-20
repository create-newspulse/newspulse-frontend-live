import type { NextApiRequest, NextApiResponse } from 'next';
import { getPublicApiBaseUrl } from '../../../lib/publicApiBase';
import { getReporterForwardCookieHeader } from '../../../lib/reporterAuthProxy';
import { clearSessionCookie, normalizeReporterAuthEmail, requireReporterSession } from '../../../lib/reporterPortalAuth';

const UPSTREAM_PATH = '/api/public/community-reporter/my-stories';
const UPSTREAM_TIMEOUT_MS = 10_000;

function shouldLogReporterProxyDebug(): boolean {
  const isJest = Boolean((globalThis as any)?.jest) || (typeof process !== 'undefined' && Boolean((process.env as any)?.JEST_WORKER_ID));
  return process.env.NODE_ENV === 'development' && !isJest;
}

function logReporterMyStoriesInfo(details: Record<string, unknown>) {
  if (!shouldLogReporterProxyDebug()) {
    return;
  }
  // eslint-disable-next-line no-console
  console.info('[reporter-my-stories]', details);
}

function logReporterMyStoriesFetchError(error: any) {
  if (!shouldLogReporterProxyDebug()) {
    return;
  }
  // eslint-disable-next-line no-console
  console.error('[reporter-my-stories]', {
    stage: 'fetch-error',
    errorName: error?.name,
    errorCode: error?.cause?.code || error?.code || null,
    message: error?.message,
  });
}

function getFetchSignal(): AbortSignal | undefined {
  const timeout = (globalThis as any)?.AbortSignal?.timeout;
  return typeof timeout === 'function' ? timeout(UPSTREAM_TIMEOUT_MS) : undefined;
}

function getResponseCode(payload: any): string | null {
  return String(payload?.code || payload?.message || '').trim() || null;
}

function getStoriesFromPayload(payload: any): any[] {
  return Array.isArray(payload?.submissions)
    ? payload.submissions
    : Array.isArray(payload?.stories)
    ? payload.stories
    : Array.isArray(payload?.items)
    ? payload.items
    : Array.isArray(payload?.data?.submissions)
    ? payload.data.submissions
    : Array.isArray(payload?.data?.stories)
    ? payload.data.stories
    : [];
}

function hasStoriesCollection(payload: any): boolean {
  return Array.isArray(payload?.submissions)
    || Array.isArray(payload?.stories)
    || Array.isArray(payload?.items)
    || Array.isArray(payload?.data?.submissions)
    || Array.isArray(payload?.data?.stories);
}

function getStoryReporterOwner(story: any): string {
  return normalizeReporterAuthEmail(
    story?.reporterAccountId ||
    story?.reporterId ||
    story?.reporterEmail ||
    story?.email ||
    story?.reporter?.accountId ||
    story?.reporter?.email ||
    story?.submittedBy?.accountId ||
    story?.submittedBy?.email ||
    story?.author?.accountId ||
    story?.author?.email ||
    ''
  );
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const validation = await requireReporterSession(req, { route: '/api/community-reporter/my-stories' });
  if (!validation.ok) {
    if (validation.shouldClearCookie) res.setHeader('Set-Cookie', clearSessionCookie());
    return res.status(401).json({ ok: false, code: validation.code, message: validation.message });
  }

  const email = normalizeReporterAuthEmail(validation.reporter.email);
  const base = String(getPublicApiBaseUrl() || '').trim().replace(/\/+$/, '');
  if (!base) {
    console.error('[api/community-reporter/my-stories] backend base URL not configured');
    return res.status(500).json({ ok: false, message: 'BACKEND_URL_NOT_CONFIGURED' });
  }
  const targetUrl = `${base}${UPSTREAM_PATH}`;
  const forwardedCookie = getReporterForwardCookieHeader(req);
  const upstreamOrigin = (() => {
    try { return new URL(base).origin; } catch { return base; }
  })();

  try {
    logReporterMyStoriesInfo({
      origin: upstreamOrigin,
      path: UPSTREAM_PATH,
      stage: 'before-fetch',
    });

    const upstream = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        ...(forwardedCookie ? { cookie: forwardedCookie } : {}),
      },
      signal: getFetchSignal(),
    });

    logReporterMyStoriesInfo({
      stage: 'upstream-response',
      status: upstream.status,
    });

    const text = await upstream.text().catch(() => '');
    let json: any = null;
    let invalidJson = false;
    try { json = text ? JSON.parse(text) : null; } catch { invalidJson = true; }
    const responseCode = getResponseCode(json);
    const stories = getStoriesFromPayload(json);

    if (!upstream.ok) {
      const status = upstream.status || 500;
      const code = responseCode || (invalidJson ? 'REPORTER_STORIES_UPSTREAM_ERROR' : 'UPSTREAM_ERROR');
      return res.status(status).json(json || { ok: false, code, message: code });
    }

    if (invalidJson || !json || (stories.length === 0 && !hasStoriesCollection(json))) {
      const code = 'REPORTER_STORIES_INVALID_UPSTREAM_RESPONSE';
      return res.status(502).json({ ok: false, code });
    }

    try {
      const ownedSubmissions = stories.filter((story: any) => {
        const storyOwner = getStoryReporterOwner(story);
        return storyOwner === email;
      });
      return res.status(200).json({ submissions: ownedSubmissions });
    } catch (parseErr) {
      const code = 'REPORTER_STORIES_INVALID_UPSTREAM_RESPONSE';
      return res.status(502).json({ ok: false, code });
    }
  } catch (err) {
    const code = 'REPORTER_STORIES_UPSTREAM_UNAVAILABLE';
    logReporterMyStoriesFetchError(err);
    return res.status(502).json({ ok: false, code });
  }
}
