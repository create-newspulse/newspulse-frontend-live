import { fetchMyStoriesByEmail, withdrawStoryById, fetchPublicSettings } from '../../lib/communityReporterApi';

describe('communityReporterApi', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn();
  });

  it('maps stories from different response shapes', async () => {
    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true, stories: [{ id: '1', headline: 'A', category: 'Cat', status: 'pending', createdAt: new Date().toISOString() }] })
    });
    const a = await fetchMyStoriesByEmail('x@y.com');
    expect(a.length).toBe(1);

    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, items: [{ id: '2', headline: 'B', category: 'Cat', status: 'approved', createdAt: new Date().toISOString() }] })
    });
    const b = await fetchMyStoriesByEmail('x@y.com');
    expect(b[0].id).toBe('2');

    (global as any).fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, data: { stories: [{ id: '3', headline: 'C', category: 'Cat', status: 'rejected', createdAt: new Date().toISOString() }] } })
    });
    const c = await fetchMyStoriesByEmail('x@y.com');
    expect(c[0].id).toBe('3');
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
