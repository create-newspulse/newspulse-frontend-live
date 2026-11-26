/** @jest-environment node */
import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../../../../pages/api/community/submissions';
import alias from '../../../../pages/api/community-reporter/submit';
import { communityReporterWriteGate } from '../../../../lib/communityReporterWriteGate.server';
import { requireReporterSession } from '../../../../lib/reporterPortalAuth';
import { reporterBackendFetch } from '../../../../lib/reporterBackend.server';
import { mockBackend, origin as base, runtime, pin, upstream } from '../reporter-auth/contractFixtures';

jest.mock('../../../../lib/reporterPortalAuth', () => ({ requireReporterSession: jest.fn() }));
jest.mock('../../../../lib/reporterBackend.server', () => ({
  ...jest.requireActual('../../../../lib/reporterBackend.server'), reporterBackendFetch: jest.fn(),
}));

const account = 'aaaaaaaaaaaaaaaaaaaaaaaa', id = 'bbbbbbbbbbbbbbbbbbbbbbbb', email = 'fixture@example.invalid';
const operations = mockBackend();
const gates = { communityReporterEnabled: true, allowNewSubmissions: true, allowMyStoriesPortal: true, communityReporterClosed: false, reporterPortalClosed: false };
const payload = { reporterEmail: email, reporterName: 'Fixture', headline: 'Test area', story: 'A synthetic local report used only to test the submission form boundary.',
  category: 'civic_issue', ageGroup: '41_plus', coverageScope: 'regional', generalEthicsAccepted: true, originalLanguage: 'hi',
  city: 'City', district: 'District', state: 'State', country: 'Country', reporterPhone: '1234567890', reporterWhatsApp: '9876543210', consentToContact: true, communityInterests: ['Civic'] };
const item = { id, status: 'PENDING_FOUNDER', headline: payload.headline, story: payload.story, category: 'Civic Issue',
  originalLanguage: 'hi', reviewStatus: 'SUBMITTED', publicationStatus: 'not_published', isPublished: false, publicUrl: null, editions: [], canEdit: false, reporterFeedback: null };
const response = (status: number, body: unknown) => upstream(body, status);
const req = (actor: string, body: unknown = payload, headers: Record<string, string> = {}) => ({
  method: 'POST', cookies: {}, headers: { 'content-type': 'application/json', 'x-reporter-account': actor, ...headers }, body,
} as unknown as NextApiRequest);
const res = () => {
  const r = { setHeader: jest.fn(), status: jest.fn(), json: jest.fn() };
  r.status.mockReturnValue(r);
  return r;
};
const auth = requireReporterSession as jest.Mock;
const privateWrite = reporterBackendFetch as jest.Mock;
let mode: Response, settings: Response, guestWrite: Response;
let fetchMock: jest.Mock;
async function run(request: NextApiRequest, endpoint = handler) {
  const result = res(); await endpoint(request, result as unknown as NextApiResponse); return result;
}
const posts = () => operations().mock.calls.filter(([, init]) => init?.method === 'POST');
beforeEach(() => {
  jest.clearAllMocks();
  auth.mockResolvedValue({ ok: true, reporter: { accountId: account, email } });
  mode = response(200, { ok: true, mode: 'NORMAL', readOnly: false });
  settings = response(200, { ok: true, settings: gates });
  guestWrite = response(201, { ok: true, success: true, item: { ...item, privateNotes: 'secret' } });
  fetchMock = jest.fn(async url => {
    if (url === `${base}/api/system/public-mode`) return mode.clone();
    throw new Error('Unexpected direct request');
  });
  operations().mockImplementation(async (url, init) => {
    if (url === `${base}${runtime}/public/community/settings`) return settings.clone();
    if (url === `${base}${runtime}/community/submissions` && init?.method === 'POST') return guestWrite.clone();
    throw new Error('Unexpected request');
  });
  global.fetch = fetchMock;
  privateWrite.mockResolvedValue(response(201, { ok: true, item }));
});

it.each([handler, alias])('sends guests to public intake without cookies, forged owners or verification; projects the durable receipt', async endpoint => {
  const result = await run(req('guest', { ...payload, reporterAccountId: account, reporterProfileId: account,
    reporterVerificationLevel: 'journalist_verified', submittedByAccountId: account, status: 'APPROVED' }, { cookie: 'unrelated=private' }), endpoint);
  expect(result.status).toHaveBeenCalledWith(201);
  expect(result.json).toHaveBeenCalledWith({ ok: true, referenceId: id, actor: 'guest' });
  expect(result.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-store');
  expect(privateWrite).not.toHaveBeenCalled();
  const [[, init]] = posts();
  expect(init.headers).not.toHaveProperty('cookie'); expect(init.redirect).toBe('error');
  expect(JSON.parse(init.body)).toEqual({
    headline: payload.headline, story: payload.story, category: 'Civic Issue', originalLanguage: 'hi',
    reporterName: 'Fixture', email, city: 'City', district: 'District', state: 'State', country: 'Country', ageGroup: '41+',
    contact: { phone: '1234567890', canContactForThisStory: true, canContactForFutureStories: false },
    confirmTruthful: true, confirmEditorialReviewAllowed: true,
  });
});
it('does not dispatch even guest data to an old writer or a different, unverified public origin', async () => {
  delete process.env.REPORTER_RUNTIME_EXPECTED_BUILD;
  expect((await run(req('guest'))).json).toHaveBeenCalledWith({ ok: false, code: 'REPORTER_CONTRACT_UNAVAILABLE' });
  process.env.REPORTER_RUNTIME_EXPECTED_BUILD = pin;
  process.env.REPORTER_AUTH_API_BASE = 'http://127.0.0.1:31338';
  expect((await run(req('guest'))).json).toHaveBeenCalledWith({ ok: false, code: 'REPORTER_CONTRACT_UNAVAILABLE' });
  expect(fetchMock).not.toHaveBeenCalled(); expect(privateWrite).not.toHaveBeenCalled(); expect(operations()).not.toHaveBeenCalled();
});
it('uses mandatory auth, verified identity and only supported private fields', async () => {
  const request = req(account, { ...payload, reporterEmail: email, reporterName: 'Wrong person', reporterAccountId: id, reporterType: 'journalist' });
  const result = await run(request);
  expect(result.json).toHaveBeenCalledWith({ ok: true, referenceId: id, actor: 'account' });
  expect(operations()).toHaveBeenCalledWith(`${base}${runtime}/public/community/settings`,
    expect.objectContaining({ method: 'GET', headers: { Accept: 'application/json', 'X-NP-Reporter-Build': pin } }));
  expect(privateWrite).toHaveBeenCalledWith(request, '/api/reporter-portal/submissions', {
    method: 'POST', body: { action: 'submit', headline: payload.headline, story: payload.story, category: 'Civic Issue', originalLanguage: 'hi',
      city: 'City', district: 'District', state: 'State', country: 'Country', phone: '1234567890', whatsapp: '9876543210', coverageScope: 'regional', beat: 'Civic', generalEthicsAccepted: true },
  });
  expect(posts()).toHaveLength(0);
});
it('requires affirmative current ethics input, not a key, on direct account final POST', async () => {
  for (const generalEthicsAccepted of [undefined, false, 'true']) {
    expect((await run(req(account, { ...payload, generalEthicsAccepted }))).status).toHaveBeenCalledWith(400);
  }
  expect((await run(req(account, payload, { 'idempotency-key': 'unique-draft-only' }))).status).toHaveBeenCalledWith(409);
  expect(privateWrite).not.toHaveBeenCalled(); expect(posts()).toHaveLength(0);
});
it('never downgrades stale, lost, mismatched or unconfigured private requests before or during a write', async () => {
  for (const cookie of ['reporter_portal_session=other', 'reporter_portal.sid=other']) {
    expect((await run(req('guest', payload, { cookie }))).status).toHaveBeenCalledWith(409);
  }
  auth.mockResolvedValueOnce({ ok: false, status: 401, code: 'SESSION_EXPIRED' });
  expect((await run(req(account))).status).toHaveBeenCalledWith(401);
  expect((await run(req(id))).status).toHaveBeenCalledWith(409);
  expect((await run(req(account, { ...payload, reporterEmail: 'other@example.invalid' }))).status).toHaveBeenCalledWith(409);
  delete process.env.REPORTER_RUNTIME_EXPECTED_BUILD;
  expect((await run(req(account))).status).toHaveBeenCalledWith(503);
  process.env.REPORTER_RUNTIME_EXPECTED_BUILD = pin;
  expect((await run(req(''))).status).toHaveBeenCalledWith(403);
  expect((await run(req(account, payload, { 'sec-fetch-site': 'cross-site' }))).status).toHaveBeenCalledWith(403);
  expect(privateWrite).not.toHaveBeenCalled();
  privateWrite.mockResolvedValueOnce(response(401, { ok: false }));
  expect((await run(req(account))).status).toHaveBeenCalledWith(401);
  expect(privateWrite).toHaveBeenCalledTimes(1); expect(posts()).toHaveLength(0);
});
it('never dispatches under global readonly or closed/unknown intake', async () => {
  mode = response(200, { ok: true, mode: 'NORMAL', readOnly: true });
  expect((await run(req('guest'))).status).toHaveBeenCalledWith(503);
  mode = response(404, {});
  await expect(communityReporterWriteGate(true)).resolves.toBe('open');
  for (const changed of [{ allowNewSubmissions: false }, { communityReporterClosed: true }, { reporterPortalClosed: true }, { communityReporterEnabled: null }]) {
    settings = response(200, { ok: true, settings: { ...gates, ...changed } });
    expect((await run(req(account))).status).toHaveBeenCalledWith(503);
  }
  expect(privateWrite).not.toHaveBeenCalled(); expect(posts()).toHaveLength(0);
});
it.each([
  [200, { ok: true, success: true, item }], [201, { ok: true }], [201, { ok: false, success: true, item }],
  [201, { ok: true, success: false, item }], [201, { ok: true, referenceId: id }], [201, { ok: true, success: true, item: { ...item, id: '' } }],
  [201, { ok: true, success: true, item: { ...item, headline: 'other' } }], [201, { ok: true, success: true, item: { ...item, status: 'NEW' } }],
])('fails closed on ambiguous create receipts (%#)', async (status, body) => {
  guestWrite = response(status as number, body);
  const result = await run(req('guest'));
  expect(result.status).toHaveBeenCalledWith(502);
  expect(result.json).toHaveBeenCalledWith({ ok: false, code: 'RECEIPT_UNCONFIRMED' });
  expect(posts()).toHaveLength(1);
});
it('returns only definitive validation codes, never upstream diagnostics', async () => {
  for (const status of [400, 500]) {
    guestWrite = response(status, { ok: false, code: 'VALIDATION_ERROR', message: 'secret', notes: 'private' });
    const result = await run(req('guest'));
    expect(result.json).toHaveBeenCalledWith({ ok: false, code: status === 400 ? 'VALIDATION_FAILED' : 'RECEIPT_UNCONFIRMED' });
  }
  const local = await run(req('guest', { ...payload, originalLanguage: 'fr' }));
  expect(local.status).toHaveBeenCalledWith(400); expect(posts()).toHaveLength(2);
});
