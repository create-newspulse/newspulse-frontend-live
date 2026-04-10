import type { NextApiRequest, NextApiResponse } from 'next';
import { getReporterForwardCookieHeader, forwardReporterProxyCookies, readReporterProxyBody, resolveReporterAuthProxyUrl } from '../../../lib/reporterAuthProxy';
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
  const backendUrl = resolveReporterAuthProxyUrl('/api/reporter-auth/request-code');
  const envPresence = getReporterPortalAuthEnvPresence();
  let shouldUseLocalFallback = false;
  const method = 'POST';
  const forwardedCookie = getReporterForwardCookieHeader(req);
  const proxyRequestBody = JSON.stringify({ email });
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

  if (backendUrl) {
    authRouteLog('proxy request start', {
      targetUrl: backendUrl,
      method,
      credentialsIncluded: Boolean(forwardedCookie),
      forwardedHeaders: {
        accept: 'application/json',
        contentType: 'application/json',
        hasCookie: Boolean(forwardedCookie),
      },
      requestBodySnippet: toLogSnippet(proxyRequestBody),
    });
    try {
      const upstream = await fetch(backendUrl, {
        method,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(forwardedCookie ? { cookie: forwardedCookie } : {}),
        },
        body: proxyRequestBody,
      });
      const { data, text } = await readReporterProxyBody(upstream);
      const upstreamBodySnippet = toLogSnippet(text || (data ? JSON.stringify(data) : ''));
      authRouteLog('proxy request end', {
        targetUrl: backendUrl,
        method,
        upstreamStatus: upstream.status,
        backendCode: String(data?.code || data?.message || '').trim() || null,
        credentialsIncluded: Boolean(forwardedCookie),
        upstreamResponseBodySnippet: upstreamBodySnippet || null,
      });

      if (!upstream.ok) {
        if ((upstream.status || 500) >= 500) {
          authRouteError('proxy request failed, falling back to local delivery', {
            targetUrl: backendUrl,
            method,
            upstreamStatus: upstream.status,
            backendCode: String(data?.code || data?.message || '').trim() || null,
            upstreamResponseBodySnippet: upstreamBodySnippet || null,
            fallbackReason: 'upstream_5xx',
          });
          shouldUseLocalFallback = true;
        }
      }

      if (!upstream.ok && !shouldUseLocalFallback) {
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
        error: error?.message || 'REPORTER_REQUEST_CODE_PROXY_FAILED',
        fallbackReason: 'proxy_exception',
      });
      shouldUseLocalFallback = true;
    }
  } else {
    authRouteError('proxy target unavailable, falling back to local delivery', {
      targetUrl: null,
      method,
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
    });
    const delivery = await sendReporterPortalLoginEmail({ email, code, magicLink });
    authRouteLog('mail send completed', {
      email: maskReporterEmail(email),
      delivered: Boolean(delivery && 'delivered' in delivery && delivery.delivered),
      usedDebugCode: Boolean(delivery && 'debugCode' in delivery),
      provider: delivery.provider,
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
    });
    authRouteLog('final response sent', { status: 503, message: 'REPORTER_PORTAL_EMAIL_SEND_FAILED', category: classifiedError.category });
    return res.status(503).json({ ok: false, code: classifiedError.code || 'REPORTER_EMAIL_UNAVAILABLE', message: classifiedError.message || 'REPORTER_PORTAL_EMAIL_SEND_FAILED' });
  }
}