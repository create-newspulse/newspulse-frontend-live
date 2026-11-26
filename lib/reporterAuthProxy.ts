import type { NextApiRequest, NextApiResponse } from 'next';
import { REPORTER_COOKIES, REVOCATION_LOCK, reporterProductionDeployment, validReporterCookieValue } from './reporterBackend.server';

export { getReporterForwardCookieHeader } from './reporterBackend.server';
const LEGACY_COOKIES = ['np_reporter_portal_session', 'np_reporter_portal_otp', 'np_reporter_portal_challenge'];
const SAFE_CODES = new Set([
  'SESSION_EXPIRED', 'REPORTER_SESSION_MISSING', 'REPORTER_PORTAL_CLOSED', 'REPORTER_PORTAL_FORBIDDEN',
  'OTP_REPLACED', 'OTP_EXPIRED', 'OTP_ALREADY_USED', 'INVALID_OTP', 'OTP_VERIFY_RATE_LIMITED',
  'OTP_REQUEST_RATE_LIMITED', 'REPORTER_EMAIL_UNAVAILABLE', 'EMAIL_UNCHANGED', 'EMAIL_ALREADY_IN_USE',
  'EMAIL_CHANGE_NOT_REQUESTED', 'EMAIL_REVERIFICATION_REQUIRED',
]);

export function noStore(res: { setHeader(name: string, value: string): unknown }) {
  res.setHeader('Cache-Control', 'private, no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
}

export function apiMethod(req: NextApiRequest, res: NextApiResponse, ...methods: string[]): boolean {
  noStore(res);
  if (!methods.includes(req.method || '')) {
    res.setHeader('Allow', methods.join(', '));
    res.status(405).json({ ok: false, code: 'METHOD_NOT_ALLOWED' });
    return false;
  }
  if (!['GET', 'HEAD'].includes(req.method || '') && req.headers.origin) {
    try {
      if (new URL(req.headers.origin).host !== req.headers.host) throw new Error();
    } catch {
      res.status(403).json({ ok: false, code: 'REQUEST_DENIED' });
      return false;
    }
  }
  return true;
}

export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export async function reporterJson(response: Response): Promise<Record<string, unknown>> {
  return record(await response.json().catch(() => null));
}

export function upstreamDenial(status: number, code: unknown) {
  return {
    status: [400, 401, 403, 404, 409, 429, 503].includes(status) ? status : 502,
    reason: typeof code === 'string' && SAFE_CODES.has(code) ? code
      : status === 401 ? 'REPORTER_SESSION_MISSING' : 'REPORTER_UNAVAILABLE',
  };
}

function cookiePolicy(req: ReporterRequestHeaders) {
  const secure = reporterProductionDeployment() || req.headers['x-forwarded-proto'] === 'https'
    || (req.socket as { encrypted?: boolean } | undefined)?.encrypted;
  return `Path=/; HttpOnly; SameSite=Lax${secure ? '; Secure' : ''}`;
}
type ReporterRequestHeaders = Pick<NextApiRequest, 'headers'> & Partial<Pick<NextApiRequest, 'socket'>>;

export function sanitizedReporterCookies(headers: Headers, req: ReporterRequestHeaders): string[] {
  const values = typeof headers.getSetCookie === 'function' ? headers.getSetCookie()
    : (headers.get('set-cookie') || '').split(/,(?=\s*[^;,=\s]+=)/);
  return values.flatMap(raw => {
    if (/[\r\n]/.test(raw)) return [];
    const [pair, ...attrs] = raw.split(';').map(s => s.trim());
    const at = pair.indexOf('=');
    if (at < 1 || !(REPORTER_COOKIES as readonly string[]).includes(pair.slice(0, at))
      || !validReporterCookieValue(pair.slice(at + 1))) return [];
    const expiry: string[] = [];
    for (const attr of attrs) {
      if (/^max-age=-?\d{1,12}$/i.test(attr)) expiry.push(`Max-Age=${Math.max(0, Number(attr.slice(8)))}`);
      if (/^expires=/i.test(attr)) {
        const time = Date.parse(attr.slice(8));
        if (Number.isFinite(time)) expiry.push(`Expires=${new Date(time).toUTCString()}`);
      }
    }
    return [[pair, ...expiry, cookiePolicy(req)].join('; ')];
  });
}

export function revokedReporterCookies(req: ReporterRequestHeaders): string[] {
  return [...REPORTER_COOKIES, ...LEGACY_COOKIES, REVOCATION_LOCK]
    .map(name => `${name}=; Max-Age=0; ${cookiePolicy(req)}`);
}

export function expireLegacyReporterCookies(req: NextApiRequest, res: NextApiResponse) {
  const obsolete = LEGACY_COOKIES.filter(name => req.cookies?.[name] !== undefined);
  if (obsolete.length) res.setHeader('Set-Cookie', obsolete.map(name => `${name}=; Max-Age=0; ${cookiePolicy(req)}`));
}

export function hasLogoutReceipt(headers: Headers, req: ReporterRequestHeaders): boolean {
  // Older backends also say {ok:true}. Only the lifecycle contract revokes
  // and explicitly expires *all three* credential channels (including .sid).
  const cookies = sanitizedReporterCookies(headers, req);
  return REPORTER_COOKIES.every(name => {
    const matches = cookies.filter(cookie => cookie.startsWith(`${name}=`));
    if (matches.length !== 1 || !matches[0].startsWith(`${name}=;`)) return false;
    const attrs = matches[0].split('; ');
    const age = attrs.filter(attr => attr.startsWith('Max-Age='));
    if (age.length) return age.length === 1 && age[0] === 'Max-Age=0';
    const expiry = attrs.filter(attr => attr.startsWith('Expires='));
    return expiry.length === 1 && Date.parse(expiry[0].slice(8)) <= Date.now();
  });
}

export function revocationRetryCookie(req: ReporterRequestHeaders): string {
  return `${REVOCATION_LOCK}=1; Max-Age=34560000; ${cookiePolicy(req)}`;
}
