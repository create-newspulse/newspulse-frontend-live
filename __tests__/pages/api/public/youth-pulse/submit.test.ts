/** @jest-environment node */
import handler from '../../../../../pages/api/public/youth-pulse/submit';
import { request, response } from '../../reporter-auth/contractFixtures';

it.each([true, false])('does not send or log a Youth story without a versioned Desk writer (founder closed: %s)', closed => {
  const network = jest.spyOn(global, 'fetch').mockResolvedValue(new Response(JSON.stringify({ ok: true, settings: { youthPulseSubmissionsClosed: closed } })));
  const info = jest.spyOn(console, 'info');
  const error = jest.spyOn(console, 'error');
  try {
    const { res, data } = response();
    handler(request('POST', { reporterEmail: 'fixture@example.invalid', story: 'private fixture' }), res);
    expect(data.status).toBe(503);
    expect(data.json).toEqual({ ok: false, code: 'YOUTH_INTAKE_UNAVAILABLE', message: 'Youth Pulse submissions are temporarily closed.' });
    expect([network, info, error].map(spy => spy.mock.calls)).toEqual([[], [], []]);
    const bad = response();
    handler(request('GET'), bad.res);
    expect(bad.data.status).toBe(405);
    expect(bad.data.headers.Allow).toBe('POST');
  } finally { jest.restoreAllMocks(); }
});
