/** @jest-environment node */
import { getReporterForwardCookieHeader, sanitizedReporterCookies } from '../../lib/reporterAuthProxy';
import { reporterBackendFetch } from '../../lib/reporterBackend.server';
import { accountId, backend, mockBackend, pin, request, upstream } from '../pages/api/reporter-auth/contractFixtures';

const fetchMock = mockBackend();
const path = '/api/reporter-portal/auth/session';
const req = request('GET', undefined, { cookie: 'theme=light; reporter_portal.sid=s%3Atest; reporter_portal_session=opaque-test; reporter_portal_login_challenge=challenge-test; np_reporter_portal_session=legacy' });

it('uses only the contract cookies, keeps wire encoding, and sets a deadline, no-store and no redirects', async () => {
  fetchMock().mockResolvedValue(upstream({ ok: true }));
  await reporterBackendFetch(req, path);
  expect(fetchMock()).toHaveBeenCalledWith(backend + '/auth/session', expect.objectContaining({
    cache: 'no-store', redirect: 'error', signal: expect.any(AbortSignal),
    headers: { Accept: 'application/json', 'X-NP-Reporter-Build': pin, cookie: 'reporter_portal.sid=s%3Atest; reporter_portal_session=opaque-test; reporter_portal_login_challenge=challenge-test' },
  }));
  expect(getReporterForwardCookieHeader(request('GET', undefined, {}, { 'reporter_portal.sid': 's:test' }))).toBe('reporter_portal.sid=s%3Atest');
});

it.each(['', 'https://production.example.test', 'file:///unconfigured', 'http://localhost:3000', 'http://localhost:3010/other'])(
  'denies missing, remote and non-backend local configuration (%s), without fallback', async base => {
    process.env.REPORTER_AUTH_API_BASE = base;
    if (!base) delete process.env.NEXT_PUBLIC_API_BASE_DEV;
    process.env.NEXT_PUBLIC_ALLOW_PROD_BACKEND_IN_DEV = 'true';
    await expect(reporterBackendFetch(req, path)).rejects.toThrow();
    expect(fetchMock()).not.toHaveBeenCalled();
  });

it('will not treat a request host as deployment proof or select a production default', async () => {
  delete process.env.REPORTER_AUTH_API_BASE;
  process.env.VERCEL_ENV = 'production';
  await expect(reporterBackendFetch(request('GET', undefined, { host: 'frontend.example.test' }), path)).rejects.toThrow();
  expect(fetchMock()).not.toHaveBeenCalled();
});
it('5C configuration or a different origin cannot attest to the 5E.1 serving pool', async () => {
  for (const pin of ['', 'http://127.0.0.1:3011']) {
    process.env.REPORTER_PHASE5E1_VERIFIED_ORIGIN = pin;
    await expect(reporterBackendFetch(req, path)).rejects.toThrow();
  }
  process.env.REPORTER_PHASE5E1_VERIFIED_ORIGIN = process.env.REPORTER_AUTH_API_BASE;
  process.env.NEXT_PUBLIC_API_BASE_DEV = 'http://127.0.0.1:3011';
  await expect(reporterBackendFetch(req, path)).rejects.toThrow();
  expect(fetchMock()).not.toHaveBeenCalled();
});

it('rebuilds host-only cookies, preserving expiry but never unapproved names or attributes', () => {
  const headers = upstream({}, 200, [
    'reporter_portal_session=synthetic; Domain=backend.example.test; Path=/different; SameSite=None; Max-Age=90',
    'reporter_portal_login_challenge=; Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'unrelated=other; HttpOnly',
  ]).headers;
  const cookies = sanitizedReporterCookies(headers, request('GET', undefined, { 'x-forwarded-proto': 'https' }));
  expect(cookies).toEqual([
    'reporter_portal_session=synthetic; Max-Age=90; Path=/; HttpOnly; SameSite=Lax; Secure',
    'reporter_portal_login_challenge=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; HttpOnly; SameSite=Lax; Secure',
  ]);
});

it('permits only the exact authenticated withdraw transport exception', async () => {
  const withdraw = `/api/public/community-reporter/${accountId}/withdraw`;
  fetchMock().mockResolvedValue(upstream({ ok: true }));
  await reporterBackendFetch(req, withdraw, { method: 'POST' });
  await expect(reporterBackendFetch(req, withdraw, { method: 'GET' })).rejects.toThrow();
  await expect(reporterBackendFetch(req, '/api/public/community-reporter/other/withdraw', { method: 'POST' })).rejects.toThrow();
  await expect(reporterBackendFetch(request('POST', {}, {}, { np_reporter_logout: 'pending' }), withdraw, { method: 'POST' })).rejects.toThrow();
  expect(fetchMock()).toHaveBeenCalledTimes(1);
});
