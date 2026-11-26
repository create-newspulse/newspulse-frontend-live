/** @jest-environment node */
import requestCode from '../../../../pages/api/reporter-auth/request-code';
import { backend, email, mockBackend, request, response, upstream } from './contractFixtures';

const fetchMock = mockBackend();
it('maps the backend email request without disclosing codes or copying unrelated credentials', async () => {
  fetchMock().mockResolvedValue(upstream({ ok: true, devCode: '000000', traceId: 'test' }, 200,
    ['reporter_portal_login_challenge=test; Path=/api', 'reporter_portal_session=unexpected', 'unrelated=ignore']));
  const { data, res } = response();
  await requestCode(request('POST', { email: email.toUpperCase(), extra: 1 }), res);
  expect(fetchMock()).toHaveBeenCalledWith(`${backend}/auth/request-login-otp`, expect.objectContaining({ body: JSON.stringify({ email }), method: 'POST' }));
  expect(data.json).toEqual({ ok: true });
  expect(data.headers['Set-Cookie']).toEqual(['reporter_portal_login_challenge=test; Path=/; HttpOnly; SameSite=Lax']);
});
it.each(['disabled', 'offline'])('has no local OTP or mail fallback (%s)', async condition => {
  if (condition === 'disabled') delete process.env.REPORTER_PORTAL_CONTRACT;
  const { data, res } = response();
  await requestCode(request('POST', { email }), res);
  expect(data.status).toBe(503);
  expect(data.json.ok).toBe(false);
  expect(data.headers['Set-Cookie']).toBeUndefined();
  expect(fetchMock()).toHaveBeenCalledTimes(condition === 'disabled' ? 0 : 1);
});
