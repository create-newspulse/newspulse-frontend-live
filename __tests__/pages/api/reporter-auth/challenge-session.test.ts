/** @jest-environment node */
import challenge from '../../../../pages/api/reporter-auth/challenge-session';
import { backend, expiresAt, mockBackend, request, response, upstream } from './contractFixtures';

const fetchMock = mockBackend();
it('reports a server challenge only as pending, without query email, identifier or session authority', async () => {
  const { res, data } = response();
  fetchMock().mockResolvedValue(upstream({ ok: true, authenticated: false, challenge: { status: 'pending', expiresAt: expiresAt(), challengeId: 'private' } }));
  const req = request('GET');
  req.query = { email: 'ignored@example.test' };
  await challenge(req, res);
  expect(fetchMock()).toHaveBeenCalledWith(`${backend}/auth/challenge-session`, expect.objectContaining({ method: 'GET' }));
  expect(data.json).toEqual({ ok: true, authenticated: false, challenge: { status: 'pending' } });
});
