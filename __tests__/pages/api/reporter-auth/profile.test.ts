/** @jest-environment node */
import profile from '../../../../pages/api/reporter-auth/profile';
import start from '../../../../pages/api/reporter-auth/profile/email/request-change';
import confirm from '../../../../pages/api/reporter-auth/profile/email/confirm-change';
import { accountId, backend, email, mockBackend, request, response, sessionBody, upstream } from './contractFixtures';

const fetchMock = mockBackend();
const headers = { cookie: 'reporter_portal_session=opaque-test', 'x-reporter-account': accountId };
const nextEmail = 'next@example.test';
it('loads only verified self-profile fields, and PATCH excludes login email and internal fields', async () => {
  const { res, data } = response();
  const raw = { id: accountId, email, phone: 'test', fullName: 'One', pendingPortalEmail: 'private', internal: true };
  for (const method of ['GET', 'PATCH']) {
    fetchMock().mockResolvedValueOnce(upstream(sessionBody())).mockResolvedValueOnce(upstream({ ok: true, profile: raw }));
    await profile(request(method, method === 'PATCH' ? { phone: ' test ' } : undefined, headers), res);
    expect(data.json).toEqual({ ok: true, profile: { accountId, email, phone: 'test', fullName: 'One', verifiedJournalist: false } });
    expect(fetchMock()).toHaveBeenLastCalledWith(`${backend}/profile`, expect.objectContaining({ method, ...(method === 'PATCH' ? { body: '{"phone":"test"}' } : {}) }));
  }
  fetchMock().mockResolvedValueOnce(upstream(sessionBody()));
  await profile(request('PATCH', { email: nextEmail }, headers), res);
  expect(data.status).toBe(400);
  expect(fetchMock()).toHaveBeenCalledTimes(5);
});
it.each([
  ['journalist', 'verified', true], ['community', 'verified', false], ['journalist', 'pending', false],
  ['journalist', 'limited', false], ['journalist', 'revoked', false], ['journalist', 'community_default', false], ['unknown', 'unknown', false],
])('projects a staff-only classification for %s/%s', async (reporterType, verificationLevel, expected) => {
  fetchMock().mockResolvedValueOnce(upstream(sessionBody())).mockResolvedValueOnce(upstream({
    ok: true, profile: { id: accountId, email, reporterType, verificationLevel, isVerified: true },
  }));
  const { res, data } = response();
  await profile(request('GET', undefined, headers), res);
  expect(data.json.profile.verifiedJournalist).toBe(expected);
});
it('denies account switch and mismatched upstream profile without returning either account’s data', async () => {
  const { data, res } = response();
  fetchMock().mockResolvedValueOnce(upstream(sessionBody()));
  await profile(request('PATCH', { phone: 'test' }, { ...headers, 'x-reporter-account': '222222222222222222222222' }), res);
  expect(data.status).toBe(409);
  expect(fetchMock()).toHaveBeenCalledTimes(1);
  fetchMock().mockResolvedValueOnce(upstream(sessionBody())).mockResolvedValueOnce(upstream({ ok: true, profile: { id: accountId, email: nextEmail } }));
  await profile(request('GET', undefined, headers), res);
  expect(data.status).toBe(502);
  expect(JSON.stringify(data.json)).not.toContain(nextEmail);
});
it('requires authenticated request then code confirmation and a positive reverifyRequired before clearing authority', async () => {
  const a = response(), b = response(), c = response();
  fetchMock().mockResolvedValueOnce(upstream(sessionBody())).mockResolvedValueOnce(upstream({ ok: true, devCode: '000000' }));
  await start(request('POST', { email: nextEmail }, headers), a.res);
  expect(fetchMock()).toHaveBeenLastCalledWith(`${backend}/profile/email/request-change`, expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: nextEmail }) }));
  expect(a.data.json).toEqual({ ok: true });
  expect(a.data.headers['Set-Cookie']).toBeUndefined();
  fetchMock().mockResolvedValueOnce(upstream(sessionBody())).mockResolvedValueOnce(upstream({ ok: true, reverifyRequired: false }));
  await confirm(request('POST', { email: nextEmail, code: '000000' }, headers), b.res);
  expect(b.data.status).toBe(502);
  expect(b.data.headers['Set-Cookie']).toBeUndefined();
  fetchMock().mockResolvedValueOnce(upstream(sessionBody())).mockResolvedValueOnce(upstream({ ok: true, reverifyRequired: true, profile: { id: accountId, email: nextEmail } }));
  await confirm(request('POST', { email: nextEmail, code: '000000' }, headers), c.res);
  expect(fetchMock()).toHaveBeenLastCalledWith(`${backend}/profile/email/confirm-change`, expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: nextEmail, otp: '000000' }) }));
  expect(c.data.json).toEqual({ ok: true, reverifyRequired: true });
  expect(c.data.headers['Set-Cookie']).toContainEqual(expect.stringContaining('reporter_portal_session=; Max-Age=0'));
});
