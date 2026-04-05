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

  it('does not clear a newer token saved while an older session check is in flight', async () => {
    let resolveFetch: ((value: any) => void) | null = null;
    (global as any).fetch.mockImplementationOnce(() => new Promise((resolve) => {
      resolveFetch = resolve;
    }));

    const { result } = renderHook(() => useReporterPortalSession());

    act(() => {
      window.localStorage.setItem('np_reporter_portal_session_token', 'new-valid-token');
    });

    await act(async () => {
      resolveFetch?.({
        ok: false,
        status: 401,
        json: async () => ({ ok: false, code: 'SESSION_EXPIRED', message: 'SESSION_EXPIRED' }),
      });
      await Promise.resolve();
    });

    expect(window.localStorage.getItem('np_reporter_portal_session_token')).toBe('new-valid-token');
    expect(result.current.session).toBeNull();
  });
});