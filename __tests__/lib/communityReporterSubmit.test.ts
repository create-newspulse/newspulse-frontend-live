import { submitCommunityStory, submitYouthPulseStory } from '../../src/lib/communityReporterApi';

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
    expect(body.reporterPhone).toBe('999');
    expect(body.phone).toBe('999');
    expect(body.reporterWhatsApp).toBe('888');
    expect(body.whatsapp).toBe('888');
    expect(body.city).toBe('Ahmedabad');
    expect(body.state).toBe('Gujarat');
    expect(body.country).toBe('India');
    expect(body.coverageType).toBe('regional');
    expect(body.reporterDistrict).toBe('Ahmedabad');
    expect(body.reporterProfile.phone).toBe('999');
    expect(body.reporterProfile.city).toBe('Ahmedabad');
    expect(body.consentToContact).toBe(true);
    expect(body.coverageScope).toBe('regional');
    expect(Array.isArray(body.beats)).toBe(true);
  });

  it('tags Youth Pulse submissions for the Youth Pulse Desk workflow', async () => {
    await submitYouthPulseStory({
      reporterName: 'Student Reporter',
      reporterEmail: 'student@example.com',
      mobileNumber: '9999999999',
      college: 'GLS University',
      city: 'Ahmedabad',
      state: 'Gujarat',
      headline: 'Campus clean-up drive draws 200 volunteers',
      story: 'Students organized a clean-up drive across campus and nearby public areas.',
      track: 'campus-buzz',
      submissionType: 'student-voice',
      storySource: 'first-hand',
      truthfulnessConfirmed: true,
      rightsConfirmed: true,
      reviewAcknowledged: true,
      safetyConfirmed: true,
    });

    expect((global as any).fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global as any).fetch.mock.calls[0];
    const body = JSON.parse(init.body);

    expect(url).toBe('/api/public/youth-pulse/submit');
    expect(body.desk).toBe('youth-pulse');
    expect(body.track).toBe('campus-buzz');
    expect(body.category).toBe('Youth / Campus');
    expect(body.submissionType).toBe('youth-pulse');
    expect(body.youthSubmissionType).toBe('student-voice');
    expect(body.storySource).toBe('first-hand');
    expect(body.source).toBe('youth_pulse');
    expect(body.fullName).toBe('Student Reporter');
    expect(body.email).toBe('student@example.com');
    expect(body.reporterEmail).toBe('student@example.com');
    expect(body.reporterPhone).toBe('9999999999');
    expect(body.city).toBe('Ahmedabad');
    expect(body.state).toBe('Gujarat');
    expect(body.supportingLink).toBeUndefined();
    expect(body.attachmentLink).toBeUndefined();
    expect(body.truthfulnessConfirmed).toBe(true);
    expect(body.reviewAcknowledged).toBe(true);
    expect(body.moderationRequired).toBe(true);
    expect(body.autoPublish).toBe(false);
    expect(body.publishRequested).toBe(false);
    expect(body.meta.source).toBe('youth_pulse');
    expect(body.storyText).toContain('clean-up drive');
  });
});
