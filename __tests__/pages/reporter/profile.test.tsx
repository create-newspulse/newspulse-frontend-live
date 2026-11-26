import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReporterProfilePage from '../../../pages/reporter/profile';
import { REPORTER_LIFECYCLE_KEY } from '../../../lib/reporterPrivacy';

const a = '111111111111111111111111', b = '222222222222222222222222';
const session = (id: string) => ({ accountId: id, email: id === a ? 'one@example.test' : 'two@example.test' });
const router = { locale: 'en', replace: jest.fn().mockResolvedValue(true) };
const mockAuth = jest.fn();
jest.mock('next/router', () => ({ useRouter: () => router }));
jest.mock('../../../hooks/usePublicFounderToggles', () => ({ usePublicFounderToggles: () => ({ toggles: {} }) }));
jest.mock('../../../hooks/useReporterPortalSession', () => ({ useReporterPortalSession: () => mockAuth() }));
jest.mock('../../../components/reporter-portal/ReporterPortalLayout', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
const props = { communityReporterClosed: false, reporterPortalClosed: false };
const json = (data: unknown, status = 200) => ({ status, json: async () => data });
const profile = (id = a, name = 'One') => json({ ok: true, profile: { ...session(id), fullName: name } });
const originalFetch = global.fetch;
beforeEach(() => {
  router.replace.mockClear(); router.locale = 'en';
  mockAuth.mockReturnValue({ status: 'authenticated', session: session(a) });
  localStorage.setItem(REPORTER_LIFECYCLE_KEY, 'check:initial');
  document.cookie = 'np_reporter_logout=; Path=/; Max-Age=0';
  global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
});
afterEach(() => { global.fetch = originalFetch; });

it('updates server profile without email in PATCH; requests a code and requires confirmed email change before re-login', async () => {
  const fetchMock = global.fetch as jest.Mock;
  fetchMock.mockResolvedValueOnce(profile()).mockResolvedValueOnce(profile(a, 'Edited'))
    .mockResolvedValueOnce(json({ ok: true })).mockResolvedValueOnce(json({ ok: false, code: 'INVALID_OTP' }, 400))
    .mockResolvedValueOnce(json({ ok: true, reverifyRequired: true }));
  render(<ReporterProfilePage {...props} />);
  fireEvent.change(await screen.findByLabelText('Full name'), { target: { value: 'Edited' } });
  fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));
  expect(await screen.findByText('Profile saved.')).toBeTruthy();
  expect(screen.getByText('Professional verification is not confirmed for this profile.')).toBeTruthy();
  const patch = fetchMock.mock.calls[1][1];
  expect(patch).toMatchObject({ method: 'PATCH', cache: 'no-store', headers: { 'X-Reporter-Account': a } });
  expect(JSON.parse(patch.body)).toMatchObject({ fullName: 'Edited' });
  expect(JSON.parse(patch.body)).not.toHaveProperty('email');
  fireEvent.change(screen.getByLabelText('New email'), { target: { value: 'next@example.test' } });
  fireEvent.click(screen.getByRole('button', { name: 'Send verification code' }));
  fireEvent.change(await screen.findByLabelText('Verification code'), { target: { value: '000000' } });
  fireEvent.click(screen.getByRole('button', { name: 'Confirm email change' }));
  expect(await screen.findByText(/Code not verified/)).toBeTruthy();
  expect(router.replace).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirm email change' }));
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith('/reporter/login?changed=1'));
  expect(fetchMock.mock.calls.slice(2).map(([url]) => url)).toEqual(['request-change', 'confirm-change', 'confirm-change'].map(x => `/api/reporter-auth/profile/email/${x}`));
  expect(localStorage.getItem(REPORTER_LIFECYCLE_KEY)).toMatch(/^signed-out:/);
  expect(JSON.stringify(localStorage)).not.toMatch(/example\.test|Edited|000000/);
});
it('does not display a delayed profile response after the session account switches', async () => {
  let resolve!: (r: ReturnType<typeof profile>) => void;
  (global.fetch as jest.Mock).mockReturnValueOnce(new Promise(r => { resolve = r; })).mockResolvedValueOnce(profile(b, 'Second'));
  const view = render(<ReporterProfilePage {...props} />);
  mockAuth.mockReturnValue({ status: 'authenticated', session: session(b) });
  view.rerender(<ReporterProfilePage {...props} />);
  expect(await screen.findByDisplayValue('Second')).toBeTruthy();
  await act(async () => { resolve(profile(a, 'Late previous name')); });
  expect(screen.queryByDisplayValue('Late previous name')).toBeNull();
  expect(screen.queryByText(session(a).email)).toBeNull();
});
it.each([
  ['en', 'Full name', 'New email', 'News Pulse has verified this journalist profile.'],
  ['hi', 'पूरा नाम', 'नया ईमेल', 'न्यूज़ पल्स ने इस पत्रकार प्रोफ़ाइल का सत्यापन किया है।'],
  ['gu', 'પૂરું નામ', 'નવો ઈમેલ', 'ન્યૂઝ પલ્સે આ પત્રકારની પ્રોફાઇલ ચકાસી છે.'],
])('localizes profile, staff confirmation and verified email workflow for %s', async (locale, name, email, classification) => {
  router.locale = locale;
  (global.fetch as jest.Mock).mockResolvedValueOnce(json({ ok: true, profile: { ...session(a), fullName: 'One', verifiedJournalist: true } }));
  render(<ReporterProfilePage {...props} />);
  expect(await screen.findByLabelText(name)).toBeTruthy();
  expect(screen.getByLabelText(email)).toBeTruthy();
  expect(screen.getByText(classification)).toBeTruthy();
});
