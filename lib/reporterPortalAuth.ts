import type { NextApiRequest, NextApiResponse } from 'next';
import { PORTAL_PATH, hasReporterCredential, reporterBackendFetch, reporterIngressAvailable, reporterLock, type ReporterRequest } from './reporterBackend.server';
import { apiMethod, record, reporterJson, revokedReporterCookies, sanitizedReporterCookies, upstreamDenial } from './reporterAuthProxy';
import type { ReporterPortalSession } from './reporterPortal';

export function normalizeReporterAuthEmail(value: unknown): string {
  if (typeof value !== 'string') return '';
  const email = value.trim().toLowerCase();
  return email.length <= 254 && email.indexOf('@') <= 64 && !email.includes('..')
    && /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+$/i.test(email) ? email : '';
}
export function validReporterId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{24}$/i.test(value);
}
export function validExpiry(value: unknown): value is string {
  return typeof value === 'string' && Date.parse(value) > Date.now();
}

type Denial = { ok: false; reason: string; status: number; code: string };
const deny = (status: number, reason: string): Denial => ({ ok: false, status, reason, code: reason });

export async function requireReporterSession(req: ReporterRequest, _options?: { route?: string }): Promise<
  { ok: true; reporter: ReporterPortalSession } | Denial
> {
  try {
    const lock = reporterLock(req);
    if (lock === 'pending') return deny(409, 'LOGOUT_UNCONFIRMED');
    if (lock === 'signed-out') return deny(401, 'REPORTER_SESSION_MISSING');
    if (!hasReporterCredential(req)) return deny(401, 'REPORTER_SESSION_MISSING');
    if (!reporterIngressAvailable(req)) return deny(503, 'REPORTER_UNAVAILABLE');
    const upstream = await reporterBackendFetch(req, `${PORTAL_PATH}/auth/session`);
    const data = await reporterJson(upstream);
    if (!upstream.ok) {
      const { status, reason } = upstreamDenial(upstream.status, data.code);
      return deny(status, reason);
    }
    const reporter = record(data.reporter);
    const session = record(data.session);
    const summary = record(data.summary);
    const email = normalizeReporterAuthEmail(reporter.email);
    if (upstream.status !== 200 || data.ok !== true || (data.authenticated !== undefined && data.authenticated !== true)
      || data.challenge != null || session.status === 'pending' || !validReporterId(reporter.id)
      || !email || reporter.email !== email || !['active', 'watchlist'].includes(String(reporter.status))
      || reporter.portalAccessEnabled === false || !validExpiry(session.expiresAt)
      || typeof summary.received !== 'number' || !Number.isSafeInteger(summary.received) || summary.received < 0
      || typeof summary.totalSubmissions !== 'number' || !Number.isSafeInteger(summary.totalSubmissions)
      || summary.received > summary.totalSubmissions) {
      return deny(401, 'REPORTER_SESSION_MISSING');
    }
    return {
      ok: true,
      reporter: {
        accountId: reporter.id, email, expiresAt: session.expiresAt,
        ...(typeof reporter.fullName === 'string' && reporter.fullName.length <= 256 ? { fullName: reporter.fullName } : {}),
      },
    };
  } catch {
    return deny(503, 'REPORTER_UNAVAILABLE');
  }
}

export async function loginAction(action: 'request-login-otp' | 'verify-login-otp' | 'challenge-session', req: NextApiRequest, res: NextApiResponse) {
  const challenge = action === 'challenge-session';
  const verify = action === 'verify-login-otp';
  if (!apiMethod(req, res, challenge ? 'GET' : 'POST')) return;
  if (reporterLock(req) === 'pending') return res.status(409).json({ ok: false, code: 'LOGOUT_UNCONFIRMED' });
  if (!reporterIngressAvailable(req)) return res.status(503).json({ ok: false, code: 'REPORTER_UNAVAILABLE' });
  const email = normalizeReporterAuthEmail(req.body?.email);
  const otp = req.body?.code;
  if (!challenge && !email) return res.status(400).json({ ok: false, code: 'EMAIL_REQUIRED' });
  if (verify && (typeof otp !== 'string' || !/^\d{6}$/.test(otp))) return res.status(400).json({ ok: false, code: 'OTP_REQUIRED' });
  try {
    const upstream = await reporterBackendFetch(req, `${PORTAL_PATH}/auth/${action}`, {
      method: challenge ? 'GET' : 'POST', body: challenge ? undefined : verify ? { email, otp } : { email },
    });
    const data = await reporterJson(upstream);
    if (upstream.status !== 200 || data.ok !== true) {
      const { status, reason } = upstreamDenial(upstream.status, data.code);
      return res.status(status).json({ ok: false, code: reason });
    }
    const cookies = sanitizedReporterCookies(upstream.headers, req);
    if (verify) {
      const identity = record(data.reporter);
      if (!validReporterId(identity.id) || identity.email !== email || !validExpiry(data.expiresAt)
        || !cookies.some(value => /^reporter_portal_session=[^;]+;/.test(value))) {
        return res.status(502).json({ ok: false, code: 'VERIFICATION_UNCONFIRMED' });
      }
    } else if (challenge && (data.authenticated !== false || record(data.challenge).status !== 'pending'
      || !validExpiry(record(data.challenge).expiresAt))) {
      return res.status(401).json({ ok: false, code: 'SESSION_EXPIRED' });
    }
    // A code request or pending challenge can never establish login authority.
    const allowed = verify ? cookies : cookies.filter(value => !value.startsWith('reporter_portal_session='));
    if (allowed.length) res.setHeader('Set-Cookie', allowed);
    return res.status(200).json(challenge ? { ok: true, authenticated: false, challenge: { status: 'pending' } }
      : verify ? { ok: true, accountId: record(data.reporter).id } : { ok: true });
  } catch {
    return res.status(503).json({ ok: false, code: 'REPORTER_UNAVAILABLE' });
  }
}

const PROFILE_FIELDS = ['fullName', 'phone', 'country', 'stateName', 'districtName', 'cityTownVillage'] as const;
export async function profileAction(action: 'profile' | 'request-change' | 'confirm-change', req: NextApiRequest, res: NextApiResponse) {
  const profile = action === 'profile';
  if (!apiMethod(req, res, ...(profile ? ['GET', 'PATCH'] : ['POST']))) return;
  const auth = await requireReporterSession(req);
  if (!auth.ok) return res.status(auth.status).json({ ok: false, code: auth.reason });
  if (req.headers['x-reporter-account'] !== auth.reporter.accountId) {
    return res.status(409).json({ ok: false, code: 'ACCOUNT_CHANGED' });
  }
  let body: Record<string, string> | undefined;
  if (req.method !== 'GET') {
    const input = record(req.body);
    body = {};
    if (profile) {
      if (Object.hasOwn(input, 'email')) return res.status(400).json({ ok: false, code: 'EMAIL_REVERIFICATION_REQUIRED' });
      if (!Object.keys(input).length || Object.keys(input).some(key => !(PROFILE_FIELDS as readonly string[]).includes(key))) {
        return res.status(400).json({ ok: false, code: 'INVALID_PROFILE' });
      }
      for (const key of PROFILE_FIELDS) {
        const val = input[key];
        if (val === undefined) continue;
        if (typeof val !== 'string' || val.length > 256) return res.status(400).json({ ok: false, code: 'INVALID_PROFILE' });
        body[key] = val.trim();
      }
    } else {
      body.email = normalizeReporterAuthEmail(input.email);
      if (!body.email || body.email === auth.reporter.email) return res.status(400).json({ ok: false, code: 'INVALID_NEW_EMAIL' });
      if (action === 'confirm-change') {
        if (typeof input.code !== 'string' || !/^\d{6}$/.test(input.code)) return res.status(400).json({ ok: false, code: 'OTP_REQUIRED' });
        body.otp = input.code;
      }
    }
  }
  try {
    const upstream = await reporterBackendFetch(req, `${PORTAL_PATH}/profile${profile ? '' : `/email/${action}`}`, { method: req.method, body });
    const data = await reporterJson(upstream);
    if (upstream.status !== 200 || data.ok !== true) {
      const { status, reason } = upstreamDenial(upstream.status, data.code);
      return res.status(status).json({ ok: false, code: reason });
    }
    if (action === 'request-change') return res.status(200).json({ ok: true });
    const result = record(data.profile);
    const expectedEmail = profile ? auth.reporter.email : body?.email;
    if (result.id !== auth.reporter.accountId || result.email !== expectedEmail
      || (action === 'confirm-change' && data.reverifyRequired !== true)) {
      return res.status(502).json({ ok: false, code: 'PROFILE_UNCONFIRMED' });
    }
    if (action === 'confirm-change') {
      res.setHeader('Set-Cookie', revokedReporterCookies(req));
      return res.status(200).json({ ok: true, reverifyRequired: true });
    }
    const fields: Record<string, string> = {};
    for (const key of PROFILE_FIELDS) {
      if (typeof result[key] === 'string') fields[key] = result[key];
    }
    // This read-only classification is distinct from mailbox verification.
    const verifiedJournalist = result.reporterType === 'journalist' && result.verificationLevel === 'verified';
    return res.status(200).json({ ok: true, profile: { accountId: auth.reporter.accountId, email: expectedEmail, verifiedJournalist, ...fields } });
  } catch {
    return res.status(503).json({ ok: false, code: 'REPORTER_UNAVAILABLE' });
  }
}
