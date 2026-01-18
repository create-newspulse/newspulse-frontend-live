import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { useCommunityStories } from '../../hooks/useCommunityStories';
import { LanguageProvider } from '../../src/i18n/LanguageProvider';

// Minimal shim for Next router
jest.mock('next/router', () => ({
  useRouter: () => ({ isReady: true, query: { email: 'tester@example.com' } })
}));

describe('useCommunityStories', () => {
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
  });

  it('loads settings and stories and computes counts', async () => {
    (global as any).fetch
      // settings
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, settings: { communityReporterEnabled: true, allowNewSubmissions: true, allowMyStoriesPortal: true, allowJournalistApplications: false } }) })
      // stories
      .mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, stories: [
        { id: '1', headline: 'A', category: 'Cat', status: 'pending', createdAt: new Date().toISOString() },
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
  });
});
