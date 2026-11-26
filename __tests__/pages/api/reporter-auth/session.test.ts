/** @jest-environment node */
import session from '../../../../pages/api/reporter-auth/session';
import { accountId, email, mockBackend, request, response, sessionBody, upstream } from './contractFixtures';

const fetchMock = mockBackend();
it('expires obsolete local credentials without authenticating or discarding backend revocation credentials', async () => {
  const { data, res } = response();
  await session(request('GET', undefined, {}, { np_reporter_portal_session: 'obsolete', unrelated: 'keep' }), res);
  expect(data.status).toBe(401);
  expect(data.headers['Set-Cookie']).toEqual([expect.stringMatching(/^np_reporter_portal_session=; Max-Age=0;/)]);
  expect(fetchMock()).not.toHaveBeenCalled();
});
it('returns a no-store affirmative session only after a backend-confirmed account', async () => {
  const { res, data } = response();
  const body = sessionBody();
  fetchMock().mockResolvedValue(upstream(body));
  await session(request('GET', undefined, { cookie: 'reporter_portal.sid=s%3Atest' }), res);
  expect(data.json).toEqual({ ok: true, authenticated: true, session: { accountId, email, fullName: 'One', expiresAt: body.session.expiresAt } });
  expect(data.headers['Cache-Control']).toContain('no-store');
});
it.each([['np_reporter_logout', 'pending', 409], ['np_reporter_revocation_pending', '1', 409], ['np_reporter_logout', 'signed-out', 401]] as const)(
  'blocks %s=%s before upstream, without clearing revocation credentials', async (key, value, status) => {
    const { data, res } = response();
    await session(request('GET', undefined, {}, { reporter_portal_session: 'synthetic', [key]: value }), res);
    expect(data.status).toBe(status);
    expect(fetchMock()).not.toHaveBeenCalled();
    expect(data.headers['Set-Cookie']).toBeUndefined();
  });
