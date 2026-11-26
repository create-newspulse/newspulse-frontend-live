/** @jest-environment node */
import { reporterBackendFetch, publicReporterBackendFetch, reporterIngressAvailable } from '../../lib/reporterBackend.server';
import settings from '../../pages/api/public/community/settings';
import config from '../../pages/api/community-reporter/config';
import contributors from '../../pages/api/admin/community/contributors';
import { binding, mockBackend, origin, pin, proofBody, request, response, runtime, upstream } from '../pages/api/reporter-auth/contractFixtures';

const operations = mockBackend();
const credential = request('POST', undefined, { cookie: 'reporter_portal_session=fixture', authorization: 'do-not-forward', 'x-np-reporter-build': 'not-authority' });
const path = '/api/reporter-portal/submissions';
const write = () => reporterBackendFetch(credential, path, { method: 'POST', body: { action: 'submit', generalEthicsAccepted: true } });
const install = (dispatch: jest.Mock, overrides: Record<string, unknown> = {}) =>
  Object.defineProperty(process, binding, { configurable: true, value: { origin, buildId: pin, expiresAt: Date.now() + 60_000, dispatch, ...overrides } });

it.each(['missing binding','expired lease','unrecognized build','conflicting origin','hosted','conflicting deployment'])('denies before any network or operation: %s', async mode => {
  const hop = jest.fn();
  install(hop, mode === 'expired lease' ? { expiresAt: Date.now() } : mode === 'unrecognized build' ? { buildId: 'git-revision' } : {});
  if (mode === 'missing binding') Reflect.deleteProperty(process, binding);
  if (mode === 'conflicting origin') process.env.REPORTER_PORTAL_API_BASE = 'http://127.0.0.1:4444';
  if (mode === 'hosted') process.env.VERCEL_ENV = 'preview';
  if (mode === 'conflicting deployment') { process.env.NEWS_PULSE_DEPLOYMENT = 'local'; process.env.NEWS_PULSE_ENV = 'production'; }
  expect(reporterIngressAvailable(credential)).toBe(false);
  await expect(write()).rejects.toThrow();
  expect(hop).not.toHaveBeenCalled();
  expect(global.fetch).not.toHaveBeenCalled();
});

it.each(['old response','missing capability','conflicting build','wrong contract','cacheable','stale','expired after probe'])('rejects %s without passing credentials or story to an operation', async mode => {
  const body = mode === 'old response' ? { ok: true } : { ...proofBody, ...(mode === 'missing capability' ? { capabilities: proofBody.capabilities.slice(1) } : {}) };
  const proof = upstream(body);
  if (mode === 'conflicting build') proof.headers.set('X-NP-Reporter-Build', 'sha256:' + '0'.repeat(64));
  if (mode === 'wrong contract') proof.headers.set('X-NP-Reporter-Contract', 'other');
  if (mode === 'cacheable') proof.headers.delete('CDN-Cache-Control');
  if (mode === 'stale') proof.headers.set('Age', '8');
  const hop = jest.fn(async () => {
    if (mode === 'expired after probe') Reflect.deleteProperty(process, binding);
    return proof;
  });
  install(hop);
  await expect(write()).rejects.toThrow();
  expect(hop.mock.calls).toEqual([[`${runtime}/contract`, { method: 'GET', headers: { Accept: 'application/json' },
    cache: 'no-store', credentials: 'omit', redirect: 'error', signal: expect.any(AbortSignal) }]]);
  expect(global.fetch).not.toHaveBeenCalled();
});

it('rechecks membership before every dispatch, including a change immediately after a good anonymous probe', async () => {
  let compatible = true;
  const delivered: string[] = [];
  const hop = jest.fn(async (url: string) => {
    if (!compatible) throw Error('pool changed');
    delivered.push(url);
    compatible = false;
    return upstream(proofBody);
  });
  install(hop);
  await expect(write()).rejects.toThrow();
  expect(delivered).toEqual([`${runtime}/contract`]);
  expect(global.fetch).not.toHaveBeenCalled();
});

it('treats an invalid receipt as uncertain; never retries, follows a redirect or switches origins', async () => {
  const damaged = upstream({ ok: true }, 201);
  damaged.headers.delete('X-NP-Reporter-Build');
  const hop = jest.fn().mockResolvedValueOnce(upstream(proofBody)).mockResolvedValueOnce(damaged);
  install(hop);
  await expect(write()).rejects.toThrow();
  expect(hop.mock.calls.map(call => call[0])).toEqual([`${runtime}/contract`, `${runtime}/reporter-portal/submissions`]);
  expect(hop.mock.calls[1][1]).toMatchObject({ method: 'POST', redirect: 'error', credentials: 'omit', headers: {
    cookie: 'reporter_portal_session=fixture', 'X-NP-Reporter-Build': pin,
  } });
  expect(hop.mock.calls[1][1].headers).not.toHaveProperty('authorization');
  expect(global.fetch).not.toHaveBeenCalled();
});

it('does not cache readiness across settings reads; a cache miss or bad contract closes both switches', async () => {
  const flags = { communityReporterEnabled: true, allowMyStoriesPortal: true, allowNewSubmissions: true, allowJournalistApplications: false,
    communityReporterClosed: false, reporterPortalClosed: false };
  const hop = jest.fn().mockResolvedValueOnce(upstream(proofBody)).mockResolvedValueOnce(upstream({ ok: true, settings: flags })).mockResolvedValueOnce(upstream({ ok: true }));
  install(hop);
  const req = request('GET', undefined, credential.headers as Record<string,string>);
  const good = response(), bad = response();
  await settings(req, good.res);
  await settings(req, bad.res);
  expect(good.data.json.settings.allowNewSubmissions).toBe(true);
  expect(bad.data.status).toBe(503);
  expect(bad.data.json).toMatchObject({ ok: false, settings: { allowMyStoriesPortal: false, allowNewSubmissions: false } });
  expect(hop.mock.calls.map(row => row[0])).toEqual([`${runtime}/contract`, `${runtime}/public/community/settings`, `${runtime}/contract`]);
  expect(hop.mock.calls[1][1].headers).toEqual({ Accept: 'application/json', 'X-NP-Reporter-Build': pin });
});

it('uses versioned public config and staff directory with separate credentials, not reporter cookies', async () => {
  const publicFlags = { communityMyStoriesEnabled: true, communityReporterClosed: false, communityReporterEnabled: true, reporterPortalClosed: false, reporterPortalEnabled: true };
  operations().mockResolvedValueOnce(upstream({ ok: true, ...publicFlags, internalComment: 'not a public flag' })).mockResolvedValueOnce(upstream({ ok: false }, 403));
  const req = request('GET', undefined, { cookie: 'np_admin_token=fixture; reporter_portal_session=other; theme=dark' });
  req.query = { page: '2' };
  const pub = response(), staff = response();
  await config(req, pub.res);
  await contributors(req, staff.res);
  expect(pub.data.json).toEqual({ ok: true, ...publicFlags });
  expect(staff.data.status).toBe(403);
  expect(operations().mock.calls.map(([url, init]) => [url, init.headers.cookie])).toEqual([
    [origin + runtime + '/community-reporter/config', undefined], [origin + runtime + '/admin/community/contributors?page=2', 'np_admin_token=fixture'],
  ]);
  await expect(reporterBackendFetch(req, '/api/reporter-portal/register', { method: 'POST', body: {} })).rejects.toThrow();
  expect(() => publicReporterBackendFetch(req, '/api/community/submissions')).toThrow();
  expect(operations()).toHaveBeenCalledTimes(2);
});
