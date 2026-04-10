import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useCommunityStories } from '../../hooks/useCommunityStories';
import { LanguageProvider } from '../../src/i18n/LanguageProvider';

// Minimal shim for Next router
jest.mock('next/router', () => ({
  useRouter: () => ({ isReady: true, query: { email: 'tester@example.com' } })
}));

jest.mock('../../hooks/useReporterPortalSession', () => ({
  useReporterPortalSession: () => ({
    session: null,
    profile: null,
    isReady: true,
    reason: null,
    logout: async () => {},
  }),
}));

describe('useCommunityStories', () => {
  const routerState = {
    isReady: true,
    query: { email: 'tester@example.com' },
  };

  beforeEach(() => {
    (global as any).fetch = jest.fn();
    // Clear localStorage
    const store: Record<string, string> = {};
    (global as any).window = {
      localStorage: {
        getItem: (k: string) => store[k] || null,
        setItem: (k: string, v: string) => { store[k] = v; },
        removeItem: (k: string) => { delete store[k]; },
      }
    } as any;
    routerState.isReady = true;
    routerState.query = { email: 'tester@example.com' };
  });

  it('loads settings and stories and computes counts', async () => {
    (global as any).fetch
      // settings
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, settings: { communityReporterEnabled: true, allowNewSubmissions: true, allowMyStoriesPortal: true, allowJournalistApplications: false } }) })
      // stories
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, stories: [
        { id: '1', headline: 'A', category: 'Cat', status: 'pending', createdAt: new Date().toISOString(), reporterName: 'Kiran Parmar' },
        { id: '2', headline: 'B', category: 'Cat', status: 'approved', createdAt: new Date().toISOString() },
        { id: '3', headline: 'C', category: 'Cat', status: 'rejected', createdAt: new Date().toISOString() },
      ] }) });

    const { result } = renderHook(() => useCommunityStories(), {
      wrapper: ({ children }) => <LanguageProvider>{children}</LanguageProvider>,
    });

    // Wait for settings load
    await act(async () => { await Promise.resolve(); });

    expect(result.current.settings?.communityReporterEnabled).toBe(true);

    // Wait for stories load triggered by reporterEmail
    await act(async () => { await Promise.resolve(); });

    expect(result.current.stories.length).toBe(3);
    expect(result.current.counts.total).toBe(3);
    expect(result.current.counts.pending).toBe(1);
    expect(result.current.counts.approved).toBe(1);
    expect(result.current.counts.rejected).toBe(1);
    expect(result.current.profileWarning).toBeNull();
    expect(result.current.reporterProfile).toEqual(expect.objectContaining({
      fullName: 'Kiran Parmar',
      name: 'Kiran Parmar',
      firstName: 'Kiran',
      email: 'tester@example.com',
    }));
  });

  it('does not fall back to router or local storage when reporter email is session-controlled', async () => {
    const store: Record<string, string> = {
      np_cr_email: 'stale@example.com',
    };
    (global as any).window = {
      localStorage: {
        getItem: (k: string) => store[k] || null,
        setItem: (k: string, v: string) => { store[k] = v; },
        removeItem: (k: string) => { delete store[k]; },
      }
    } as any;

    (global as any).fetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, settings: { communityReporterEnabled: true, allowNewSubmissions: true, allowMyStoriesPortal: true, allowJournalistApplications: false } }) });

    const { result } = renderHook(() => useCommunityStories({ reporterEmail: null }), {
      wrapper: ({ children }) => <LanguageProvider>{children}</LanguageProvider>,
    });

    await act(async () => { await Promise.resolve(); });

    expect(result.current.reporterEmail).toBeNull();
    expect(result.current.stories).toEqual([]);
    expect((global as any).fetch).toHaveBeenCalledTimes(1);
  });

  it('clears stale stories and surfaces an error when the reporter fetch fails', async () => {
    (global as any).fetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, settings: { communityReporterEnabled: true, allowNewSubmissions: true, allowMyStoriesPortal: true, allowJournalistApplications: false } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, stories: [
        { id: '1', headline: 'A', category: 'Cat', status: 'pending', createdAt: new Date().toISOString() },
      ] }) })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ ok: false, message: 'UPSTREAM_ERROR' }) });

    const { result, rerender } = renderHook(
      ({ reporterEmail }) => useCommunityStories({ reporterEmail }),
      {
        initialProps: { reporterEmail: 'verified@example.com' },
        wrapper: ({ children }) => <LanguageProvider>{children}</LanguageProvider>,
      }
    );

    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });

    expect(result.current.stories).toHaveLength(1);
    expect(result.current.error).toBeNull();

    rerender({ reporterEmail: 'other@example.com' });
    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });

    expect(result.current.stories).toEqual([]);
    expect(result.current.error).toBeTruthy();
    expect(result.current.profileWarning).toBe('REPORTER_PROFILE_UNAVAILABLE');
    expect(result.current.errorStatus).toBe(500);
  });

  it('preserves auth/session failures separately from outages for reporter submissions', async () => {
    (global as any).fetch
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ ok: true, settings: { communityReporterEnabled: true, allowNewSubmissions: true, allowMyStoriesPortal: true, allowJournalistApplications: false } }) })
      .mockResolvedValueOnce({ ok: false, status: 403, json: async () => ({ ok: false, code: 'REPORTER_EMAIL_MISMATCH', message: 'REPORTER_EMAIL_MISMATCH' }) });

    const { result } = renderHook(
      () => useCommunityStories({ reporterEmail: 'verified@example.com', reporterAuth: true }),
      {
        wrapper: ({ children }) => <LanguageProvider>{children}</LanguageProvider>,
      }
    );

    await act(async () => { await Promise.resolve(); });
    await act(async () => { await Promise.resolve(); });

    expect(result.current.stories).toEqual([]);
    expect(result.current.error).toBeTruthy();
    expect(result.current.errorStatus).toBe(403);
    expect(result.current.errorCode).toBe('REPORTER_EMAIL_MISMATCH');
    expect(result.current.profileWarning).toBeNull();
  });
});
