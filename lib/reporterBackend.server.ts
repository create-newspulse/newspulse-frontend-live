import type { NextApiRequest } from 'next';
import { validDraftKey } from './reporterDraft';
import { getPublicApiBaseUrl } from './publicApiBase';
import { dispatchReporterOperation, hasReporterIngress } from './reporterRuntime.server';

export const PORTAL_PATH = '/api/reporter-portal';
export const REPORTER_COOKIES = ['reporter_portal_session', 'reporter_portal.sid', 'reporter_portal_login_challenge'] as const;
export const REVOCATION_LOCK = 'np_reporter_revocation_pending';
export type ReporterRequest = Pick<NextApiRequest, 'cookies' | 'headers'>;
type BackendOptions = { method?: string; body?: unknown; draftKey?: string };

export function reporterIngressAvailable(req: ReporterRequest): boolean {
  if (process.env.REPORTER_PORTAL_CONTRACT !== 'phase5ab' || !process.env.REPORTER_PHASE5E1_VERIFIED_ORIGIN) return false;
  try {
    const verified = process.env.REPORTER_PHASE5E1_VERIFIED_ORIGIN;
    if (verified !== reporterBackendOrigin(req) || verified !== getPublicApiBaseUrl() || !hasReporterIngress(verified)) return false;
    // Do not mask a conflicting active local alias behind resolver precedence.
    const configured = [process.env.REPORTER_AUTH_API_BASE, process.env.REPORTER_PORTAL_API_BASE, process.env.REPORTER_AUTH_BACKEND_URL,
      process.env.REPORTER_PORTAL_BACKEND_URL, process.env.NEXT_PUBLIC_API_BASE, process.env.NEXT_PUBLIC_API_BASE_DEV, process.env.NEXT_PUBLIC_API_URL,
      process.env.NEXT_PUBLIC_BACKEND_URL, process.env.NEXT_PUBLIC_API_BASE_URL, process.env.NEXT_PUBLIC_BACKEND_API_BASE_URL,
      process.env.BACKEND_API_BASE_URL, process.env.NEWS_PULSE_BACKEND_URL, process.env.API_BASE_URL];
    return configured.every(value => !value || [verified, `${verified}/`, `${verified}/api`, `${verified}/api/`].includes(value));
  } catch { return false; }
}

export function reporterProductionDeployment(): boolean {
  return process.env.VERCEL_ENV === 'production'
    || /^(prod|production)$/i.test(process.env.NEWS_PULSE_DEPLOYMENT || process.env.NEWS_PULSE_ENV || '');
}

export function reporterBackendOrigin(req: ReporterRequest): string {
  const prod = reporterProductionDeployment();
  const raw = process.env.REPORTER_AUTH_API_BASE || process.env.REPORTER_PORTAL_API_BASE
    || process.env.REPORTER_AUTH_BACKEND_URL || process.env.REPORTER_PORTAL_BACKEND_URL
    || process.env.NEXT_PUBLIC_API_BASE
    || (prod ? process.env.NEXT_PUBLIC_API_BASE_PROD : process.env.NEXT_PUBLIC_API_BASE_DEV);
  const url = new URL(raw || '');
  const loopback = (host: string) => ['localhost', '127.0.0.1', '[::1]'].includes(host.toLowerCase());
  const localRequest = /^(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/i.test(req.headers.host || '');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password
    || !/^\/(?:api\/?)?$/.test(url.pathname) || url.search || url.hash
    || url.host.toLowerCase() === req.headers.host?.toLowerCase()
    || /(?:^|\.)(?:vercel\.app|newspulse\.co\.in)$/i.test(url.hostname) && !/^api\.newspulse\.co\.in$/i.test(url.hostname)
    || ((!prod || localRequest) && !loopback(url.hostname))
    || (prod && (url.protocol !== 'https:' || loopback(url.hostname)))) {
    throw new Error('REPORTER_BACKEND_UNAVAILABLE');
  }
  return url.origin;
}

const safeValue = /^[\x21\x23-\x2B\x2D-\x3A\x3C-\x5B\x5D-\x7E]*$/;
export function validReporterCookieValue(value: string): boolean {
  return value.length <= 4096 && safeValue.test(value);
}

function reporterCookies(req: ReporterRequest): Map<string, string> {
  const approved: readonly string[] = REPORTER_COOKIES;
  const result = new Map<string, string>();
  // Keep wire encoding (notably express-session's s%3A...). Never forward
  // the entire Cookie header, Authorization, or any client-provided X-*.
  if (typeof req.headers.cookie === 'string') {
    for (const part of req.headers.cookie.split(';')) {
      const pair = part.trim();
      const at = pair.indexOf('=');
      const name = pair.slice(0, at);
      if (at < 1 || !approved.includes(name)) continue;
      const value = pair.slice(at + 1);
      if (!validReporterCookieValue(value) || (result.has(name) && result.get(name) !== value)) {
        throw new Error('REPORTER_COOKIE_UNAVAILABLE');
      }
      result.set(name, value);
    }
  } else {
    for (const name of REPORTER_COOKIES) {
      const parsed = req.cookies?.[name];
      if (parsed === undefined) continue;
      if (typeof parsed !== 'string' || !validReporterCookieValue(encodeURIComponent(parsed))) {
        throw new Error('REPORTER_COOKIE_UNAVAILABLE');
      }
      result.set(name, encodeURIComponent(parsed));
    }
  }
  return result;
}

export function getReporterForwardCookieHeader(req: ReporterRequest): string {
  return Array.from(reporterCookies(req), ([key, value]) => `${key}=${value}`).join('; ');
}

export function hasReporterCredential(req: ReporterRequest): boolean {
  const cookies = reporterCookies(req);
  return !!(cookies.get(REPORTER_COOKIES[0]) || cookies.get(REPORTER_COOKIES[1]));
}

export function reporterLock(req: ReporterRequest): 'pending' | 'signed-out' | null {
  const marker = req.cookies?.np_reporter_logout;
  if (req.cookies?.[REVOCATION_LOCK] || marker === 'pending') return 'pending';
  return marker === 'signed-out' ? 'signed-out' : null;
}

function privateOperation(method: string, path: string): boolean {
  const route = path.slice(PORTAL_PATH.length);
  if (!path.startsWith(`${PORTAL_PATH}/`)) return method === 'POST' && /^\/api\/public\/community-reporter\/[a-fA-F0-9]{24}\/withdraw$/.test(path);
  if (method === 'GET') return ['/auth/session', '/auth/challenge-session', '/profile', '/dashboard/summary', '/submissions/stats', '/submissions'].includes(route)
    || /^\/submissions\/[a-fA-F0-9]{24}$/.test(route) || /^\/submissions\?page=[1-9]\d{0,6}&limit=(?:[1-9]\d?|100)$/.test(route);
  if (method === 'PATCH') return route === '/profile' || /^\/submissions\/[a-fA-F0-9]{24}$/.test(route);
  return method === 'POST' && ['/auth/request-login-otp', '/auth/verify-login-otp', '/auth/logout',
    '/profile/email/request-change', '/profile/email/confirm-change', '/submissions'].includes(route);
}

export function publicReporterBackendFetch(req: ReporterRequest, path: '/api/public/community/settings' | '/api/community-reporter/config' | '/api/community/submissions', body?: unknown): Promise<Response> {
  if (!reporterIngressAvailable(req) || (body === undefined
    ? !['/api/public/community/settings', '/api/community-reporter/config'].includes(path)
    : path !== '/api/community/submissions')) throw new Error('REPORTER_BACKEND_UNAVAILABLE');
  return dispatchReporterOperation(reporterBackendOrigin(req), path.slice(4), {
    method: body === undefined ? 'GET' : 'POST', headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export async function reporterBackendFetch(req: NextApiRequest, path: string, options?: BackendOptions): Promise<Response>;
export async function reporterBackendFetch(req: ReporterRequest, path: string, options?: BackendOptions): Promise<Response>;
export async function reporterBackendFetch(req: ReporterRequest, path: string, options: BackendOptions = {}): Promise<Response> {
  if (!reporterIngressAvailable(req)) throw new Error('REPORTER_BACKEND_UNAVAILABLE');
  // Only internal, fixed reporter paths are accepted. Never resolve an origin
  // from the incoming Host or follow an upstream redirect with credentials.
  if (!privateOperation(options.method || 'GET', path) || /[\s\\#%]/.test(path)) {
    throw new Error('REPORTER_BACKEND_UNAVAILABLE');
  }
  const lock = reporterLock(req);
  const logout = path === `${PORTAL_PATH}/auth/logout` && options.method === 'POST';
  const login = /^(?:\/api\/reporter-portal\/auth\/)(request-login-otp|verify-login-otp|challenge-session)$/.test(path);
  if (!logout && (lock === 'pending' || (lock === 'signed-out' && !login))) {
    throw new Error(lock === 'pending' ? 'LOGOUT_UNCONFIRMED' : 'REPORTER_SESSION_MISSING');
  }
  const cookie = getReporterForwardCookieHeader(req);
  const key = options.draftKey;
  if (key !== undefined && (!validDraftKey(key) || path !== `${PORTAL_PATH}/submissions` || options.method !== 'POST'
    || !options.body || typeof options.body !== 'object' || !('action' in options.body) || options.body.action !== 'draft')) {
    throw new Error('INVALID_DRAFT_REQUEST');
  }
  return dispatchReporterOperation(reporterBackendOrigin(req), path.slice(4), {
    method: options.method || 'GET',
    headers: { Accept: 'application/json', ...(cookie ? { cookie } : {}), ...(key ? { 'Idempotency-Key': key } : {}),
      ...(options.body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
}
