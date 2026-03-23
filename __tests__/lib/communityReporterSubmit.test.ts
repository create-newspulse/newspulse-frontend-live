import { submitCommunityStory } from '../../src/lib/communityReporterApi';

describe('submitCommunityStory (identity anchors)', () => {
  beforeEach(() => {
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ referenceId: 'ref-1', status: 'Under review', reporterType: 'community' }),
    });
  });

  it('posts extended profile + anchors in the request body', async () => {
    await submitCommunityStory({
      reporterAccountId: 'acct-1',
      reporterProfileId: 'prof-1',
      reporterName: 'Test User',
      reporterEmail: 'test@example.com',
      reporterPhone: '999',
      reporterWhatsApp: '888',
      city: 'Ahmedabad',
      district: 'Ahmedabad',
      state: 'Gujarat',
      country: 'India',
      consentToContact: true,
      beats: ['Civic', 'Education'],
      ageGroup: '18–24',
      category: 'regional',
      coverageScope: 'regional',
      headline: 'Hello',
      story: 'This is a sufficiently long story text to pass validation.',
      reporterType: 'community',
      preferredLanguages: ['en'],
    });

    expect((global as any).fetch).toHaveBeenCalledTimes(1);
    const [, init] = (global as any).fetch.mock.calls[0];
    const body = JSON.parse(init.body);

    expect(body.reporterAccountId).toBe('acct-1');
    expect(body.reporterProfileId).toBe('prof-1');
    expect(body.reporterEmail).toBe('test@example.com');
    expect(body.reporterWhatsApp).toBe('888');
    expect(body.reporterDistrict).toBe('Ahmedabad');
    expect(body.consentToContact).toBe(true);
    expect(body.coverageScope).toBe('regional');
    expect(Array.isArray(body.beats)).toBe(true);
  });
});
