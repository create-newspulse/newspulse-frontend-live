/** @jest-environment node */
import logout from '../../../../pages/api/reporter-auth/logout';
import { backend, logoutReceipt, mockBackend, request, response, upstream } from './contractFixtures';

const fetchMock = mockBackend();
const wire = 'reporter_portal_session=opaque-test; reporter_portal.sid=s%3Atest; reporter_portal_login_challenge=challenge-test';
it('revokes directly with all credentials before expiring any, including on locked retries', async () => {
  fetchMock().mockResolvedValue(upstream({ ok: true, message: 'Logged out successfully.' }, 200, [...logoutReceipt, 'arbitrary=ignore']));
  const { res, data } = response();
  await logout(request('POST', undefined, { cookie: wire + '; theme=light' }, { np_reporter_revocation_pending: '1' }), res);
  expect(fetchMock()).toHaveBeenCalledTimes(1);
  expect(fetchMock()).toHaveBeenCalledWith(`${backend}/auth/logout`, expect.objectContaining({ method: 'POST', headers: { Accept: 'application/json', cookie: wire, 'X-NP-Reporter-Build': process.env.REPORTER_RUNTIME_EXPECTED_BUILD } }));
  expect(data.json).toEqual({ ok: true, revoked: true });
  const cookies = data.headers['Set-Cookie'] as string[];
  for (const name of ['reporter_portal_session', 'reporter_portal.sid', 'reporter_portal_login_challenge', 'np_reporter_revocation_pending']) {
    expect(cookies).toContainEqual(expect.stringContaining(name + '=; Max-Age=0;'));
  }
  expect(cookies.join(' ')).not.toContain('arbitrary');
});
it.each([
  { kind: 'bare 200', cookies: [] },
  { kind: 'missing express sid clear on old backend', cookies: logoutReceipt.slice(1) },
  { kind: 'empty sid without expiry', cookies: ['reporter_portal.sid=; Path=/', ...logoutReceipt.slice(1)] },
  { kind: 'sid whose max-age overrides past expires', cookies: [logoutReceipt[0] + '; Max-Age=300', ...logoutReceipt.slice(1)] },
])('rejects an affirmative but incomplete logout receipt: $kind', async ({ cookies }) => {
  fetchMock().mockResolvedValue(upstream({ ok: true, message: 'Logged out successfully.' }, 200, cookies));
  const { res, data } = response();
  await logout(request('POST', undefined, { cookie: wire }), res);
  expect(data.status).toBe(503);
  expect(data.json.revoked).toBe(false);
  expect(data.headers['Set-Cookie']).toMatch(/^np_reporter_revocation_pending=1;/);
});
it.each(['missing gate', 'offline', 'malformed OK', 'upstream error'])('locks but retains every revocation credential on %s', async mode => {
  if (mode === 'missing gate') delete process.env.REPORTER_PORTAL_CONTRACT;
  if (mode === 'malformed OK' || mode === 'upstream error') fetchMock().mockResolvedValue(upstream({ ok: mode !== 'malformed OK' }, mode === 'upstream error' ? 503 : 200, ['reporter_portal_session=; Max-Age=0']));
  const { res, data } = response();
  await logout(request('POST', undefined, { cookie: wire }), res);
  expect(data.status).toBe(503);
  expect(data.json).toEqual({ ok: false, revoked: false, code: 'LOGOUT_UNCONFIRMED' });
  expect(data.headers['Set-Cookie']).toMatch(/^np_reporter_revocation_pending=1;/);
});
