import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ReporterAuthProvider, useReporterPortalSession } from '../../hooks/useReporterPortalSession';
import { REPORTER_LIFECYCLE_KEY, REPORTER_PRIVATE_RESET, reporterLifecycleStamp, signalReporterSessionInvalid, verifiedReporterLogin } from '../../lib/reporterPrivacy';

const a = '111111111111111111111111', b = '222222222222222222222222';
const json = (body: unknown, status = 200) => ({ status, ok: status === 200, json: async () => body });
const response = (accountId = a) => json({ ok: true, authenticated: true, session:
  { accountId, email: accountId === a ? 'one@example.test' : 'two@example.test', expiresAt: new Date(Date.now() + 90_000).toISOString() } });
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(r => { resolve = r; }); return { promise, resolve }; }
const fetchMock = () => global.fetch as jest.Mock;
const hooked = () => useReporterPortalSession({ reportUnauthorizedReason: true });
const original = global.fetch;
beforeEach(() => {
  global.fetch = jest.fn().mockRejectedValue(new Error('offline'));
  localStorage.setItem(REPORTER_LIFECYCLE_KEY, 'check:initial');
  document.cookie = 'np_reporter_logout=; Path=/; Max-Age=0';
});
afterEach(() => { global.fetch = original; });

it('shares one validated bootstrap, without hydrating profile or token from storage', async () => {
  localStorage.setItem('np_cr_profile_v1', '{"fullName":"Previous"}');
  fetchMock().mockResolvedValueOnce(response());
  const wrapper = ({ children }: { children: React.ReactNode }) => <ReporterAuthProvider>{children}</ReporterAuthProvider>;
  const hook = renderHook(() => [hooked(), hooked()], { wrapper });
  await waitFor(() => expect(hook.result.current[0].status).toBe('authenticated'));
  expect(fetchMock()).toHaveBeenCalledTimes(1);
  expect(fetchMock()).toHaveBeenCalledWith('/api/reporter-auth/session', expect.objectContaining({ method: 'GET', credentials: 'include', cache: 'no-store' }));
  expect(hook.result.current[1].session?.accountId).toBe(a);
  expect(hook.result.current[0].profile?.fullName).toBeUndefined();
  expect(localStorage.getItem('np_cr_profile_v1')).toBeNull();
});
it.each([{ ok: true, session: { email: 'old@example.test' } }, { ok: false }, { ok: true, authenticated: false, session: { accountId: a } }])(
  'never authenticates from a malformed or nonaffirmative response %#', async payload => {
    fetchMock().mockResolvedValueOnce(json(payload));
    const h = renderHook(hooked);
    await waitFor(() => expect(h.result.current.status).toBe('anonymous'));
    expect(h.result.current.session).toBeNull();
  });

it('masks logout at intent, rejects a late session, retains a reloadable retry lock and needs confirmed revocation', async () => {
  fetchMock().mockResolvedValueOnce(response());
  const h = renderHook(hooked);
  await waitFor(() => expect(h.result.current.authenticated).toBe(true));
  const old = deferred<ReturnType<typeof response>>();
  fetchMock().mockReturnValueOnce(old.promise);
  act(() => { void h.result.current.bootstrapSession(); });
  fetchMock().mockResolvedValueOnce(json({ ok: true })); // No positive revocation result.
  await act(async () => { expect(await h.result.current.logout()).toBe(false); });
  expect(h.result.current.reason).toBe('LOGOUT_UNCONFIRMED');
  await act(async () => { old.resolve(response()); });
  expect(h.result.current.session).toBeNull();
  h.unmount();
  const reloaded = renderHook(hooked);
  await waitFor(() => expect(reloaded.result.current.reason).toBe('LOGOUT_UNCONFIRMED'));
  expect(fetchMock()).toHaveBeenCalledTimes(3);
  expect(verifiedReporterLogin(reporterLifecycleStamp())).toBe(false);
  fetchMock().mockResolvedValueOnce(json({ ok: true, revoked: true }));
  await act(async () => { expect(await reloaded.result.current.logout()).toBe(true); });
  expect(reloaded.result.current.reason).toBeNull();
  await act(async () => { await reloaded.result.current.bootstrapSession(); });
  expect(reloaded.result.current.authenticated).toBe(false);
  expect(fetchMock()).toHaveBeenCalledTimes(4);
});

it('honors another tab’s logout while fetching, and discards stale invalidations after a fresh login', async () => {
  const first = deferred<ReturnType<typeof response>>();
  fetchMock().mockReturnValueOnce(first.promise);
  const h = renderHook(hooked);
  const staleStamp = reporterLifecycleStamp();
  act(() => {
    localStorage.setItem(REPORTER_LIFECYCLE_KEY, 'pending:other-tab');
    window.dispatchEvent(new StorageEvent('storage', { key: REPORTER_LIFECYCLE_KEY, newValue: 'pending:other-tab' }));
  });
  expect(h.result.current.reason).toBe('LOGOUT_UNCONFIRMED');
  await act(async () => { first.resolve(response()); });
  expect(h.result.current.authenticated).toBe(false);
  fetchMock().mockResolvedValueOnce(response(b));
  act(() => {
    localStorage.setItem(REPORTER_LIFECYCLE_KEY, 'check:new-login');
    window.dispatchEvent(new StorageEvent('storage', { key: REPORTER_LIFECYCLE_KEY, newValue: 'check:new-login' }));
  });
  await waitFor(() => expect(h.result.current.session?.accountId).toBe(b));
  act(() => signalReporterSessionInvalid(staleStamp));
  expect(h.result.current.session?.accountId).toBe(b);
  act(() => signalReporterSessionInvalid(reporterLifecycleStamp()));
  expect(h.result.current.session).toBeNull();
});

it('masks BFCache before freeze and waits for a fresh session on restore', async () => {
  fetchMock().mockResolvedValueOnce(response());
  const h = renderHook(hooked);
  await waitFor(() => expect(h.result.current.session?.accountId).toBe(a));
  act(() => window.dispatchEvent(new Event('pagehide')));
  expect(h.result.current.session).toBeNull();
  expect(h.result.current.status).toBe('checking');
  const next = deferred<ReturnType<typeof response>>();
  fetchMock().mockReturnValueOnce(next.promise);
  act(() => window.dispatchEvent(Object.assign(new Event('pageshow'), { persisted: true })));
  expect(h.result.current.session).toBeNull();
  await act(async () => { next.resolve(response(b)); });
  expect(h.result.current.session?.accountId).toBe(b);
});

it('preserves an anonymous guest form on ordinary focus rechecks, but resets across identity boundaries', async () => {
  const noSession = json({ ok: false, code: 'REPORTER_SESSION_MISSING' }, 401);
  fetchMock().mockResolvedValue(noSession);
  const reset = jest.fn();
  window.addEventListener(REPORTER_PRIVATE_RESET, reset);
  try {
    const h = renderHook(hooked);
    await waitFor(() => expect(h.result.current.status).toBe('anonymous'));
    sessionStorage.setItem('np_cr_email', 'old@example.test');
    await act(async () => { window.dispatchEvent(new Event('focus')); });
    expect(sessionStorage.getItem('np_cr_email')).toBeNull();
    expect(reset).not.toHaveBeenCalled();
    fetchMock().mockResolvedValueOnce(response());
    await act(async () => { await h.result.current.bootstrapSession(); });
    fetchMock().mockResolvedValueOnce(response(b));
    await act(async () => { await h.result.current.bootstrapSession(); });
    await act(async () => { await h.result.current.bootstrapSession(); });
    expect(reset).toHaveBeenCalledTimes(3);
  } finally { window.removeEventListener(REPORTER_PRIVATE_RESET, reset); }
});

it('fails closed on a session deadline', async () => {
  jest.useFakeTimers();
  try {
    fetchMock().mockImplementationOnce((_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('timeout')))));
    const h = renderHook(hooked);
    await act(async () => { jest.advanceTimersByTime(10_001); });
    expect(h.result.current.reason).toBe('SESSION_CHECK_TIMEOUT');
    expect(h.result.current.session).toBeNull();
  } finally { jest.useRealTimers(); }
});
