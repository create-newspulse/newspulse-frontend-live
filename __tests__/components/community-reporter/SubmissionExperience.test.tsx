import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import SubmissionExperience from '../../../components/community-reporter/SubmissionExperience';
import { REPORTER_PRIVATE_RESET } from '../../../lib/reporterPrivacy';
import type { ReporterPortalSession } from '../../../lib/reporterPortal';
import { getServerSideProps as submitProps } from '../../../pages/reporter/submit';

const id = '111111111111111111111111', accountA = 'aaaaaaaaaaaaaaaaaaaaaaaa', accountB = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const draftUrl = `/api/reporter-portal/submissions/${id}`;
const postUrl = '/api/community/submissions';
const options = { communityReporterClosed: false, reporterPortalClosed: false };
const account = (accountId: string): ReporterPortalSession => ({ accountId, email: `${accountId[0]}@example.invalid`, fullName: `Reporter ${accountId[0]}` });
const article = { headline: 'Fixture report', story: 'A synthetic public-interest report with a sufficiently detailed description.', category: 'Education / School / College' };
const draft = { ...article, id, originalLanguage: 'gu', reviewStatus: 'DRAFT', publicationStatus: 'not_published', canEdit: true,
  isPublished: false, publicUrl: null, editions: [], reporterFeedback: null };
const ok = (status: number, data: unknown) => ({ ok: status < 300, status, json: async () => data });
let mockSession: ReporterPortalSession | null, mockChecking: boolean, mockReason: string | null, mockLocale: string;
let mockClosed: boolean, mockPortalClosed: boolean, mockReadOnly: boolean;
const mockReplace = jest.fn().mockResolvedValue(true);
const mockLogout = jest.fn();
jest.mock('next/router', () => ({ useRouter: () => ({ locale: mockLocale, replace: mockReplace }) }));
jest.mock('../../../hooks/useReporterPortalSession', () => ({
  useReporterPortalSession: () => ({ session: mockSession, status: mockChecking ? 'checking' : mockSession ? 'authenticated' : 'anonymous',
    reason: mockReason, bootstrapSession: jest.fn(), logout: mockLogout }),
}));
jest.mock('../../../hooks/usePublicFounderToggles', () => ({
  usePublicFounderToggles: () => ({ toggles: { communityReporterClosed: mockClosed, reporterPortalClosed: mockPortalClosed } }),
}));
jest.mock('../../../utils/PublicModeProvider', () => ({ usePublicMode: () => ({ readOnly: mockReadOnly, mode: 'NORMAL', isLoading: false }) }));
jest.mock('../../../lib/reporterPortalPage', () => ({ getReporterPortalPageServerProps: async () => ({ props: options }) }));

let fetchMock: jest.Mock;
let post: () => unknown, firstSave: (body: Record<string, unknown>) => unknown, patch: (body: Record<string, unknown>) => unknown, detail: () => unknown;
let settings: Record<string, boolean>;
beforeEach(() => {
  jest.clearAllMocks(); window.localStorage.clear(); window.sessionStorage.clear();
  mockSession = null; mockReason = null; mockChecking = false; mockClosed = false; mockPortalClosed = false; mockReadOnly = false; mockLocale = 'en';
  settings = { communityReporterEnabled: true, allowNewSubmissions: true, allowMyStoriesPortal: true, allowJournalistApplications: true };
  post = () => ok(201, { ok: true, referenceId: id, actor: mockSession ? 'account' : 'guest' });
  firstSave = body => ok(201, { ok: true, created: true, item: { ...draft, headline: '', story: '', category: null, originalLanguage: null, ...body } });
  detail = () => ok(200, { ok: true, item: draft });
  patch = body => ok(200, { ok: true, item: { ...draft, ...body, reviewStatus: body.action === 'draft' ? 'DRAFT' : 'SUBMITTED', canEdit: body.action === 'draft' } });
  fetchMock = jest.fn(async (url, init) => {
    if (url === '/api/public/community/settings') return ok(200, { ok: true, settings });
    if (url === postUrl && init.method === 'POST') return post();
    if (url === '/api/reporter-portal/submissions' && init.method === 'POST') return firstSave(JSON.parse(init.body));
    if (url === draftUrl && init.method === 'GET') return detail();
    if (url === draftUrl && init.method === 'PATCH') return patch(JSON.parse(init.body));
    throw new Error('Unexpected request');
  });
  global.fetch = fetchMock;
});
const change = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const input = (label: string | RegExp) => screen.getByLabelText(label) as HTMLInputElement;
const btn = (name: string | RegExp) => screen.getByRole('button', { name });
const requests = (method: string) => fetchMock.mock.calls.filter(([, init]) => init?.method === method);
const implicitSubmit = () => fireEvent.submit(document.querySelector<HTMLFormElement>('#submit-form form')!);
const submit = () => fireEvent.click(document.querySelector<HTMLButtonElement>('#submit-form button[value="submit"]')!);
const publicForm = () => <SubmissionExperience {...options} />;
const editForm = () => <SubmissionExperience {...options} variant="portal" draftId={id} />;
async function storyStep() {
  await screen.findByLabelText('Email *');
  if (!mockSession) { change('Full name *', 'Guest'); change('Email *', 'guest@example.invalid'); }
  if (!mockSession) fireEvent.click(screen.getByLabelText(/I agree not to submit fake/));
  fireEvent.click(btn('Next'));
  if (mockSession) fireEvent.click(screen.getByLabelText(/I agree not to submit fake/));
  change('Category *', 'education_school_college'); change('Headline *', article.headline); change('Story *', article.story);
  if (mockSession) fireEvent.click(screen.getByLabelText('National'));
  else change('Age group *', '18_24');
}

it('purges legacy personal data without restoring it; keeps the public two-step form, guide and self-declared journalist guidance', async () => {
  window.localStorage.setItem('np_cr_profile_v1', JSON.stringify({ fullName: 'Private fixture', email: 'old@example.invalid' }));
  window.sessionStorage.setItem('np_cr_email', 'other@example.invalid'); window.localStorage.setItem('unrelated', 'keep');
  render(<React.StrictMode>{publicForm()}</React.StrictMode>); await screen.findByLabelText('Full name *');
  expect(input('Email *').value).toBe(''); expect(input('Full name *').value).toBe('');
  expect(window.localStorage.getItem('np_cr_profile_v1')).toBeNull(); expect(window.sessionStorage.getItem('np_cr_email')).toBeNull();
  expect(screen.getByRole('link', { name: 'Read the full Community Reporter Guide' }).getAttribute('href')).toBe('/community-reporter/guidelines');
  fireEvent.click(screen.getByLabelText('Professional journalist / media person'));
  expect(screen.getByText(/not sent as a professional classification/i)).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Visit Journalist Desk' }).getAttribute('href')).toBe('/journalist-desk');
  await storyStep(); submit();
  expect(await screen.findByText(/News Pulse received your story/)).toBeTruthy();
  expect(screen.getByText(id)).toBeTruthy(); expect(window.localStorage).toHaveLength(1); expect(window.sessionStorage).toHaveLength(0);
  const [[, init]] = requests('POST'); const body = JSON.parse(init.body);
  expect(init.headers['X-Reporter-Account']).toBe('guest'); expect(body.ageGroup).toBe('18_24');
  expect(body).not.toHaveProperty('originalLanguage'); expect(body).not.toHaveProperty('reporterType'); expect(body).not.toHaveProperty('reporterAccountId');
});
it('sends the signed-in form under the expected account only; clears fields on account change and logout', async () => {
  mockSession = account(accountA);
  const page = render(publicForm()); await screen.findByLabelText('Email *');
  expect(input('Email *').readOnly).toBe(true); expect(input('Email *').value).toBe(mockSession.email);
  change('Phone (optional)', '1234567890'); fireEvent.click(btn('Civic'));
  await storyStep(); change(/Original language/, 'hi'); submit();
  expect(await screen.findByText(/News Pulse received/)).toBeTruthy();
  const [[, init]] = requests('POST'); const body = JSON.parse(init.body);
  expect(init.headers['X-Reporter-Account']).toBe(accountA); expect(body).toMatchObject({ originalLanguage: 'hi', communityInterests: ['Civic'], coverageScope: 'national' });
  expect(body).not.toHaveProperty('ageGroup'); expect(body).not.toHaveProperty('reporterName');
  fireEvent.click(btn('Submit another story')); change('Phone (optional)', '2222222222');
  mockSession = account(accountB); page.rerender(publicForm());
  expect(input('Email *').value).toBe(mockSession.email); expect(input('Phone (optional)').value).toBe('');
  mockSession = null; page.rerender(publicForm());
  expect(screen.queryByLabelText('Email *')).toBeNull();
  mockLogout.mockResolvedValueOnce(false).mockResolvedValueOnce(true);
  await act(async () => { fireEvent.click(btn('Sign out and start a new guest form')); });
  expect(screen.queryByLabelText('Email *')).toBeNull();
  await act(async () => { fireEvent.click(btn('Sign out and start a new guest form')); });
  expect(input('Email *').value).toBe('');
  expect(requests('POST')).toHaveLength(1);
});
it('discards an A response after B replaces the account even when A’s POST had already left', async () => {
  mockSession = account(accountA); let finish!: (r: unknown) => void;
  post = () => new Promise(resolve => { finish = resolve; });
  const page = render(publicForm()); await storyStep(); submit(); expect(requests('POST')).toHaveLength(1);
  mockSession = account(accountB); page.rerender(publicForm());
  await act(async () => { finish(ok(201, { ok: true, referenceId: id, actor: 'account' })); });
  expect(screen.queryByText(id)).toBeNull(); expect(input('Email *').value).toBe(mockSession.email);
});
it.each(['lost-response', 'bare-2xx', '5xx'])('retains text and locks duplicate/uncertain %s submissions even during rechecks', async outcome => {
  let finish!: (r: unknown) => void, reject!: (e: unknown) => void;
  post = () => new Promise((resolve, r) => { finish = resolve; reject = r; });
  const page = render(publicForm()); await storyStep(); submit(); submit();
  expect(requests('POST')).toHaveLength(1);
  await act(async () => {
    if (outcome === 'lost-response') reject(new Error('private transport information'));
    else finish(outcome === 'bare-2xx' ? ok(201, { success: true }) : ok(500, { ok: false }));
  });
  expect(await screen.findByText(/No receipt was confirmed/)).toBeTruthy(); expect(input('Story *').value).toBe(article.story);
  mockChecking = true; page.rerender(publicForm()); mockChecking = false; page.rerender(publicForm());
  submit(); expect(requests('POST')).toHaveLength(1); expect(screen.queryByText(id)).toBeNull();
});
it('recovers after definitive validation by editing; does not clear content or retry the unchanged request', async () => {
  post = () => ok(400, { ok: false, code: 'VALIDATION_FAILED', message: 'private' });
  render(publicForm()); await storyStep(); submit();
  expect(await screen.findByText(/Edit the form before sending again/)).toBeTruthy();
  submit(); expect(requests('POST')).toHaveLength(1);
  change('Headline *', 'Corrected fixture'); post = () => ok(201, { ok: true, referenceId: id, actor: 'guest' });
  submit(); expect(await screen.findByText(id)).toBeTruthy(); expect(requests('POST')).toHaveLength(2);
});
it('does not silently downgrade an account form after a denied POST or an inconclusive session check', async () => {
  mockSession = account(accountA); post = () => ok(401, { ok: false, code: 'SESSION_EXPIRED' });
  const page = render(publicForm()); await storyStep(); submit();
  expect(await screen.findByText(/nothing will be sent as a guest/i)).toBeTruthy();
  mockSession = null; mockReason = 'SESSION_CHECK_FAILED'; page.rerender(publicForm());
  expect(screen.queryByLabelText('Email *')).toBeNull();
  mockLogout.mockResolvedValueOnce(true);
  await act(async () => { fireEvent.click(btn('Sign out and start a new guest form')); });
  expect(input('Email *').value).toBe('');
  expect(requests('POST')).toHaveLength(1);
});
it('actually freezes edits and writes on global readonly and removes intake for a closure', async () => {
  const page = render(publicForm()); await storyStep();
  mockReadOnly = true; page.rerender(publicForm());
  expect(input('Story *').matches(':disabled')).toBe(true);
  change('Story *', 'should not change'); expect(input('Story *').value).toBe(article.story); submit();
  expect(requests('POST')).toHaveLength(0);
  mockClosed = true; page.rerender(publicForm());
  expect(screen.queryByLabelText('Story *')).toBeNull(); expect(screen.getByText('Submissions are currently closed.')).toBeTruthy();
});
it('opens, saves, and sends the same existing ID using owned detail and PATCH only; omits undeclared changes', async () => {
  mockSession = account(accountA); render(editForm()); await screen.findByDisplayValue(article.story);
  expect(screen.queryByLabelText('Email *')).toBeNull(); expect(screen.queryByLabelText('Age group *')).toBeNull();
  expect(input(/Original language/).value).toBe('gu'); expect(input('Category *').value).toBe('education_school_college');
  change('Headline', 'Corrected draft'); fireEvent.click(btn('Save changes'));
  expect(await screen.findByText(/Changes saved to this submission/)).toBeTruthy(); expect(screen.getByText(id)).toBeTruthy();
  const [[url, init]] = requests('PATCH');
  expect(url).toBe(draftUrl); expect(init.headers['X-Reporter-Account']).toBe(accountA);
  expect(JSON.parse(init.body)).toEqual({ ...article, headline: 'Corrected draft', action: 'draft' });
  change(/Original language/, 'en'); fireEvent.click(btn('Submit Story'));
  expect(await screen.findByText(/Confirm the ethics declaration/)).toBeTruthy();
  expect(requests('PATCH')).toHaveLength(1); expect(input('Headline').value).toBe('Corrected draft');
  fireEvent.click(screen.getByLabelText(/I agree not to submit fake/)); fireEvent.click(btn('Submit Story'));
  expect(await screen.findByText(/News Pulse received/)).toBeTruthy();
  expect(JSON.parse(requests('PATCH')[1][1].body)).toMatchObject({ action: 'submit', originalLanguage: 'en', generalEthicsAccepted: true });
  expect(requests('POST')).toHaveLength(0);
});
it.each([
  { canEdit: false }, { reviewStatus: 'APPROVED' }, { id: accountB }, { publicationStatus: 'draft' }, { publicationStatus: 'unverified' },
])('requires positive owned editable detail before showing any editable fields (%j)', async bad => {
  mockSession = account(accountA); detail = () => ok(200, { ok: true, item: { ...draft, ...bad } });
  render(editForm()); await screen.findByRole('alert');
  expect(screen.queryByLabelText('Headline')).toBeNull(); expect(screen.queryByLabelText('Email *')).toBeNull();
  expect(requests('PATCH')).toHaveLength(0); expect(requests('POST')).toHaveLength(0);
});
it('preserves a partial draft on a save 500, blocks blind retries, and allows a fresh owned read before editing', async () => {
  mockSession = account(accountA); patch = () => ok(500, { ok: false, code: 'REPORTER_UPSTREAM_FAILED' });
  render(editForm()); await screen.findByDisplayValue(article.story); change('Story', ''); fireEvent.click(btn('Save changes'));
  expect(await screen.findByText(/did not confirm this partial draft/)).toBeTruthy();
  expect(input('Headline').value).toBe(article.headline); expect(input('Story').value).toBe('');
  fireEvent.click(btn('Save changes')); submit(); expect(requests('PATCH')).toHaveLength(1);
  fireEvent.click(btn('Check the saved version')); expect(await screen.findByText(/still editable/)).toBeTruthy();
  expect(input('Story').value).toBe(''); change('Story', 'Repaired text'); expect(input('Story').value).toBe('Repaired text');
  expect(requests('PATCH')).toHaveLength(1); expect(requests('POST')).toHaveLength(0);
});
it('removes draft text and stale receipts on the shared private reset event', async () => {
  mockSession = account(accountA); render(editForm()); await screen.findByDisplayValue(article.story);
  change('Story', 'Unsaved private edit'); detail = () => ok(404, { ok: false, code: 'SUBMISSION_NOT_FOUND' });
  act(() => { window.dispatchEvent(new Event(REPORTER_PRIVATE_RESET)); });
  expect(screen.queryByDisplayValue('Unsaved private edit')).toBeNull();
  await screen.findByText(/not available for you to edit/);
});
it.each([
  ['hi', 'पूरा नाम *', 'आगे', 'अपना पूरा नाम दर्ज करें।', 'अपनी रिपोर्टों की स्थिति देखें'],
  ['gu', 'પૂરું નામ *', 'આગળ', 'તમારું પૂરું નામ આપો.', 'તમારા અહેવાલોની સ્થિતિ જુઓ'],
])('uses %s for controls, error text and portal entry points', async (locale, name, next, invalid, track) => {
  mockLocale = locale; render(publicForm()); await screen.findByLabelText(name);
  fireEvent.click(btn(next)); expect(await screen.findByText(invalid)).toBeTruthy();
  expect(screen.getByRole('link', { name: track }).getAttribute('href')).toContain('/reporter/login');
  expect(screen.queryByText('Select a category')).toBeNull();
});
it.each([
  ['hi', 'श्रेणी *', 'नागरिक समस्या', 'बदलाव सहेजें', /केवल मौजूदा रिपोर्ट/, /इसी रिपोर्ट में बदलाव सहेजे/],
  ['gu', 'શ્રેણી *', 'નાગરિક સમસ્યા', 'ફેરફારો સાચવો', /હાલના અહેવાલનું મથાળું/, /આ જ અહેવાલમાં ફેરફારો/],
] as const)('renders %s article editing, category choices and confirmed draft receipts without changing story language', async (locale, category, option, save, intro, saved) => {
  mockLocale = locale; mockSession = account(accountA); render(editForm());
  await screen.findByText(intro); expect(screen.getByRole('option', { name: option })).toBeTruthy();
  change(category, 'civic_issue'); fireEvent.click(btn(save));
  expect(await screen.findByText(saved)).toBeTruthy();
  expect(JSON.parse(requests('PATCH')[0][1].body)).not.toHaveProperty('originalLanguage');
});
it('implicit form submission in edit mode saves changes rather than sending a draft for review', async () => {
  mockSession = account(accountA); render(editForm()); await screen.findByDisplayValue(article.story);
  change('Headline', 'Updated draft'); implicitSubmit(); await screen.findByText(/Changes saved/);
  expect(JSON.parse(requests('PATCH')[0][1].body).action).toBe('draft');
});
it('replays only the identical first save after a lost receipt, then edits and finalizes that exact ID', async () => {
  mockSession = account(accountA);
  let finish!: (value: unknown) => void;
  firstSave = () => new Promise(resolve => { finish = resolve; });
  const page = render(publicForm()); await screen.findByLabelText('Email *'); fireEvent.click(btn('Next'));
  change('Headline *', 'Only a headline');
  const save = btn('Save private draft');
  fireEvent.click(save); implicitSubmit(); submit();
  expect(requests('POST')).toHaveLength(1);
  const [[url, sent]] = requests('POST');
  expect(url).toBe('/api/reporter-portal/submissions');
  expect(sent.headers['Idempotency-Key']).toMatch(/^[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}$/i);
  expect(JSON.parse(sent.body)).toEqual({ action: 'draft', headline: 'Only a headline' });
  await act(async () => { finish(ok(201, { ok: true, created: true, item: { ...draft, id: '' } })); });
  await screen.findByText(/may already be saved/);
  expect(input('Headline *').value).toBe('Only a headline'); expect(screen.queryByText(id)).toBeNull();
  change('Headline *', 'different'); expect(input('Headline *').value).toBe('Only a headline');
  mockChecking = true; page.rerender(publicForm()); mockChecking = false; page.rerender(publicForm());
  expect(requests('POST')).toHaveLength(1); expect(window.localStorage).toHaveLength(0); expect(window.sessionStorage).toHaveLength(0);
  firstSave = body => ok(200, { ok: true, created: false, item: { ...draft, story: '', category: null, originalLanguage: null, ...body } });
  fireEvent.click(btn('Retry the same save')); await screen.findByText(id);
  const replay = requests('POST')[1][1];
  expect(replay.headers).toEqual(sent.headers); expect(replay.body).toBe(sent.body);
  expect(screen.getByRole('link', { name: 'Edit draft' }).getAttribute('href')).toBe(`/reporter/submit?draft=${id}`);
  patch = body => ok(200, { ok: true, item: { ...draft, category: null, originalLanguage: null, ...body,
    reviewStatus: body.action === 'draft' ? 'DRAFT' : 'SUBMITTED', canEdit: body.action === 'draft' } });
  change('Headline', 'Saved edit'); fireEvent.click(btn('Save changes')); await screen.findByText(id);
  fireEvent.click(btn('Submit Story')); expect(await screen.findByText('Confirm the ethics declaration to continue.')).toBeTruthy();
  expect(input('Category *').getAttribute('aria-invalid')).toBe('true'); expect(input('Story').getAttribute('aria-invalid')).toBe('true');
  expect(requests('PATCH')).toHaveLength(1);
  change('Category *', 'civic_issue'); change('Story', article.story);
  fireEvent.click(screen.getByLabelText(/I agree not to submit fake/)); fireEvent.click(btn('Submit Story'));
  await screen.findByText(/News Pulse received your story/); expect(screen.getByText(id)).toBeTruthy();
  expect(requests('POST')).toHaveLength(2);
  expect(requests('PATCH').map(([path, init]) => [path, JSON.parse(init.body).generalEthicsAccepted, init.headers['Idempotency-Key']]))
    .toEqual([[draftUrl, undefined, undefined], [draftUrl, true, undefined]]);
});
it('stops on a first-save conflict without minting another key, and never transfers a pending draft to B', async () => {
  mockSession = account(accountA); const page = render(publicForm()); await screen.findByLabelText('Email *');
  fireEvent.click(btn('Next')); change('Headline *', 'Private A fixture');
  firstSave = () => ok(409, { ok: false, code: 'DRAFT_KEY_CONFLICT' });
  fireEvent.click(btn('Save private draft')); await screen.findByText(/conflicts with an existing draft/);
  expect(input('Headline *').value).toBe('Private A fixture'); expect(screen.queryByText(id)).toBeNull();
  expect(screen.queryByRole('button', { name: 'Retry the same save' })).toBeNull();
  implicitSubmit(); expect(requests('POST')).toHaveLength(1);
  mockSession = account(accountB); page.rerender(publicForm()); fireEvent.click(btn('Next'));
  expect(input('Headline *').value).toBe(''); expect(screen.queryByRole('alert')).toBeNull();
  change('Headline *', 'Private B fixture'); fireEvent.click(btn('Save private draft')); await screen.findByRole('alert');
  const [first, second] = requests('POST').map(([, init]) => init);
  expect(second.headers['Idempotency-Key']).not.toBe(first.headers['Idempotency-Key']);
  expect(second.headers['X-Reporter-Account']).toBe(accountB); expect(second.body).not.toContain('Private A fixture');
});
it.each([[undefined, null], ['', ''], [id, id], [[id, id], '']])('never converts malformed edit parameters into a create form', async (value, expected) => {
  const result = await submitProps({ query: { draft: value }, res: { setHeader: jest.fn() } } as never);
  expect(result).toMatchObject({ props: { draftId: expected } });
});
