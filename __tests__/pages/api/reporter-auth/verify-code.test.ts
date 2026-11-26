/** @jest-environment node */
import verify from '../../../../pages/api/reporter-auth/verify-code';
import verifyLink from '../../../../pages/api/reporter-auth/verify-link';
import { accountId, backend, email, expiresAt, mockBackend, request, response, upstream } from './contractFixtures';

const fetchMock = mockBackend();
it('verifies using email + otp, relays only sanitized credential cookies, exposes no token', async () => {
  const { res, data } = response();
  fetchMock().mockResolvedValue(upstream({ ok: true, reporter: { id: accountId, email }, token: 'synthetic', expiresAt: expiresAt() }, 200,
    ['reporter_portal_session=opaque-test; Domain=backend.example.test', 'reporter_portal.sid=s%3Atest; HttpOnly', 'not_reporter=ignore']));
  await verify(request('POST', { email, code: '000000', accountId: 'ignored' }), res);
  expect(fetchMock()).toHaveBeenCalledWith(`${backend}/auth/verify-login-otp`, expect.objectContaining({ method: 'POST', body: JSON.stringify({ email, otp: '000000' }) }));
  expect(data.json).toEqual({ ok: true, accountId });
  expect(data.headers['Set-Cookie']).toEqual(['reporter_portal_session=opaque-test; Path=/; HttpOnly; SameSite=Lax', 'reporter_portal.sid=s%3Atest; Path=/; HttpOnly; SameSite=Lax']);
});
it('does not mint a session from token-only success or an obsolete magic link', async () => {
  const { data, res } = response();
  fetchMock().mockResolvedValue(upstream({ ok: true, token: 'synthetic', reporter: { id: accountId, email }, expiresAt: expiresAt() }));
  await verify(request('POST', { email, code: '000000' }), res);
  expect(data.status).toBe(502);
  expect(data.headers['Set-Cookie']).toBeUndefined();
  verifyLink(request('POST'), res);
  expect(data.status).toBe(410);
  expect(fetchMock()).toHaveBeenCalledTimes(1);
});
