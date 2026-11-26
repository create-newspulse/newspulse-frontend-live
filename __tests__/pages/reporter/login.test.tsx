import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ReporterLoginPage from '../../../pages/reporter/login';
import { REPORTER_LIFECYCLE_KEY } from '../../../lib/reporterPrivacy';

const router = { locale: 'en', query: {} as Record<string, string>, replace: jest.fn().mockResolvedValue(true) };
const mockSettings = jest.fn();
jest.mock('next/router', () => ({ useRouter: () => router }));
jest.mock('../../../hooks/usePublicFounderToggles', () => ({ usePublicFounderToggles: () => ({ toggles: {} }) }));
jest.mock('../../../lib/communityReporterApi', () => ({ fetchPublicSettings: () => mockSettings() }));
jest.mock('../../../components/reporter-portal/ReporterPortalLayout', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));

const props = { communityReporterClosed: false, reporterPortalClosed: false };
const id = '111111111111111111111111', email = 'one@example.test';
const json = (data: unknown, status = 200) => ({ status, ok: status === 200, json: async () => data });
const anonymous = () => json({ ok: false, code: 'REPORTER_SESSION_MISSING' }, 401);
const originalFetch = global.fetch;
beforeEach(() => {
  router.replace.mockClear(); router.locale = 'en'; router.query = {};
  mockSettings.mockResolvedValue({ communityReporterEnabled: true, allowMyStoriesPortal: true });
  localStorage.setItem(REPORTER_LIFECYCLE_KEY, 'check:initial');
  document.cookie = 'np_reporter_logout=; Path=/; Max-Age=0';
  global.fetch = jest.fn().mockResolvedValue(anonymous());
});
afterEach(() => { global.fetch = originalFetch; });

it.each([true, false])('requests a code, verifies it, and navigates only after an affirmative matching session (confirmed=%s)', async confirmed => {
  const operations: string[] = [];
  const mock = jest.fn().mockImplementation(async (url: string) => {
    operations.push(url.split('/').at(-1)!);
    if (url.endsWith('request-code')) return json({ ok: true, devCode: '112233' });
    if (url.endsWith('verify-code')) return json({ ok: true, accountId: id, token: 'not-for-storage' });
    return operations.includes('verify-code') && confirmed
      ? json({ ok: true, authenticated: true, session: { accountId: id, email, expiresAt: new Date(Date.now() + 60_000).toISOString() } })
      : anonymous();
  });
  global.fetch = mock;
  const draft = `/reporter/submit?draft=${id}`;
  router.query = { next: draft };
  render(<ReporterLoginPage {...props} />);
  fireEvent.change(await screen.findByLabelText('Reporter email'), { target: { value: email } });
  fireEvent.click(screen.getByRole('button', { name: 'Send verification code' }));
  fireEvent.change(await screen.findByLabelText('Verification code'), { target: { value: '000000' } });
  expect(screen.queryByText(/112233/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Verify code' }));
  if (confirmed) await waitFor(() => expect(router.replace).toHaveBeenCalledWith(draft));
  else { expect(await screen.findByText('Sign-in was not confirmed. Request a new code.')).toBeTruthy(); expect(router.replace).not.toHaveBeenCalled(); }
  expect(operations.indexOf('verify-code')).toBeGreaterThan(operations.indexOf('request-code'));
  expect(operations.lastIndexOf('session')).toBeGreaterThan(operations.indexOf('verify-code'));
  expect(JSON.stringify(localStorage)).not.toMatch(/one@example|not-for-storage|000000/);
  expect(JSON.stringify(sessionStorage)).not.toContain(email);
});
it('offers revocation retry after a reload, even when login is closed, and does not send another code', async () => {
  localStorage.setItem(REPORTER_LIFECYCLE_KEY, 'pending:earlier');
  mockSettings.mockResolvedValue(null);
  global.fetch = jest.fn().mockResolvedValueOnce(json({ ok: false }, 503)).mockResolvedValueOnce(json({ ok: true, revoked: true }));
  render(<ReporterLoginPage {...props} />);
  const retry = await screen.findByRole('button', { name: 'Retry sign-out' });
  fireEvent.click(retry);
  await waitFor(() => expect((retry as HTMLButtonElement).disabled).toBe(false));
  expect(screen.getByRole('alert').textContent).toContain('not confirmed');
  fireEvent.click(retry);
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Retry sign-out' })).toBeNull());
  expect((global.fetch as jest.Mock).mock.calls.map(([url]) => url)).toEqual(['/api/reporter-auth/logout', '/api/reporter-auth/logout']);
});
it.each([['hi', 'रिपोर्टर ईमेल', 'सत्यापन कोड भेजें'], ['gu', 'રિપોર્ટર ઈમેલ', 'ચકાસણી કોડ મોકલો']])('uses route locale %s', async (locale, label, action) => {
  router.locale = locale;
  render(<ReporterLoginPage {...props} />);
  expect(await screen.findByLabelText(label)).toBeTruthy();
  expect(screen.getByRole('button', { name: action })).toBeTruthy();
});
