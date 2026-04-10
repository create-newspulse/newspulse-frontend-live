import type { NextApiRequest, NextApiResponse } from 'next';
import { getDefaultReporterAuthProxyUrl, getReporterForwardCookieHeader, forwardReporterProxyCookies, readReporterProxyBody, resolveReporterAuthProxyTarget } from '../../../lib/reporterAuthProxy';
import {
  createChallengeCookie,
  createChallengeToken,
  createMagicLinkToken,
  createOtpCookie,
  createOtpToken,
  getReporterPortalAuthEnvPresence,
  generateOtpCode,
  getOtpExpiryIso,
  maskReporterEmail,
  normalizeReporterAuthEmail,
  ReporterPortalMailError,
  resolveReporterPortalFromEmail,
  resolveReporterPortalResendKey,
  resolveReporterPortalSmtpConfig,
  sendReporterPortalLoginEmail,
} from '../../../lib/reporterPortalAuth';

function authRouteLog(event: string, details?: Record<string, unknown>) {
  console.info(`[reporter-auth/request-code] ${event}`, details || {});
}

function authRouteError(event: string, details?: Record<string, unknown>) {
  console.error(`[reporter-auth/request-code] ${event}`, details || {});
}

function toLogSnippet(value: string, maxLength = 280): string {
  const normalized = String(value || '').replace(/\s+/g, ' ').trim();
  if (!normalized) return '';
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength)}...` : normalized;
}

function setReporterAuthProxyDebugHeader(res: NextApiResponse, target: { source: string; reason: string }) {
  try {
    res.setHeader('X-Reporter-Auth-Proxy', `${target.source}:${target.reason}`);
  } catch {}
}

function resolveSiteUrl(req: NextApiRequest): string {
  const raw = String(
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    ''
  ).trim().replace(/\/+$/, '');

  if (raw) {
    if (/^https?:\/\//i.test(raw)) return raw;
    return `https://${raw}`;
  }

  const forwardedProto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  const forwardedHost = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return `${forwardedProto}://${forwardedHost}`.replace(/\/+$/, '');
}

async function proxyRequestCodeAttempt(options: {
  req: NextApiRequest;
  res: NextApiResponse;
  targetUrl: string;
  method: string;
  forwardedCookie: string;
  proxyRequestBody: string;
  attemptLabel: 'primary' | 'prod_retry';
  requestId: string;
}) {
  const { req, targetUrl, method, forwardedCookie, proxyRequestBody, attemptLabel, requestId } = options;
  authRouteLog('proxy request start', {
    targetUrl,
    method,
    requestId,
    attemptLabel,
    bodyPresent: Boolean(proxyRequestBody),
    credentialsIncluded: Boolean(forwardedCookie),
    forwardedHeaders: {
      accept: 'application/json',
      contentType: 'application/json',
      hasCookie: Boolean(forwardedCookie),
      requestId,
    },
    requestBodySnippet: toLogSnippet(proxyRequestBody),
  });

  const upstream = await fetch(targetUrl, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'X-Reporter-Request-Id': requestId,
      ...(forwardedCookie ? { cookie: forwardedCookie } : {}),
    },
    body: proxyRequestBody,
  });
  const { data, text } = await readReporterProxyBody(upstream);
  const upstreamBodySnippet = toLogSnippet(text || (data ? JSON.stringify(data) : ''));
  authRouteLog('proxy request end', {
    targetUrl,
    method,
    requestId,
    attemptLabel,
    upstreamStatus: upstream.status,
    backendCode: String(data?.code || data?.message || '').trim() || null,
    credentialsIncluded: Boolean(forwardedCookie),
    upstreamResponseBodySnippet: upstreamBodySnippet || null,
  });

  return { upstream, data, text, upstreamBodySnippet };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  authRouteLog('request received', {
    method: req.method,
    host: req.headers.host || '',
    forwardedHost: req.headers['x-forwarded-host'] || '',
    forwardedProto: req.headers['x-forwarded-proto'] || '',
    nodeEnv: process.env.NODE_ENV || '',
    vercelEnv: process.env.VERCEL_ENV || '',
  });

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'METHOD_NOT_ALLOWED' });
  }

  const email = normalizeReporterAuthEmail(req.body?.email);
  const proxyTarget = resolveReporterAuthProxyTarget('/api/reporter-auth/request-code', req);
  const backendUrl = proxyTarget.url;
  const envPresence = getReporterPortalAuthEnvPresence();
  let shouldUseLocalFallback = false;
  const method = 'POST';
  const forwardedCookie = getReporterForwardCookieHeader(req);
  const proxyRequestBody = JSON.stringify({ email });
  const requestId = String(req.headers['x-reporter-request-id'] || '').trim() || `srv-${Date.now()}`;
  const defaultBackendUrl = getDefaultReporterAuthProxyUrl('/api/reporter-auth/request-code');
  const isDuplicateBrowserRequest = Boolean(String(req.headers['x-reporter-request-duplicate'] || '').trim() === '1');
  authRouteLog('email normalized', { email: maskReporterEmail(email) });
  authRouteLog('env presence check', {
    ...envPresence,
    hasSiteUrl: Boolean(
      String(
        process.env.NEXT_PUBLIC_SITE_URL ||
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.SITE_URL ||
        process.env.VERCEL_PROJECT_PRODUCTION_URL ||
        ''
      ).trim()
    ),
  });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    authRouteLog('final response sent', { status: 400, message: 'VALID_EMAIL_REQUIRED' });
    return res.status(400).json({ ok: false, code: 'INVALID_EMAIL', message: 'VALID_EMAIL_REQUIRED' });
  }

  authRouteLog('proxy target resolved', {
    targetUrl: proxyTarget.url,
    targetBase: proxyTarget.base,
    targetSource: proxyTarget.source,
    targetReason: proxyTarget.reason,
    method,
    requestId,
    bodyPresent: Boolean(proxyRequestBody),
    duplicateClientCall: isDuplicateBrowserRequest,
    stableProdFallbackUrl: defaultBackendUrl,
  });

  if (backendUrl) {
    try {
      let proxyAttempt = await proxyRequestCodeAttempt({
        req,
        res,
        targetUrl: backendUrl,
        method,
        forwardedCookie,
        proxyRequestBody,
        attemptLabel: 'primary',
        requestId,
      });
      let { upstream, data, text, upstreamBodySnippet } = proxyAttempt;

      if (!upstream.ok && (upstream.status || 500) >= 500 && backendUrl !== defaultBackendUrl) {
        authRouteError('proxy request failed, retrying stable production target', {
          targetUrl: backendUrl,
          retryTargetUrl: defaultBackendUrl,
          method,
          requestId,
          upstreamStatus: upstream.status,
          backendCode: String(data?.code || data?.message || '').trim() || null,
          upstreamResponseBodySnippet: upstreamBodySnippet || null,
          fallbackReason: 'primary_upstream_5xx',
        });
        proxyAttempt = await proxyRequestCodeAttempt({
          req,
          res,
          targetUrl: defaultBackendUrl,
          method,
          forwardedCookie,
          proxyRequestBody,
          attemptLabel: 'prod_retry',
          requestId,
        });
        ({ upstream, data, text, upstreamBodySnippet } = proxyAttempt);
      }

      if (!upstream.ok) {
        if ((upstream.status || 500) >= 500) {
          authRouteError('proxy request failed, falling back to local delivery', {
            targetUrl: proxyAttempt.upstream.url,
            method,
            requestId,
            upstreamStatus: upstream.status,
            backendCode: String(data?.code || data?.message || '').trim() || null,
            upstreamResponseBodySnippet: upstreamBodySnippet || null,
            fallbackReason: 'upstream_5xx',
          });
          shouldUseLocalFallback = true;
        }
      }

      if (!upstream.ok && !shouldUseLocalFallback) {
        setReporterAuthProxyDebugHeader(res, { source: proxyTarget.source, reason: proxyTarget.reason });
        forwardReporterProxyCookies(res, upstream.headers);
        return res.status(upstream.status || 500).json(data || { ok: false, message: text || 'REPORTER_REQUEST_CODE_FAILED' });
      }

      if (!upstream.ok && shouldUseLocalFallback) {
        forwardReporterProxyCookies(res, upstream.headers);
      }

      if (!shouldUseLocalFallback) {
        forwardReporterProxyCookies(res, upstream.headers, [createChallengeCookie(createChallengeToken(email, data?.expiresAt))]);

        return res.status(200).json({ ...(data || {}), ok: data?.ok !== false, email: data?.email || email });
      }
    } catch (error: any) {
      authRouteError('proxy request failed', {
        targetUrl: backendUrl,
        method,
        requestId,
        error: error?.message || 'REPORTER_REQUEST_CODE_PROXY_FAILED',
        fallbackReason: 'proxy_exception',
      });

      if (backendUrl !== defaultBackendUrl) {
        try {
          authRouteError('proxy request exception, retrying stable production target', {
            targetUrl: backendUrl,
            retryTargetUrl: defaultBackendUrl,
            method,
            requestId,
            fallbackReason: 'proxy_exception_retry_prod_default',
          });
          const { upstream, data } = await proxyRequestCodeAttempt({
            req,
            res,
            targetUrl: defaultBackendUrl,
            method,
            forwardedCookie,
            proxyRequestBody,
            attemptLabel: 'prod_retry',
            requestId,
          });
          if (upstream.ok) {
            forwardReporterProxyCookies(res, upstream.headers, [createChallengeCookie(createChallengeToken(email, data?.expiresAt))]);
            return res.status(200).json({ ...(data || {}), ok: data?.ok !== false, email: data?.email || email });
          }
        } catch (retryError: any) {
          authRouteError('stable production target retry failed', {
            retryTargetUrl: defaultBackendUrl,
            method,
            requestId,
            error: retryError?.message || 'REPORTER_REQUEST_CODE_PROXY_RETRY_FAILED',
            fallbackReason: 'proxy_retry_exception',
          });
        }
      }

      shouldUseLocalFallback = true;
    }
  } else {
    setReporterAuthProxyDebugHeader(res, { source: proxyTarget.source, reason: proxyTarget.reason });
    authRouteError('proxy target unavailable, falling back to local delivery', {
      targetUrl: null,
      method,
      requestId,
      fallbackReason: 'backend_base_missing',
    });
  }

  try {
    const code = generateOtpCode();
    authRouteLog('otp generated', { email: maskReporterEmail(email), codeLength: code.length });
    const otpToken = createOtpToken(email, code);
    const magicLinkToken = createMagicLinkToken(email);
    const baseUrl = resolveSiteUrl(req);
    const loginPath = `/reporter/login?token=${encodeURIComponent(magicLinkToken)}`;
    const magicLink = `${baseUrl}${loginPath}`;
    authRouteLog('mail transport initialized', {
      provider: resolveReporterPortalResendKey() && resolveReporterPortalFromEmail() ? 'resend' : (resolveReporterPortalSmtpConfig() ? 'smtp' : null),
      hasResendKey: Boolean(resolveReporterPortalResendKey()),
      hasFromEmail: Boolean(resolveReporterPortalFromEmail()),
      hasSmtpConfig: Boolean(resolveReporterPortalSmtpConfig()),
      siteUrl: baseUrl,
      sendsViaBackend: false,
      requestId,
    });
    const delivery = await sendReporterPortalLoginEmail({ email, code, magicLink });
    authRouteLog('mail send completed', {
      email: maskReporterEmail(email),
      delivered: Boolean(delivery && 'delivered' in delivery && delivery.delivered),
      usedDebugCode: Boolean(delivery && 'debugCode' in delivery),
      provider: delivery.provider,
      requestId,
    });

    try {
      res.setHeader('Set-Cookie', [createOtpCookie(otpToken), createChallengeCookie(createChallengeToken(email))]);
      authRouteLog('otp cookie write success', { email: maskReporterEmail(email) });
    } catch (cookieError: any) {
      authRouteError('otp cookie write failure', {
        email: maskReporterEmail(email),
        error: cookieError?.message || 'COOKIE_WRITE_FAILED',
      });
      throw new ReporterPortalMailError('REPORTER_PORTAL_SESSION_STORE_FAILED', {
        category: 'SESSION_STORE_FAILED',
        source: 'session-store',
        code: 'REPORTER_PORTAL_SESSION_STORE_FAILED',
        cause: cookieError,
      });
    }

    authRouteLog('final response sent', { status: 200, message: 'OK', provider: delivery.provider });
    return res.status(200).json({
      ok: true,
      email,
      expiresAt: getOtpExpiryIso(),
      debugCode: 'debugCode' in delivery ? delivery.debugCode : undefined,
    });
  } catch (error: any) {
    const classifiedError = error instanceof ReporterPortalMailError ? error : new ReporterPortalMailError('REPORTER_PORTAL_EMAIL_SEND_FAILED', {
      category: 'UNKNOWN_EXCEPTION',
      source: 'unknown',
      code: String(error?.code || 'REPORTER_PORTAL_EMAIL_SEND_FAILED'),
      cause: error,
    });
    authRouteError('request failed', {
      email: maskReporterEmail(email),
      error: classifiedError.message,
      category: classifiedError.category,
      source: classifiedError.source,
      provider: classifiedError.provider,
      statusCode: classifiedError.statusCode,
      code: classifiedError.code,
      safeBody: classifiedError.safeBody,
      ...envPresence,
      siteUrl: resolveSiteUrl(req),
      sendsViaBackend: false,
      requestId,
    });
    authRouteLog('final response sent', { status: 503, message: 'REPORTER_PORTAL_EMAIL_SEND_FAILED', category: classifiedError.category });
    setReporterAuthProxyDebugHeader(res, { source: proxyTarget.source, reason: proxyTarget.reason });
    return res.status(503).json({ ok: false, code: classifiedError.code || 'REPORTER_EMAIL_UNAVAILABLE', message: classifiedError.message || 'REPORTER_PORTAL_EMAIL_SEND_FAILED' });
  }
}