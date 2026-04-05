import { fetchMyStoriesByEmail, withdrawStoryById, fetchPublicSettings } from '../../lib/communityReporterApi';

describe('communityReporterApi', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn();
    const store: Record<string, string> = {};
    (global as any).window = {
      localStorage: {
        getItem: (key: string) => store[key] || null,
        setItem: (key: string, value: string) => { store[key] = value; },
        removeItem: (key: string) => { delete store[key]; },
      },
      location: {
        origin: 'http://localhost:3000',
      },
    } as any;
  });

  it('maps stories from different response shapes', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, stories: [{ id: '1', headline: 'A', category: 'Cat', status: 'pending', createdAt: new Date().toISOString() }] })
    });
    const a = await fetchMyStoriesByEmail('x@y.com');
    expect(a.length).toBe(1);

    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, items: [{ id: '2', headline: 'B', category: 'Cat', status: 'approved', createdAt: new Date().toISOString() }] })
    });
    const b = await fetchMyStoriesByEmail('x@y.com');
    expect(b[0].id).toBe('2');

    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data: { stories: [{ id: '3', headline: 'C', category: 'Cat', status: 'rejected', createdAt: new Date().toISOString() }] } })
    });
    const c = await fetchMyStoriesByEmail('x@y.com');
    expect(c[0].id).toBe('3');
  });

  it('throws typed error on non-OK without stories', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => ({ code: 'UPSTREAM_ERROR', message: 'Internal error' }),
    });

    await expect(fetchMyStoriesByEmail('x@y.com')).rejects.toMatchObject({
      name: 'CommunityReporterHttpError',
      status: 500,
      code: 'UPSTREAM_ERROR',
    });
  });

  it('treats a 200 empty items array as an empty state instead of an outage', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ items: [] }),
    });

    await expect(fetchMyStoriesByEmail('x@y.com')).resolves.toEqual([]);
  });

  it('uses same-origin proxy auth when reporter auth is required', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, stories: [] }),
    });

    await fetchMyStoriesByEmail('Reporter@Example.com', { reporterAuth: true, useProxy: true });

    expect((global as any).fetch).toHaveBeenCalledWith(
      '/api/community-reporter/my-stories?email=reporter%40example.com',
      expect.objectContaining({
        credentials: 'include',
        headers: expect.objectContaining({
          Accept: 'application/json',
        }),
      })
    );
  });

  it('does not enable credentials for public my-stories requests', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ ok: true, stories: [] }),
    });

    await fetchMyStoriesByEmail('Reporter@Example.com');

    expect((global as any).fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/community-reporter/my-stories?email=reporter%40example.com'),
      expect.objectContaining({
        credentials: undefined,
      })
    );
  });

  it('withdrawStoryById returns boolean', async () => {
    (global as any).fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true }) });
    expect(await withdrawStoryById('abc', 'rep-1')).toBe(true);
    (global as any).fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ ok: false }) });
    expect(await withdrawStoryById('abc', 'rep-1')).toBe(false);
  });

  it('fetchPublicSettings returns null on failure', async () => {
    (global as any).fetch.mockResolvedValueOnce({ ok: false, json: async () => ({}) });
    const s1 = await fetchPublicSettings();
    expect(s1).toBeNull();

    (global as any).fetch.mockResolvedValueOnce({ ok: true, json: async () => ({ ok: true, settings: { communityReporterEnabled: true, allowNewSubmissions: true, allowMyStoriesPortal: true, allowJournalistApplications: false } }) });
    const s2 = await fetchPublicSettings();
    expect(s2?.allowMyStoriesPortal).toBe(true);
  });
});
