import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { ReporterAuthProvider, useReporterPortalSession } from '../../hooks/useReporterPortalSession';

function createDeferred<T = any>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: any) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe('useReporterPortalSession', () => {
  beforeEach(() => {
    const localStore: Record<string, string> = {};
    const sessionStore: Record<string, string> = {};
    (global as any).window = {
      localStorage: {
        getItem: (key: string) => localStore[key] || null,
        setItem: (key: string, value: string) => { localStore[key] = value; },
        removeItem: (key: string) => { delete localStore[key]; },
      },
      sessionStorage: {
        getItem: (key: string) => sessionStore[key] || null,
        setItem: (key: string, value: string) => { sessionStore[key] = value; },
        removeItem: (key: string) => { delete sessionStore[key]; },
      },
    } as any;
    (global as any).fetch = jest.fn();
  });

  it('checks the reporter session with cookie credentials only', async () => {
    const sessionResponse = createDeferred<any>();
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => sessionResponse.promise,
    });

    const { result } = renderHook(() => useReporterPortalSession());

    expect(result.current.status).toBe('checking');
    expect(result.current.session).toBeNull();
    expect(result.current.reporter).toBeNull();

    sessionResponse.resolve({ ok: true, session: { email: 'reporter@example.com', expiresAt: new Date().toISOString() } });

    await act(async () => {
      await Promise.resolve();
    });

    expect((global as any).fetch).toHaveBeenCalledWith(
      '/api/reporter-auth/session',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      })
    );
    expect(result.current.session?.email).toBe('reporter@example.com');
    expect(result.current.reporter?.email).toBe('reporter@example.com');
    expect(result.current.authenticated).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.status).toBe('authenticated');
  });

  it('does not treat old localStorage reporter profile as authenticated before bootstrap finishes', async () => {
    const sessionResponse = createDeferred<any>();
    (global as any).window.localStorage.setItem('np_cr_profile_v1', JSON.stringify({ email: 'saved@example.com', fullName: 'Saved Reporter' }));
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => sessionResponse.promise,
    });

    const { result } = renderHook(() => useReporterPortalSession());

    expect(result.current.status).toBe('checking');
    expect(result.current.authenticated).toBe(false);
    expect(result.current.session).toBeNull();
    expect(result.current.profile).toBeNull();

    sessionResponse.resolve({ ok: true, session: { email: 'reporter@example.com' } });
    await act(async () => { await Promise.resolve(); });
    expect(result.current.status).toBe('authenticated');
  });

  it('uses the shared reporter name precedence when hydrating session identity', async () => {
    (global as any).window.localStorage.setItem('np_cr_profile_v1', JSON.stringify({
      firstName: 'Kiran',
      email: 'reporter@example.com',
    }));

    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, session: { email: 'reporter@example.com', expiresAt: new Date().toISOString() } }),
    });

    const { result } = renderHook(() => useReporterPortalSession());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.session?.fullName).toBe('Kiran');
    expect(result.current.session?.firstName).toBe('Kiran');
  });

  it('treats anonymous reporter-session 401 responses as unauthenticated without logging errors', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (global as any).window.localStorage.setItem('np_reporter_portal_session', 'stale-client-session');
    (global as any).window.localStorage.setItem('np_cr_profile_v1', JSON.stringify({ fullName: 'Saved Reporter', email: 'saved@example.com' }));
    (global as any).window.localStorage.setItem('lang', 'gu');
    (global as any).window.sessionStorage.setItem('reporterPortalToken', 'stale-session-token');
    (global as any).window.sessionStorage.setItem('theme', 'aurora');
    (global as any).fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ ok: false, code: 'REPORTER_SESSION_MISSING', message: 'REPORTER_SESSION_MISSING' }),
    });

    const { result } = renderHook(() => useReporterPortalSession());

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.session).toBeNull();
    expect(result.current.reporter).toBeNull();
    expect(result.current.authenticated).toBe(false);
    expect(result.current.profile).toBeNull();
    expect(result.current.reason).toBeNull();
    expect(result.current.isReady).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.status).toBe('anonymous');
    expect((global as any).window.localStorage.getItem('np_reporter_portal_session')).toBeNull();
    expect((global as any).window.sessionStorage.getItem('reporterPortalToken')).toBeNull();
    expect((global as any).window.localStorage.getItem('np_cr_profile_v1')).toBeTruthy();
    expect((global as any).window.localStorage.getItem('lang')).toBe('gu');
    expect((global as any).window.sessionStorage.getItem('theme')).toBe('aurora');
    expect(consoleErrorSpy).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('treats SESSION_EXPIRED as anonymous state and does not retry during rerenders', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ ok: false, code: 'SESSION_EXPIRED', message: 'SESSION_EXPIRED' }),
    });

    const { result, rerender } = renderHook(() => useReporterPortalSession());

    await act(async () => {
      await Promise.resolve();
    });

    rerender();
    await act(async () => {
      await Promise.resolve();
    });

    expect((global as any).fetch).toHaveBeenCalledTimes(1);
    expect(result.current.session).toBeNull();
    expect(result.current.reporter).toBeNull();
    expect(result.current.authenticated).toBe(false);
    expect(result.current.reason).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('preserves protected-page expired-session reason when requested', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ ok: false, code: 'SESSION_EXPIRED', message: 'SESSION_EXPIRED' }),
    });

    const { result } = renderHook(() => useReporterPortalSession({ reportUnauthorizedReason: true }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.authenticated).toBe(false);
    expect(result.current.reason).toBe('SESSION_EXPIRED');
  });

  it('exits checking when the session request fails', async () => {
    (global as any).fetch.mockRejectedValueOnce(new Error('network down'));

    const { result } = renderHook(() => useReporterPortalSession({ reportUnauthorizedReason: true }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.status).toBe('anonymous');
    expect(result.current.loading).toBe(false);
    expect(result.current.reason).toBe('SESSION_CHECK_FAILED');
  });

  it('times out a hung session request instead of staying in checking forever', async () => {
    jest.useFakeTimers();
    (global as any).fetch.mockImplementationOnce((_url: string, init: RequestInit) => new Promise((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    }));

    const { result } = renderHook(() => useReporterPortalSession({ reportUnauthorizedReason: true }));
    expect(result.current.status).toBe('checking');

    await act(async () => {
      jest.advanceTimersByTime(10_001);
      await Promise.resolve();
    });

    expect(result.current.status).toBe('anonymous');
    expect(result.current.loading).toBe(false);
    expect(result.current.reason).toBe('SESSION_CHECK_TIMEOUT');
    jest.useRealTimers();
  });

  it('ignores stale session bootstrap responses after a newer authenticated bootstrap wins', async () => {
    const firstJson = createDeferred<any>();
    const secondJson = createDeferred<any>();
    (global as any).fetch
      .mockResolvedValueOnce({ ok: false, status: 401, json: async () => firstJson.promise })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => secondJson.promise });

    const { result } = renderHook(() => useReporterPortalSession({ skipInitialCheck: true }));

    act(() => { void result.current.bootstrapSession(); });
    act(() => { void result.current.bootstrapSession(); });

    secondJson.resolve({ ok: true, session: { email: 'reporter@example.com' } });
    await act(async () => { await Promise.resolve(); });
    expect(result.current.status).toBe('authenticated');

    firstJson.resolve({ ok: false, code: 'REPORTER_SESSION_MISSING', message: 'REPORTER_SESSION_MISSING' });
    await act(async () => { await Promise.resolve(); });
    expect(result.current.status).toBe('authenticated');
    expect(result.current.session?.email).toBe('reporter@example.com');
  });

  it('shares one provider bootstrap across multiple reporter auth consumers', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, session: { email: 'reporter@example.com' } }),
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => <ReporterAuthProvider>{children}</ReporterAuthProvider>;
    const { result } = renderHook(() => [useReporterPortalSession(), useReporterPortalSession()], { wrapper });

    await act(async () => { await Promise.resolve(); });

    expect((global as any).fetch).toHaveBeenCalledTimes(1);
    expect(result.current[0].status).toBe('authenticated');
    expect(result.current[1].status).toBe('authenticated');
  });

});