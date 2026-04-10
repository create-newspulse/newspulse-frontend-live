import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { useReporterPortalSession } from '../../hooks/useReporterPortalSession';

describe('useReporterPortalSession', () => {
  beforeEach(() => {
    const store: Record<string, string> = {};
    (global as any).window = {
      localStorage: {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
      },
    } as any;
    (global as any).fetch = jest.fn();
  });

  it('checks the reporter session with cookie credentials only', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, session: { email: 'reporter@example.com', expiresAt: new Date().toISOString() } }),
    });

    const { result } = renderHook(() => useReporterPortalSession());

    await act(async () => {
      await Promise.resolve();
    });

    expect((global as any).fetch).toHaveBeenCalledWith(
      '/api/reporter-auth/session',
      expect.objectContaining({
        method: 'GET',
        credentials: 'include',
        headers: { Accept: 'application/json' },
      })
    );
    expect(result.current.session?.email).toBe('reporter@example.com');
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
});