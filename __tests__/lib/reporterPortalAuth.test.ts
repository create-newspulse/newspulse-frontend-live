/** @jest-environment node */
import { requireReporterSession } from '../../lib/reporterPortalAuth';
import { accountId, backend, email, mockBackend, request, sessionBody, upstream } from '../pages/api/reporter-auth/contractFixtures';

const fetchMock = mockBackend();
const credential = request('GET', undefined, { cookie: 'reporter_portal_session=opaque-test' });

it('accepts only a fresh canonical backend identity, not the rest of the private payload', async () => {
  const body = sessionBody();
  fetchMock().mockResolvedValue(upstream({ ...body, sessionToken: 'synthetic', internal: { example: true } }));
  expect(await requireReporterSession(credential)).toEqual({ ok: true, reporter: { accountId, email, fullName: 'One', expiresAt: body.session.expiresAt } });
  expect(fetchMock()).toHaveBeenCalledWith(`${backend}/auth/session`, expect.anything());
});
it('denies challenge-only and local-only cookies; never tries a second provider when gated or offline', async () => {
  for (const cookie of ['np_reporter_portal_session=legacy', 'reporter_portal_login_challenge=pending']) {
    expect(await requireReporterSession(request('GET', undefined, { cookie }))).toMatchObject({ ok: false, status: 401 });
  }
  delete process.env.REPORTER_PORTAL_CONTRACT;
  expect(await requireReporterSession(request('GET'))).toMatchObject({ ok: false, status: 401, reason: 'REPORTER_SESSION_MISSING' });
  expect(await requireReporterSession(credential)).toMatchObject({ ok: false, status: 503 });
  expect(fetchMock()).not.toHaveBeenCalled();
  process.env.REPORTER_PORTAL_CONTRACT = 'phase5ab';
  expect(await requireReporterSession(credential)).toMatchObject({ ok: false, status: 503 });
  expect(fetchMock()).toHaveBeenCalledTimes(1);
});

it.each([
  { summary: {} }, { summary: { totalSubmissions: 2 } }, { summary: { totalSubmissions: 1, received: 2 } },
  { summary: { totalSubmissions: 1, received: -1 } }, { summary: { totalSubmissions: 1, received: 0.5 } },
  { authenticated: false }, { session: { status: 'pending' } }, { ok: false }, { session: { expiresAt: '2000-01-01T00:00:00Z' } },
  { reporter: { id: accountId, email, status: 'disabled' } }, { reporter: { email, status: 'active' } },
  { reporter: { id: accountId, email: [email], status: 'active' } }, { reporter: { id: accountId, email, status: 'active', portalAccessEnabled: false } },
])('fails closed on malformed, old or negative session evidence %#', async change => {
  fetchMock().mockResolvedValue(upstream({ ...sessionBody(), ...change }));
  expect(await requireReporterSession(credential)).toMatchObject({ ok: false, status: 401 });
});
it.each([401, 403, 503])('preserves a backend denial (%i) and never leaks upstream diagnostics', async status => {
  fetchMock().mockResolvedValue(upstream({ ...sessionBody(), message: 'synthetic diagnostic' }, status));
  const result = await requireReporterSession(credential);
  expect(result).toMatchObject({ ok: false, status });
  expect(JSON.stringify(result)).not.toContain('diagnostic');
});
